import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  readWizardParams,
  resolveWizardSelection,
  usableWizardDate,
  wizardQuery,
} from '../src/lib/booking-url';
import {
  breaksError,
  firstBreaksError,
  suggestBreak,
  toHourPayload,
} from '../src/lib/schedule-breaks';

const products = [{ id: 'corte' }, { id: 'barba' }];
const employees = [
  { id: 'marina', products: [{ product: { id: 'corte' } }, { product: { id: 'barba' } }] },
  { id: 'rafael', products: [{ product: { id: 'corte' } }] },
];

const params = (query: string) => readWizardParams(new URLSearchParams(query));

describe('estado do assistente na URL (UX-07, UX-08)', () => {
  it('lê só valores no formato esperado', () => {
    assert.deepEqual(params('step=3&productId=corte&employeeId=marina&date=2026-11-12'), {
      step: 3,
      productId: 'corte',
      employeeId: 'marina',
      date: '2026-11-12',
      clientId: undefined,
    });
    const junk = params('step=9&productId=../admin&date=amanha&clientId=a%20b');
    assert.equal(junk.step, undefined);
    assert.equal(junk.productId, undefined);
    assert.equal(junk.date, undefined);
    assert.equal(junk.clientId, undefined);
  });

  it('monta a query sem parâmetro vazio e volta ao mesmo estado', () => {
    const query = wizardQuery({ step: 2, productId: 'corte', employeeId: undefined, date: '' });
    assert.equal(query, 'step=2&productId=corte');
    assert.deepEqual(params(query), {
      step: 2,
      productId: 'corte',
      employeeId: undefined,
      date: undefined,
      clientId: undefined,
    });
  });

  it('sem nada na URL, começa no serviço', () => {
    const state = resolveWizardSelection(params(''), products, employees);
    assert.equal(state.step, 1);
    assert.equal(state.maxStep, 1);
    assert.equal(state.product, null);
  });

  it('link com o serviço abre direto no profissional', () => {
    const state = resolveWizardSelection(params('productId=barba'), products, employees);
    assert.equal(state.product?.id, 'barba');
    assert.equal(state.step, 2);
  });

  it('"agendar de novo" com serviço e profissional abre no horário', () => {
    const state = resolveWizardSelection(
      params('productId=corte&employeeId=rafael'),
      products,
      employees,
    );
    assert.equal(state.employee?.id, 'rafael');
    assert.equal(state.step, 3);
    assert.equal(state.maxStep, 3);
  });

  it('profissional que não faz o serviço é descartado, e o passo recua', () => {
    const state = resolveWizardSelection(
      params('step=3&productId=barba&employeeId=rafael'),
      products,
      employees,
    );
    assert.equal(state.employee, null);
    assert.equal(state.step, 2);
  });

  it('serviço que não existe mais volta ao começo', () => {
    const state = resolveWizardSelection(
      params('step=3&productId=sumiu&employeeId=marina'),
      products,
      employees,
    );
    assert.equal(state.product, null);
    assert.equal(state.employee, null);
    assert.equal(state.step, 1);
  });

  it('dá para voltar a um passo anterior sem perder as escolhas', () => {
    const state = resolveWizardSelection(
      params('step=1&productId=corte&employeeId=marina'),
      products,
      employees,
    );
    assert.equal(state.step, 1);
    assert.equal(state.maxStep, 3);
    assert.equal(state.employee?.id, 'marina');
  });

  it('data da URL só vale entre hoje e o último dia reservável', () => {
    assert.equal(usableWizardDate('2026-11-12', '2026-11-11', '2027-01-10'), '2026-11-12');
    assert.equal(usableWizardDate('2026-11-10', '2026-11-11', '2027-01-10'), null);
    assert.equal(usableWizardDate('2027-02-01', '2026-11-11', '2027-01-10'), null);
    // O admin não tem teto.
    assert.equal(usableWizardDate('2027-02-01', '2026-11-11'), '2027-02-01');
    assert.equal(usableWizardDate(undefined, '2026-11-11'), null);
  });
});

describe('pausas do expediente no formulário (UX-12)', () => {
  const day = { dayOfWeek: 1, openTime: '09:00', closeTime: '18:00', isClosed: false };

  it('sugere o almoço quando cabe e está livre', () => {
    assert.deepEqual(suggestBreak(day), { start: '12:00', end: '13:00' });
  });

  it('com o almoço ocupado, sugere uma pausa depois da última', () => {
    const next = suggestBreak({ ...day, breaks: [{ start: '12:00', end: '13:00' }] });
    assert.deepEqual(next, { start: '14:00', end: '15:00' });
  });

  it('não sugere em dia fechado, nem além de 4 pausas, nem fora do expediente', () => {
    assert.equal(suggestBreak({ ...day, isClosed: true }), null);
    const four = ['10', '11', '13', '15'].map((h) => ({ start: `${h}:00`, end: `${h}:30` }));
    assert.equal(suggestBreak({ ...day, breaks: four }), null);
    // Manhã curta: 12:00–13:00 não cabe, então a sugestão fica dentro do expediente.
    const morning = suggestBreak({ ...day, openTime: '08:00', closeTime: '12:00' });
    assert.ok(morning && morning.start >= '08:00' && morning.end <= '12:00');
  });

  it('aponta pausa invertida, fora do expediente e sobreposta', () => {
    assert.equal(breaksError({ ...day, breaks: [{ start: '12:00', end: '13:00' }] }), null);
    assert.match(
      breaksError({ ...day, breaks: [{ start: '13:00', end: '12:00' }] }) ?? '',
      /anterior ao fim/,
    );
    assert.match(
      breaksError({ ...day, breaks: [{ start: '08:00', end: '09:30' }] }) ?? '',
      /dentro do horário/,
    );
    assert.match(
      breaksError({
        ...day,
        breaks: [
          { start: '12:00', end: '13:00' },
          { start: '12:30', end: '13:30' },
        ],
      }) ?? '',
      /sobrepor/,
    );
    // Dia fechado não tem pausa para validar.
    assert.equal(
      breaksError({ ...day, isClosed: true, breaks: [{ start: '13:00', end: '12:00' }] }),
      null,
    );
  });

  it('acha o primeiro dia com problema na semana', () => {
    const week = [day, { ...day, dayOfWeek: 2, breaks: [{ start: '19:00', end: '20:00' }] }];
    assert.equal(firstBreaksError(week)?.index, 1);
    assert.equal(firstBreaksError([day]), null);
  });

  it('o que vai para a API: dia fechado sem pausa; pausas do estúdio não viram do profissional', () => {
    const withBreak = { ...day, breaks: [{ start: '12:00', end: '13:00' }], dayName: 'Segunda' };
    assert.deepEqual(toHourPayload(withBreak), {
      dayOfWeek: 1,
      openTime: '09:00',
      closeTime: '18:00',
      isClosed: false,
      breaks: [{ start: '12:00', end: '13:00' }],
    });
    assert.deepEqual(toHourPayload({ ...withBreak, isClosed: true }).breaks, []);
    assert.deepEqual(toHourPayload(withBreak, false).breaks, []);
  });
});
