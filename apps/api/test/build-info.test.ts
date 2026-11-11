import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BUILD_FILE, readBuildSha } from '../src/lib/build-info';

const SHA = '4c6e7e5652e08c84818a40f83b17463efce798f5';

/** Roda `check` com um BUILD_SHA temporário (ou sem arquivo, com `content` null). */
function withBuildFile(content: string | null, check: (file: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), 'build-sha-'));
  const file = join(dir, 'BUILD_SHA');
  if (content !== null) writeFileSync(file, content);
  try {
    check(file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('commit da versão no ar (build do /api/health)', () => {
  it('o arquivo fica em apps/api/BUILD_SHA, onde o deploy.yml grava', () => {
    assert.equal(BUILD_FILE, join(__dirname, '..', 'BUILD_SHA'));
  });

  it('lê o commit gravado pelo deploy, sem a quebra de linha', () => {
    withBuildFile(`${SHA}\n`, (file) => assert.equal(readBuildSha(file, {}), SHA));
  });

  it('o arquivo vence o RAILWAY_GIT_COMMIT_SHA', () => {
    withBuildFile(SHA, (file) =>
      assert.equal(readBuildSha(file, { RAILWAY_GIT_COMMIT_SHA: 'abc123' }), SHA),
    );
  });

  it('sem o arquivo, vale o commit do Railway', () => {
    withBuildFile(null, (file) =>
      assert.equal(readBuildSha(file, { RAILWAY_GIT_COMMIT_SHA: 'abc123' }), 'abc123'),
    );
  });

  it('recusa um conteúdo que não é commit e cai na variável', () => {
    withBuildFile('<script>alert(1)</script>', (file) =>
      assert.equal(readBuildSha(file, { RAILWAY_GIT_COMMIT_SHA: 'abc123' }), 'abc123'),
    );
    withBuildFile('a'.repeat(65), (file) => assert.equal(readBuildSha(file, {}), null));
  });

  it('fora de um deploy, null', () => {
    withBuildFile(null, (file) => assert.equal(readBuildSha(file, {}), null));
    withBuildFile(null, (file) =>
      assert.equal(readBuildSha(file, { RAILWAY_GIT_COMMIT_SHA: 'não é commit' }), null),
    );
  });
});
