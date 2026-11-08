// Preço digitado em reais no formulário de produto (UX-13). Sem imports: testado com node:test.

const THOUSANDS_ONLY = /^\d{1,3}(\.\d{3})+$/;
const PLAIN_NUMBER = /^\d+(\.\d{1,2})?$/;

/**
 * Lê "50", "50,5", "1.200,00", "R$ 1.200,00", "1200.50" ou "1.200" (mil e duzentos) e devolve o
 * valor em reais; NaN quando não dá para entender (letras, duas vírgulas, mais de 2 casas).
 */
export function parseBRLPrice(input: string): number {
  let value = input.replace(/\s/g, '').replace(/^R\$/i, '');
  if (!value) return Number.NaN;

  if (value.includes(',')) {
    // Formato brasileiro: ponto separa milhar, a vírgula (uma só) separa os centavos.
    if (value.indexOf(',') !== value.lastIndexOf(',')) return Number.NaN;
    const [integer, decimals] = value.split(',');
    if (integer.includes('.') && !THOUSANDS_ONLY.test(integer)) return Number.NaN;
    const digits = integer.replace(/\./g, '');
    value = decimals ? `${digits}.${decimals}` : digits;
  } else if (THOUSANDS_ONLY.test(value)) {
    // "1.200" sem vírgula, num formulário em português, é mil e duzentos.
    value = value.replace(/\./g, '');
  }

  if (!PLAIN_NUMBER.test(value)) return Number.NaN;
  return Number(value);
}

const inputFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 1200 → "1.200,00", para preencher o campo na edição. */
export function formatBRLPriceInput(value: number): string {
  return inputFormatter.format(value);
}
