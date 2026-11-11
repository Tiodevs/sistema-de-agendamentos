import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Commit da versão da API que está no ar, devolvido em `build` pelo `/api/health`.
 *
 * O `deploy.yml` grava o commit testado pela CI em `apps/api/BUILD_SHA` antes do `railway up`, e
 * a fumaça (`.github/scripts/smoke.mjs`) espera o `/api/health` devolver esse commit antes de
 * testar. O Railway mantém a versão anterior no ar quando um deploy falha (inclusive quando o
 * pré-deploy das migrations para), e sem essa espera a fumaça aprovaria a versão antiga.
 *
 * Sem o arquivo, vale o `RAILWAY_GIT_COMMIT_SHA`, que o Railway preenche num deploy feito pelo
 * repositório. Fora de um deploy, `null`. O arquivo não é versionado: só o deploy o cria.
 */

/** `apps/api/BUILD_SHA`, o mesmo caminho a partir de `src/lib` (tsx) e de `dist/lib` (build). */
export const BUILD_FILE = join(__dirname, '..', '..', 'BUILD_SHA');

/** O arquivo e a variável vêm de fora do código: só vale um valor alfanumérico de até 64 caracteres. */
const COMMIT_PATTERN = /^[0-9A-Za-z]{1,64}$/;

function validCommit(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return COMMIT_PATTERN.test(trimmed) ? trimmed : null;
}

/** Lê o commit do arquivo ou, sem ele, da variável do Railway. Sem cache, para os testes. */
export function readBuildSha(
  file: string = BUILD_FILE,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  let written: string | null = null;
  try {
    written = validCommit(readFileSync(file, 'utf8'));
  } catch {
    // Arquivo ausente ou ilegível: cai na variável.
  }
  return written ?? validCommit(env.RAILWAY_GIT_COMMIT_SHA);
}

let cached: string | null | undefined;

/** O commit da versão no ar, lido uma vez por processo: o código não muda depois de subir. */
export function buildSha(): string | null {
  if (cached === undefined) cached = readBuildSha();
  return cached;
}
