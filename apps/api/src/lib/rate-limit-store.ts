import type { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from './logger';
import {
  markRateLimitsDirty,
  restoreRateLimits,
  takeDirtyRateLimits,
  type RateLimitSnapshot,
} from './rate-limit';

/**
 * Persistência dos contadores de rate limit e do bloqueio de login (SEC-08). A contagem continua
 * em memória (rápida e síncrona); este módulo carrega o que estava no Postgres quando a API sobe
 * e grava as mudanças a cada poucos segundos e no encerramento. Um deploy no meio de um ataque
 * não zera mais a contagem.
 *
 * Com mais de uma instância, cada uma conta o que recebe e a última gravação vence: o limite
 * efetivo fica entre 1x e Nx. Para limite exato entre instâncias, o passo seguinte é contar
 * direto no banco ou num Redis.
 */

const FLUSH_MS = 5_000;
const MAX_PER_FLUSH = 500;

let timer: NodeJS.Timeout | null = null;
let flushing: Promise<void> | null = null;

async function flushOnce() {
  const snapshots = takeDirtyRateLimits();
  if (snapshots.length === 0) return;

  const batch = snapshots.slice(0, MAX_PER_FLUSH);
  // O que não coube volta para a próxima rodada.
  markRateLimitsDirty(snapshots.slice(MAX_PER_FLUSH).map((snapshot) => snapshot.key));

  const deleted = batch.filter((item) => 'deleted' in item).map((item) => item.key);
  const upserts = batch.filter(
    (item): item is Extract<RateLimitSnapshot, { kind: string }> => !('deleted' in item),
  );

  try {
    await prisma.$transaction([
      ...(deleted.length > 0
        ? [prisma.rateLimitEntry.deleteMany({ where: { key: { in: deleted } } })]
        : []),
      ...upserts.map((item) => {
        const data = item.data as Prisma.InputJsonValue;
        return prisma.rateLimitEntry.upsert({
          where: { key: item.key },
          create: { key: item.key, kind: item.kind, data, expiresAt: item.expiresAt },
          update: { kind: item.kind, data, expiresAt: item.expiresAt },
        });
      }),
      prisma.rateLimitEntry.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
    ]);
  } catch (error) {
    markRateLimitsDirty(batch.map((item) => item.key));
    logger.warn({ err: error }, 'rate limit: falha ao gravar os contadores');
  }
}

function flush() {
  if (!flushing) {
    flushing = flushOnce().finally(() => {
      flushing = null;
    });
  }
  return flushing;
}

/** Carrega os contadores gravados e liga a gravação periódica. Falha de banco não impede a subida. */
export async function startRateLimitPersistence() {
  if (timer) return;
  timer = setInterval(() => void flush(), FLUSH_MS);
  timer.unref();
  try {
    const rows = await prisma.rateLimitEntry.findMany({
      where: { expiresAt: { gt: new Date() } },
      select: { key: true, kind: true, data: true },
    });
    const restored = restoreRateLimits(rows);
    if (restored > 0) logger.info({ restored }, 'rate limit: contadores restaurados do banco');
  } catch (error) {
    logger.warn({ err: error }, 'rate limit: não foi possível carregar os contadores');
  }
}

/** Grava o que estiver pendente e para a gravação periódica. */
export async function stopRateLimitPersistence() {
  if (timer) clearInterval(timer);
  timer = null;
  if (flushing) await flushing;
  await flush();
}
