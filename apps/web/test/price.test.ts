import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { formatBRLPriceInput, parseBRLPrice } from '../src/lib/price';

describe('preço do produto (UX-13)', () => {
  it('entende o formato brasileiro com milhar', () => {
    assert.equal(parseBRLPrice('1.200,00'), 1200);
    assert.equal(parseBRLPrice('R$ 1.200,50'), 1200.5);
    assert.equal(parseBRLPrice('12.345.678,9'), 12345678.9);
  });

  it('aceita vírgula ou ponto como centavos e número inteiro', () => {
    assert.equal(parseBRLPrice('50,00'), 50);
    assert.equal(parseBRLPrice('50,5'), 50.5);
    assert.equal(parseBRLPrice('50,'), 50);
    assert.equal(parseBRLPrice('1200.50'), 1200.5);
    assert.equal(parseBRLPrice('1.20'), 1.2);
    assert.equal(parseBRLPrice(' 80 '), 80);
  });

  it('lê "1.200" sem vírgula como mil e duzentos', () => {
    assert.equal(parseBRLPrice('1.200'), 1200);
    assert.equal(parseBRLPrice('1.200.000'), 1200000);
  });

  it('recusa o que não é preço', () => {
    for (const value of ['', 'abc', '1,2,3', '1.20.0', '12,345', '1.2345', '-5', '10..5']) {
      assert.ok(Number.isNaN(parseBRLPrice(value)), `"${value}" deveria ser inválido`);
    }
  });

  it('formata para o campo e volta ao mesmo valor', () => {
    assert.equal(formatBRLPriceInput(1200), '1.200,00');
    assert.equal(formatBRLPriceInput(49.9), '49,90');
    for (const value of [1, 49.9, 1200, 1234567.89]) {
      assert.equal(parseBRLPrice(formatBRLPriceInput(value)), value);
    }
  });
});
