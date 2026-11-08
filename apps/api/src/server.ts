import 'dotenv/config';
import { getJwtSecret } from './lib/jwt';
import { app } from './app';
import { prisma } from './config/database';

getJwtSecret();

const PORT = process.env.PORT || 3001;
const SHUTDOWN_TIMEOUT_MS = 10_000;

const server = app.listen(PORT, () => {
  console.log(`API rodando em http://localhost:${PORT}`);
  if (process.env.NODE_ENV !== 'production' || process.env.SWAGGER_ENABLED === 'true') {
    console.log(`Swagger docs em http://localhost:${PORT}/api/docs`);
  }
  console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
});

let shuttingDown = false;

/** Para de aceitar conexões, deixa as requisições em andamento terminarem e fecha o pool do banco. */
function shutdown(reason: string, exitCode: number) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[server] encerrando: ${reason}`);

  const forceExit = setTimeout(() => process.exit(exitCode), SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  server.close(() => {
    prisma
      .$disconnect()
      .catch(() => undefined)
      .finally(() => process.exit(exitCode));
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM', 0));
process.on('SIGINT', () => shutdown('SIGINT', 0));

// Um erro sem tratamento deixa o processo num estado desconhecido: registra e encerra de forma
// controlada, e o Railway sobe a API de novo.
process.on('unhandledRejection', (reason) => {
  console.error('[server] unhandledRejection', reason);
  shutdown('unhandledRejection', 1);
});
process.on('uncaughtException', (error) => {
  console.error('[server] uncaughtException', error);
  shutdown('uncaughtException', 1);
});
