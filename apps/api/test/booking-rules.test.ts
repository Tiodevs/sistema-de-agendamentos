import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { isBeyondBookingWindow, lastBookableDateKey } from '../src/lib/booking-rules';

// 07/11/2026 às 23:30 em São Paulo (08/11 02:30 UTC): o "hoje" é o dia de São Paulo, não o do UTC.
const NOW = new Date('2026-11-08T02:30:00.000Z');

describe('janela de antecedência da reserva (SEC-02)', () => {
  it('o último dia é hoje + 60, no calendário de São Paulo', () => {
    assert.equal(lastBookableDateKey(NOW), '2027-01-06');
  });

  it('qualquer horário do último dia vale; o dia seguinte não', () => {
    assert.equal(isBeyondBookingWindow(new Date('2027-01-06T22:00:00-03:00'), NOW), false);
    assert.equal(isBeyondBookingWindow(new Date('2027-01-07T08:00:00-03:00'), NOW), true);
  });
});
