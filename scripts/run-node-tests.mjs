#!/usr/bin/env node
// Roda os testes `*.test.ts` das pastas indicadas com node:test + tsx.
//
// O `tsx --test "test/**/*.test.ts"` dependia do glob do Node 22+: no Node 20 do projeto
// (.nvmrc, Docker, Railway) ele não achava nenhum arquivo. Aqui a lista sai do disco, então
// funciona igual no Node 20, no Windows e no CI.
//
//   node scripts/run-node-tests.mjs apps/api/test apps/web/test
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const dirs = process.argv.slice(2);
if (dirs.length === 0) {
  console.error('Uso: node scripts/run-node-tests.mjs <pasta> [outras pastas]');
  process.exit(2);
}

function collect(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return collect(path);
    return name.endsWith('.test.ts') ? [path] : [];
  });
}

const files = dirs.flatMap((dir) => collect(resolve(dir))).sort();
if (files.length === 0) {
  console.error(`Nenhum teste encontrado em: ${dirs.join(', ')}`);
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ['--import', 'tsx', '--test', ...files.map((file) => relative(process.cwd(), file))],
  { stdio: 'inherit' },
);
process.exit(result.status ?? 1);
