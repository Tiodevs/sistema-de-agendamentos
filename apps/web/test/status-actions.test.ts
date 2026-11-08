import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  cancellationState,
  effectiveAllowed,
  formatDeadline,
  groupActions,
  inlineActions,
  isUndoAvailable,
  needsConfirmation,
  undoToastDuration,
} from '../src/lib/status-actions';

// 14/11/2026 (sábado) às 10:00 em São Paulo (UTC-3).
const NOW = new Date('2026-11-14T13:00:00.000Z');

describe('ações de status na tela (UX-06, DOM-03)', () => {
  it('usa o que a API mandou em allowedStatuses', () => {
    const appointment = {
      status: 'SCHEDULED' as const,
      date: '2026-11-20T13:00:00.000Z',
      allowedStatuses: ['CONFIRMED' as const, 'CANCELLED' as const],
    };
    assert.deepEqual(effectiveAllowed(appointment, 'ADMIN', NOW), ['CONFIRMED', 'CANCELLED']);
    assert.deepEqual(effectiveAllowed({ ...appointment, allowedStatuses: [] }, 'ADMIN', NOW), []);
  });

  it('sem allowedStatuses (API antiga), cai na regra anterior por papel', () => {
    const scheduled = { status: 'SCHEDULED' as const, date: '2026-11-20T13:00:00.000Z' };
    assert.equal(effectiveAllowed(scheduled, 'ADMIN', NOW).length, 5);
    assert.deepEqual(effectiveAllowed(scheduled, 'EMPLOYEE', NOW), ['CONFIRMED']);
    assert.deepEqual(effectiveAllowed(scheduled, 'CLIENT', NOW), ['CANCELLED']);
    assert.deepEqual(
      effectiveAllowed({ ...scheduled, date: '2026-11-13T13:00:00.000Z' }, 'CLIENT', NOW),
      [],
    );
    assert.deepEqual(effectiveAllowed({ ...scheduled, status: 'COMPLETED' }, 'EMPLOYEE', NOW), []);
  });

  it('cancelar e registrar falta pedem confirmação; o resto aplica direto', () => {
    assert.equal(needsConfirmation('CANCELLED'), true);
    assert.equal(needsConfirmation('NO_SHOW'), true);
    assert.equal(needsConfirmation('CONFIRMED'), false);
    assert.equal(needsConfirmation('COMPLETED'), false);
  });

  it('separa avançar e encerrar, na ordem do atendimento', () => {
    assert.deepEqual(groupActions(['CANCELLED', 'COMPLETED', 'NO_SHOW', 'CONFIRMED']), {
      progress: ['CONFIRMED', 'COMPLETED'],
      destructive: ['NO_SHOW', 'CANCELLED'],
    });
  });

  it('na linha do profissional, "Confirmar" sai quando já dá para iniciar ou concluir', () => {
    assert.deepEqual(inlineActions(['CONFIRMED', 'CANCELLED']), ['CONFIRMED']);
    assert.deepEqual(inlineActions(['CONFIRMED', 'IN_PROGRESS']), ['IN_PROGRESS']);
    assert.deepEqual(inlineActions(['CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'NO_SHOW']), [
      'IN_PROGRESS',
      'COMPLETED',
    ]);
    assert.deepEqual(inlineActions(['NO_SHOW']), []);
  });
});

describe('desfazer (UX-06)', () => {
  it('só enquanto o prazo não venceu', () => {
    assert.equal(isUndoAvailable('2026-11-14T13:05:00.000Z', NOW), true);
    assert.equal(isUndoAvailable('2026-11-14T12:59:59.000Z', NOW), false);
    assert.equal(isUndoAvailable(null, NOW), false);
    assert.equal(isUndoAvailable(undefined, NOW), false);
  });

  it('o toast fica até o prazo, no máximo 10 s', () => {
    assert.equal(undoToastDuration('2026-11-14T13:05:00.000Z', NOW), 10_000);
    assert.equal(undoToastDuration('2026-11-14T13:00:04.000Z', NOW), 4_000);
    assert.equal(undoToastDuration(null, NOW), 0);
  });
});

describe('prazo de cancelamento do cliente (DOM-09)', () => {
  const upcoming = {
    status: 'CONFIRMED' as const,
    date: '2026-11-20T13:00:00.000Z',
    cancellableUntil: '2026-11-20T11:00:00.000Z',
  };

  it('dentro do prazo: pode cancelar e mostra até quando', () => {
    assert.deepEqual(
      cancellationState({ ...upcoming, allowedStatuses: ['CANCELLED'] }, 'CLIENT', NOW),
      { kind: 'allowed', until: '2026-11-20T11:00:00.000Z' },
    );
  });

  it('prazo vencido, mas o horário ainda vai acontecer: só pelo estúdio', () => {
    assert.deepEqual(cancellationState({ ...upcoming, allowedStatuses: [] }, 'CLIENT', NOW), {
      kind: 'studio-only',
    });
  });

  it('horário que já passou, terminou ou foi cancelado: nada a oferecer', () => {
    assert.deepEqual(
      cancellationState(
        { ...upcoming, date: '2026-11-13T13:00:00.000Z', allowedStatuses: [] },
        'CLIENT',
        NOW,
      ),
      { kind: 'none' },
    );
    assert.deepEqual(
      cancellationState({ ...upcoming, status: 'CANCELLED', allowedStatuses: [] }, 'CLIENT', NOW),
      { kind: 'none' },
    );
  });
});

describe('formato do prazo (horário de São Paulo)', () => {
  it('hoje e amanhã por extenso', () => {
    assert.equal(formatDeadline('2026-11-14T17:00:00.000Z', NOW), 'hoje às 14:00');
    assert.equal(formatDeadline('2026-11-15T12:30:00.000Z', NOW), 'amanhã às 09:30');
  });

  it('outros dias com dia da semana e data', () => {
    const text = formatDeadline('2026-11-20T15:00:00.000Z', NOW);
    assert.match(text, /^sex, 20\/11 às 12:00$/);
  });

  it('a virada do dia segue São Paulo, não UTC', () => {
    // 15/11 01:30 UTC = 14/11 22:30 em São Paulo: ainda é "hoje".
    assert.equal(formatDeadline('2026-11-15T01:30:00.000Z', NOW), 'hoje às 22:30');
  });
});
