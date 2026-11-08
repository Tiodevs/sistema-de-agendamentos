/**
 * Seed e testes E2E apagam e sobrescrevem dados, então só rodam num banco descartável
 * (Postgres do Docker, CI). Esta guarda recusa as conexões que apontam para o Postgres de
 * produção no Railway, inclusive pelo túnel local do `npm run db:tunnel`.
 */

const RAILWAY_HOST_SUFFIXES = ['.railway.internal', '.rlwy.net', '.railway.app'];
/** Nome do banco que o Railway cria por padrão. */
const RAILWAY_DATABASE_NAME = 'railway';
/** Porta local do túnel `npm run db:tunnel` (Railway → 127.0.0.1:5433). */
const TUNNEL_PORT = '5433';
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/** Motivo para considerar a conexão de produção, ou `null` se ela parece descartável. */
export function productionDatabaseReason(
  connectionString: string,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  if (env.NODE_ENV === 'production') return 'NODE_ENV=production';

  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    return 'a DATABASE_URL não é uma URL válida';
  }

  const host = url.hostname.toLowerCase();
  if (RAILWAY_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    return `o host ${host} é do Railway`;
  }

  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (database === RAILWAY_DATABASE_NAME) {
    return `o banco se chama "${RAILWAY_DATABASE_NAME}", o nome do Postgres do Railway`;
  }

  if (LOOPBACK_HOSTS.has(host) && url.port === TUNNEL_PORT) {
    return `a porta ${TUNNEL_PORT} é a do túnel para o Postgres de produção (npm run db:tunnel)`;
  }

  return null;
}

/** Lança erro se a conexão estiver ausente ou parecer ser o banco de produção. */
export function assertDisposableDatabase(connectionString: string | undefined, purpose: string) {
  if (!connectionString) {
    throw new Error(`${purpose}: DATABASE_URL não definida.`);
  }

  const reason = productionDatabaseReason(connectionString);
  if (reason) {
    throw new Error(
      `${purpose} recusado: o banco parece ser o de produção (${reason}). ` +
        'Use o Postgres do Docker (docker compose up, veja o README).',
    );
  }
}
