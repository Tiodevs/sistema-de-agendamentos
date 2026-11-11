import 'dotenv/config';
import { initObservability, flushObservability, reportError } from './lib/observability';
import { getJwtSecret } from './lib/jwt';
import { logger } from './lib/logger';
import { app } from './app';
import { prisma } from './config/database';
import { startEmailWorker, stopEmailWorker } from './services/email-outbox.service';
import { deliverEmailJob } from './services/email.service';
import { startRateLimitPersistence, stopRateLimitPersistence } from './lib/rate-limit-store';

initObservability();
getJwtSecret();

const PORT = process.env.PORT || 3001;
const SHUTDOWN_TIMEOUT_MS = 10_000;

const server = app.listen(PORT, () => {
  logger.info(
    {
      port: Number(PORT),
      env: process.env.NODE_ENV || 'development',
      swagger: process.env.NODE_ENV !== 'production' || process.env.SWAGGER_ENABLED === 'true',
    },
    `API rodando em http://localhost:${PORT}`,
  );
});

// Trabalho de fundo só no processo do servidor (os testes importam o `app` sem ligar nada disso).
startEmailWorker(deliverEmailJob);
void startRateLimitPersistence();

let shuttingDown = false;

/** Para de aceitar conexões, deixa as requisições em andamento terminarem e fecha o pool do banco. */
function shutdown(reason: string, exitCode: number) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ reason }, 'encerrando a API');

  const forceExit = setTimeout(() => process.exit(exitCode), SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  server.close(() => {
    Promise.allSettled([stopEmailWorker(), stopRateLimitPersistence(), flushObservability()])
      .then(() => prisma.$disconnect())
      .catch(() => undefined)
      .finally(() => process.exit(exitCode));
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM', 0));
process.on('SIGINT', () => shutdown('SIGINT', 0));

// Um erro sem tratamento deixa o processo num estado desconhecido: registra e encerra de forma
// controlada, e o Railway sobe a API de novo.
process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'unhandledRejection');
  reportError(reason, { kind: 'unhandledRejection' });
  shutdown('unhandledRejection', 1);
});
process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'uncaughtException');
  reportError(error, { kind: 'uncaughtException' });
  shutdown('uncaughtException', 1);
});
