import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  NOTES_MAX_LENGTH,
  employeesForProduct,
  formatSlotDate,
  formatSlotTime,
  offersProduct,
  slotDateKey,
  slotsForDate,
} from '../src/lib/booking-wizard';

describe('assistente de agendamento (ARQ-07, UX-01)', () => {
  it('o dia do horário segue o fuso do estúdio, não o UTC', () => {
    // 23:30 em São Paulo ainda é dia 10, embora já seja dia 11 em UTC.
    assert.equal(slotDateKey('2026-11-11T02:30:00.000Z'), '2026-11-10');
    assert.equal(slotDateKey('2026-11-11T12:00:00.000Z'), '2026-11-11');
    assert.equal(formatSlotDate('2026-11-11T02:30:00.000Z'), '10/11/2026');
    assert.equal(formatSlotTime('2026-11-11T12:00:00.000Z'), '09:00');
  });

  it('a grade só aceita horários do dia pedido', () => {
    const slots = [
      { start: '2026-11-10T12:00:00.000Z', available: true },
      { start: '2026-11-11T12:00:00.000Z', available: true },
      { start: '2026-11-11T13:00:00.000Z', available: false },
    ];
    assert.deepEqual(
      slotsForDate(slots, '2026-11-11').map((slot) => slot.start),
      ['2026-11-11T12:00:00.000Z', '2026-11-11T13:00:00.000Z'],
    );
    assert.deepEqual(slotsForDate(slots, '2026-11-12'), []);
  });

  it('os profissionais vêm da lista já carregada, filtrados pelo serviço', () => {
    const ana = {
      id: 'ana',
      products: [{ product: { id: 'corte' } }, { product: { id: 'barba' } }],
    };
    const bia = { id: 'bia', products: [{ product: { id: 'barba' } }] };
    const all = [ana, bia];

    assert.deepEqual(
      employeesForProduct(all, 'corte').map((employee) => employee.id),
      ['ana'],
    );
    assert.deepEqual(
      employeesForProduct(all, 'barba').map((employee) => employee.id),
      ['ana', 'bia'],
    );
    assert.deepEqual(employeesForProduct(all, null), []);
    // Voltar ao passo 1 e escolher o mesmo serviço não perde ninguém: a lista original fica igual.
    assert.equal(all.length, 2);
    assert.equal(offersProduct(bia, 'corte'), false);
  });

  it('o teto da observação é o mesmo da API', () => {
    assert.equal(NOTES_MAX_LENGTH, 500);
  });
});
