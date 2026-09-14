import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let apiEnvLoaded = false;

/** Carrega `apps/api/.env` no process.env sem sobrescrever o que já estiver definido. */
export function loadApiEnv() {
  if (apiEnvLoaded) return;
  apiEnvLoaded = true;

  const candidates = [
    resolve(process.cwd(), 'apps/api/.env'),
    resolve(__dirname, '../../apps/api/.env'),
  ];

  for (const file of candidates) {
    if (!existsSync(file)) continue;
    const text = readFileSync(file, 'utf8');
    for (const line of text.split('\n')) {
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
      if (process.env[key] === undefined) process.env[key] = value;
    }
    break;
  }
}
