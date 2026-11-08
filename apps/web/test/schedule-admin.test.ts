import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  affectedTitle,
  countAppointments,
  formatAffectedWhen,
  impactMessage,
} from '../src/lib/affected-appointments';
import { describeAccess } from '../src/lib/employee-access';
import { splitSpecialDays } from '../src/lib/special-days';

describe('agendamentos afetados (DOM-02)', () => {
  it('conta no singular e no plural', () => {
    assert.equal(countAppointments(1), '1 agendamento');
    assert.equal(countAppointments(3), '3 agendamentos');
    assert.equal(affectedTitle(1), '1 agendamento afetado');
    assert.equal(affectedTitle(2), '2 agendamentos afetados');
  });

  it('mostra dia e hora no fuso de São Paulo', () => {
    // 13:00 UTC = 10:00 em Brasília; 01:30 UTC do dia 25 ainda é 24/12 em Brasília.
    assert.equal(formatAffectedWhen('2026-12-24T13:00:00.000Z'), 'Qui 24/12 · 10:00');
    assert.equal(formatAffectedWhen('2026-12-25T01:30:00.000Z'), 'Qui 24/12 · 22:30');
  });

  it('o toast diz o que aconteceu com os afetados', () => {
    assert.equal(impactMessage('Dia fechado.'), 'Dia fechado.');
    assert.equal(impactMessage('Dia fechado.', { affected: 0, cancelled: 0 }), 'Dia fechado.');
    assert.equal(
      impactMessage('Dia fechado.', { affected: 3, cancelled: 3 }),
      'Dia fechado. 3 agendamentos cancelados e clientes avisados.',
    );
    assert.equal(
      impactMessage('Dia fechado.', { affected: 1, cancelled: 1 }),
      'Dia fechado. 1 agendamento cancelado e cliente avisado.',
    );
    assert.equal(
      impactMessage('Horários salvos.', { affected: 2, cancelled: 0 }),
      'Horários salvos. 2 agendamentos mantidos fora do novo horário: confira na agenda.',
    );
    assert.equal(
      impactMessage(
        'Profissional desativado.',
        { affected: 1, cancelled: 0 },
        'com o profissional desativado',
      ),
      'Profissional desativado. 1 agendamento mantido com o profissional desativado: confira na agenda.',
    );
  });
});

describe('acesso do profissional ao painel (SEC-03)', () => {
  const now = new Date('2026-11-08T12:00:00.000Z');

  it('conta ligada mostra o e-mail e permite remover', () => {
    const view = describeAccess({ status: 'linked', email: 'ana@exemplo.com' }, now);
    assert.equal(view.label, 'Com acesso ao painel');
    assert.equal(view.detail, 'ana@exemplo.com');
    assert.equal(view.inviteLabel, null);
    assert.equal(view.revokeLabel, 'Remover acesso');
  });

  it('convite pendente mostra o prazo e permite reenviar ou cancelar', () => {
    const view = describeAccess(
      {
        status: 'pending',
        sentAt: '2026-11-07T12:00:00.000Z',
        expiresAt: '2026-11-14T12:00:00.000Z',
      },
      now,
    );
    assert.equal(view.label, 'Convite pendente até 14/11');
    assert.equal(view.tone, 'pending');
    assert.equal(view.inviteLabel, 'Reenviar convite');
    assert.equal(view.revokeLabel, 'Cancelar convite');
  });

  it('pendente que venceu com a página aberta vira expirado', () => {
    const view = describeAccess(
      {
        status: 'pending',
        sentAt: '2026-10-30T12:00:00.000Z',
        expiresAt: '2026-11-06T12:00:00.000Z',
      },
      now,
    );
    assert.equal(view.label, 'Convite expirado');
    assert.equal(view.detail, 'Venceu em 06/11');
    assert.equal(view.revokeLabel, null);
  });

  it('sem convite (ou sem dado de acesso) oferece enviar', () => {
    assert.equal(describeAccess({ status: 'none' }, now).label, 'Sem acesso ao painel');
    assert.equal(describeAccess(undefined, now).inviteLabel, 'Enviar convite');
  });
});

describe('dias especiais próximos e passados (UX-05)', () => {
  const days = [
    { id: 'a', date: '2026-11-07' },
    { id: 'b', date: '2026-11-08' },
    { id: 'c', date: '2026-12-24T00:00:00.000Z' },
  ];

  it('o dia de hoje (em São Paulo) ainda é "próximo"', () => {
    const { upcoming, past } = splitSpecialDays(days, '2026-11-08');
    assert.deepEqual(
      upcoming.map((day) => day.id),
      ['b', 'c'],
    );
    assert.deepEqual(
      past.map((day) => day.id),
      ['a'],
    );
  });

  it('depois das 21h em Brasília continua valendo o dia de lá, não o UTC', () => {
    // 23h de 08/11 em Brasília = 02h de 09/11 em UTC; o "hoje" passado é o de São Paulo.
    const { upcoming } = splitSpecialDays(days, '2026-11-08');
    assert.ok(upcoming.some((day) => day.id === 'b'));
  });
});
