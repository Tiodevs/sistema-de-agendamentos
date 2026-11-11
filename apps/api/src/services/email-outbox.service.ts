import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../lib/logger';
import { isSensitiveEmail, maxAttemptsFor, retryDelayMs } from '../lib/email-retry';
import { reportError } from '../lib/observability';

/**
 * Fila de e-mails no Postgres (ARQ-02). Em vez de chamar o Resend dentro da requisição, a API
 * grava uma linha em `email_outbox` e um worker no mesmo processo envia, com nova tentativa e
 * espera crescente. Um restart ou uma instabilidade do Resend não perde mais o e-mail, e o que
 * está pendente ou falhou fica visível (`GET /api/admin/email-outbox`).
 *
 * `runAt` no futuro agenda o envio: é onde os lembretes (D-1) vão entrar.
 */

export type EmailJobPayload = Record<string, unknown>;

export interface EmailJob {
  id: string;
  type: string;
  recipient: string;
  idempotencyKey: string;
  payload: EmailJobPayload;
  attempts: number;
  maxAttempts: number;
}

export type DeliveryResult = { status: 'sent' } | { status: 'skipped'; reason: string };
export type DeliverFn = (job: EmailJob) => Promise<DeliveryResult>;

const POLL_MS = 5_000;
const BATCH_SIZE = 10;
/** Linha travada há mais tempo que isto é de um processo que morreu no meio do envio. */
const STALE_LOCK_MS = 5 * 60_000;
const CLEANUP_EVERY_MS = 60 * 60_000;
const KEEP_DONE_DAYS = 30;

let deliver: DeliverFn | null = null;
let timer: NodeJS.Timeout | null = null;
let draining: Promise<void> | null = null;
let kickScheduled = false;
let lastCleanup = 0;

export interface EnqueueEmailInput {
  type: string;
  recipient: string;
  idempotencyKey: string;
  payload: EmailJobPayload;
  /** Quando enviar. Padrão: agora. */
  runAt?: Date;
}

/**
 * Coloca o e-mail na fila. A mesma `idempotencyKey` não entra duas vezes. Nunca lança: uma falha
 * ao enfileirar vai para o log e para o Sentry, e a requisição que disparou o aviso segue.
 */
export async function enqueueEmail(input: EnqueueEmailInput) {
  try {
    await prisma.emailOutbox.createMany({
      data: [
        {
          type: input.type,
          recipient: input.recipient.trim().toLowerCase(),
          idempotencyKey: input.idempotencyKey,
          payload: input.payload as Prisma.InputJsonValue,
          maxAttempts: maxAttemptsFor(input.type),
          ...(input.runAt && { runAt: input.runAt }),
        },
      ],
      skipDuplicates: true,
    });
    kick();
  } catch (error) {
    logger.error({ err: error, type: input.type }, 'email: falha ao enfileirar');
    reportError(error, { kind: 'email-enqueue', emailType: input.type });
  }
}

function kick() {
  if (!deliver || kickScheduled) return;
  kickScheduled = true;
  setImmediate(() => {
    kickScheduled = false;
    void drain();
  });
}

async function claimBatch(): Promise<EmailJob[]> {
  const staleBefore = new Date(Date.now() - STALE_LOCK_MS);
  return prisma.$queryRaw<EmailJob[]>`
    UPDATE "email_outbox" AS o
       SET "lockedAt" = NOW(), "attempts" = o."attempts" + 1, "updatedAt" = NOW()
     WHERE o."id" IN (
       SELECT "id" FROM "email_outbox"
        WHERE "status" = 'PENDING'::"EmailOutboxStatus"
          AND "runAt" <= NOW()
          AND ("lockedAt" IS NULL OR "lockedAt" < ${staleBefore})
        ORDER BY "runAt"
        LIMIT ${BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
     )
    RETURNING o."id", o."type", o."recipient", o."idempotencyKey", o."payload", o."attempts", o."maxAttempts"`;
}

