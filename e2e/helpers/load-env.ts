import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let loaded = false;

function readDotEnv(file: string) {
  const values: Record<string, string> = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

/**
 * Carrega o `.env` da raiz (o do ambiente Docker) no process.env, sem sobrescrever o que já
 * estiver definido. Não lê `apps/api/.env`: ele pode ter chaves de produção.
 *
 * Sem E2E_DATABASE_URL, monta a URL do Postgres do container a partir de POSTGRES_*.
 */
export function loadE2eEnv() {
  if (loaded) return;
  loaded = true;

  const candidates = [resolve(process.cwd(), '.env'), resolve(__dirname, '../../.env')];
  const file = candidates.find((candidate) => existsSync(candidate));
  if (file) {
    for (const [key, value] of Object.entries(readDotEnv(file))) {
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }

  if (!process.env.E2E_DATABASE_URL && process.env.POSTGRES_PASSWORD) {
    const user = encodeURIComponent(process.env.POSTGRES_USER || 'agendamentos');
    const password = encodeURIComponent(process.env.POSTGRES_PASSWORD);
    const port = process.env.POSTGRES_PORT || '5434';
    const database = process.env.POSTGRES_DB || 'agendamentos';
    process.env.E2E_DATABASE_URL = `postgresql://${user}:${password}@127.0.0.1:${port}/${database}`;
  }
}
