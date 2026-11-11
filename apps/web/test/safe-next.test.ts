import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { pathnameOf, safeNextPath, withNext } from '../src/lib/safe-next';

describe('safeNextPath (UX-08)', () => {
  it('aceita caminho relativo do site, com query e hash', () => {
    assert.equal(safeNextPath('/book'), '/book');
    assert.equal(safeNextPath('/book?productId=abc123'), '/book?productId=abc123');
    assert.equal(
      safeNextPath('/admin/clients/42?tab=historico#topo'),
      '/admin/clients/42?tab=historico#topo',
    );
    assert.equal(safeNextPath('/'), '/');
  });

  it('recusa endereço de outro site', () => {
    for (const value of [
      'https://evil.example',
      'http://evil.example/book',
      '//evil.example',
      '//evil.example/book',
      'javascript:alert(1)',
      'data:text/html,oi',
      'evil.example',
      'book',
      '',
    ]) {
      assert.equal(safeNextPath(value), null, `"${value}" deveria ser recusado`);
    }
  });

  it('recusa os truques que o navegador lê como outro site', () => {
    for (const value of [
      '/\\evil.example',
      '/\\/evil.example',
      '/book\\..\\evil',
      '/\t/evil.example',
      '/\n/evil.example',
      '/.//evil.example',
      '/..//evil.example',
      '/book/..//evil.example',
    ]) {
      assert.equal(safeNextPath(value), null, `${JSON.stringify(value)} deveria ser recusado`);
    }
  });

  it('recusa valor ausente ou longo demais', () => {
    assert.equal(safeNextPath(null), null);
    assert.equal(safeNextPath(undefined), null);
    assert.equal(safeNextPath(`/${'a'.repeat(600)}`), null);
  });

  it('normaliza segmentos com ponto sem sair do site', () => {
    assert.equal(safeNextPath('/admin/../book'), '/book');
    assert.equal(safeNextPath('/./book'), '/book');
  });
});

describe('withNext e pathnameOf (UX-08)', () => {
  it('leva o next adiante, codificado', () => {
    assert.equal(
      withNext('/register', '/book?productId=abc'),
      '/register?next=%2Fbook%3FproductId%3Dabc',
    );
    assert.equal(withNext('/login', '/book'), '/login?next=%2Fbook');
  });

  it('sem next seguro, devolve só o caminho', () => {
    assert.equal(withNext('/login', null), '/login');
    assert.equal(withNext('/login', 'https://evil.example'), '/login');
    assert.equal(withNext('/register', '//evil.example'), '/register');
  });

  it('o next codificado volta igual depois de decodificar', () => {
    const next = '/book?productId=abc&x=1#h';
    const href = withNext('/register', next);
    const decoded = new URLSearchParams(href.slice(href.indexOf('?'))).get('next');
    assert.equal(decoded, next);
  });

  it('separa o caminho da query e do hash', () => {
    assert.equal(pathnameOf('/book?productId=1'), '/book');
    assert.equal(pathnameOf('/book#x'), '/book');
    assert.equal(pathnameOf('/book'), '/book');
  });
});