async function processJob(job: EmailJob) {
  if (!deliver) return;
  try {
    const result = await deliver(job);
    if (result.status === 'sent') {
      await prisma.emailOutbox.update({
        where: { id: job.id },
        data: { status: 'SENT', sentAt: new Date(), lockedAt: null, lastError: null, payload: {} },
      });
      return;
    }
    await prisma.emailOutbox.update({
      where: { id: job.id },
      data: { status: 'SKIPPED', lockedAt: null, lastError: result.reason, payload: {} },
    });
    logger.warn({ type: job.type, reason: result.reason }, 'email: envio ignorado');
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
    const exhausted = job.attempts >= job.maxAttempts;
    if (exhausted) {
      await prisma.emailOutbox.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          lockedAt: null,
          lastError: message,
          // O link de uso único não fica guardado depois que a fila desiste.
          ...(isSensitiveEmail(job.type) && { payload: {} }),
        },
      });
      logger.error(
        { type: job.type, outboxId: job.id, attempts: job.attempts, error: message },
        'email: desistiu depois de todas as tentativas',
      );
      reportError(error, { kind: 'email-failed', emailType: job.type });
      return;
    }
    const runAt = new Date(Date.now() + retryDelayMs(job.type, job.attempts));
    await prisma.emailOutbox.update({
      where: { id: job.id },
      data: { lockedAt: null, lastError: message, runAt },
    });
    logger.warn(
      { type: job.type, outboxId: job.id, attempts: job.attempts, retryAt: runAt, error: message },
      'email: falhou, vai tentar de novo',
    );
  }
}

async function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_EVERY_MS) return;
  lastCleanup = now;
  const before = new Date(now - KEEP_DONE_DAYS * 24 * 60 * 60_000);
  await prisma.emailOutbox.deleteMany({
    where: { status: { in: ['SENT', 'SKIPPED'] }, updatedAt: { lt: before } },
  });
}

async function drainOnce() {
  for (;;) {
    const jobs = await claimBatch();
    if (jobs.length === 0) break;
    for (const job of jobs) {
      await processJob(job);
    }
    if (jobs.length < BATCH_SIZE) break;
  }
  await cleanup();
}

function drain() {
  if (!deliver) return Promise.resolve();
  if (!draining) {
    draining = drainOnce()
      .catch((error) => {
        logger.error({ err: error }, 'email: erro no worker da fila');
      })
      .finally(() => {
        draining = null;
      });
  }
  return draining;
}

/** Liga o worker da fila neste processo. `deliverFn` monta e envia o e-mail de um job. */
export function startEmailWorker(deliverFn: DeliverFn) {
  if (timer) return;
  deliver = deliverFn;
  timer = setInterval(() => void drain(), POLL_MS);
  timer.unref();
  kick();
}

/** Para de buscar jobs e espera o envio em andamento terminar. */
export async function stopEmailWorker() {
  if (timer) clearInterval(timer);
  timer = null;
  const running = draining;
  deliver = null;
  if (running) await running;
}

const LIST_SELECT = {
  id: true,
  type: true,
  recipient: true,
  status: true,
  attempts: true,
  maxAttempts: true,
  runAt: true,
  lastError: true,
  sentAt: true,
  createdAt: true,
} as const;

/** Visão do admin: contagem por status e os itens que ainda não saíram (sem o conteúdo). */
export async function emailOutboxOverview(limit = 50) {
  const [groups, items] = await Promise.all([
    prisma.emailOutbox.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.emailOutbox.findMany({
      where: { status: { in: ['PENDING', 'FAILED'] } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: LIST_SELECT,
    }),
  ]);
  const counts = { PENDING: 0, SENT: 0, FAILED: 0, SKIPPED: 0 };
  for (const group of groups) counts[group.status] = group._count._all;
  return { counts, items };
}

/** Recoloca na fila um e-mail que falhou. `null` quando não dá mais (não existe ou sem conteúdo). */
export async function retryFailedEmail(id: string) {
  const row = await prisma.emailOutbox.findUnique({ where: { id } });
  if (!row || row.status !== 'FAILED') return null;
  const payload = row.payload as EmailJobPayload | null;
  if (!payload || Object.keys(payload).length === 0) return null;
  const updated = await prisma.emailOutbox.update({
    where: { id },
    data: { status: 'PENDING', attempts: 0, runAt: new Date(), lockedAt: null },
    select: LIST_SELECT,
  });
  kick();
  return updated;
}
