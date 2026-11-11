import * as Sentry from '@sentry/node';
import { buildSha } from './build-info';
import { logger } from './logger';

let enabled = false;

/**
 * Sentry opcional (ARQ-05): sem `SENTRY_DSN`, nada é enviado e a API funciona igual. Só erros
 * entram (sem tracing); o corpo das requisições e os dados de cliente não são anexados.
 */
export function initObservability() {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn || enabled) return enabled;
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    release: buildSha() ?? undefined,
    tracesSampleRate: 0,
  });
  enabled = true;
  logger.info('Sentry ligado');
  return enabled;
}

export function observabilityEnabled() {
  return enabled;
}

/** Envia o erro ao Sentry (se ligado) com as etiquetas dadas. Nunca lança. */
export function reportError(error: unknown, tags: Record<string, string | undefined> = {}) {
  if (!enabled) return;
  try {
    Sentry.withScope((scope) => {
      for (const [key, value] of Object.entries(tags)) {
        if (value) scope.setTag(key, value);
      }
      Sentry.captureException(error);
    });
  } catch (reportFailure) {
    logger.warn({ err: reportFailure }, 'falha ao enviar erro ao Sentry');
  }
}

/** Espera os envios pendentes antes de encerrar o processo. */
export async function flushObservability(timeoutMs = 2000) {
  if (!enabled) return;
  await Sentry.flush(timeoutMs).catch(() => undefined);
}
