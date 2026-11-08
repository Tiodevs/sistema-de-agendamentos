import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  APPOINTMENT_STATUS_VALUES,
  FINAL_STATUSES,
  UNDO_WINDOW_MINUTES,
  allowedTransitions,
  checkTransition,
  checkUndo,
  undoDeadline,
  type AppointmentStatusValue,
  type StatusActor,
} from '../src/lib/appointment-status';

const NOTICE = 120; // 2h, o padrão de CANCELLATION_NOTICE_HOURS
const START = new Date('2026-11-20T14:00:00-03:00');
const minutes = (value: number) => new Date(START.getTime() + value * 60_000);
const DAY_BEFORE = minutes(-24 * 60);
const AFTER_START = minutes(10);

function check(
  from: AppointmentStatusValue,
  to: AppointmentStatusValue,
  actor: StatusActor,
  now: Date,
) {
  return checkTransition({ from, to, actor, start: START, cancellationNoticeMinutes: NOTICE, now });
}

describe('máquina de estados do agendamento (DOM-01)', () => {
  it('cancelado, concluído e falta são finais para todo mundo', () => {
    for (const from of FINAL_STATUSES) {
      for (const to of APPOINTMENT_STATUS_VALUES) {
        for (const actor of ['ADMIN', 'EMPLOYEE', 'CLIENT'] as const) {
          assert.equal(check(from, to, actor, AFTER_START).ok, false, `${from} → ${to} (${actor})`);
        }
      }
    }
  });

  it('reativar um cancelado volta 409 com mensagem (o cenário da auditoria)', () => {
    const result = check('CANCELLED', 'CONFIRMED', 'EMPLOYEE', DAY_BEFORE);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.statusCode, 409);
      assert.equal(result.code, 'FINAL_STATUS');
    }
  });

  it('ninguém volta um agendamento para "agendado"', () => {
    for (const from of ['CONFIRMED', 'IN_PROGRESS'] as const) {
      assert.equal(check(from, 'SCHEDULED', 'ADMIN', AFTER_START).ok, false);
    }
  });

  it('concluir e registrar falta só depois do início', () => {
    for (const to of ['COMPLETED', 'NO_SHOW'] as const) {
      const early = check('CONFIRMED', to, 'ADMIN', minutes(-1));
      assert.equal(early.ok, false);
      if (!early.ok) assert.equal(early.code, 'TOO_EARLY');
      assert.equal(check('CONFIRMED', to, 'ADMIN', minutes(0)).ok, true);
      assert.equal(check('CONFIRMED', to, 'EMPLOYEE', AFTER_START).ok, true);
    }
  });

  it('iniciar vale a partir de 1h antes do horário', () => {
    assert.equal(check('SCHEDULED', 'IN_PROGRESS', 'EMPLOYEE', minutes(-61)).ok, false);
    assert.equal(check('SCHEDULED', 'IN_PROGRESS', 'EMPLOYEE', minutes(-60)).ok, true);
  });

  it('um atendimento da semana que vem não pode ser concluído', () => {
    const result = check('SCHEDULED', 'COMPLETED', 'EMPLOYEE', minutes(-7 * 24 * 60));
    assert.equal(result.ok, false);
  });

  it('o mesmo status volta 409 SAME_STATUS', () => {
    const result = check('CONFIRMED', 'CONFIRMED', 'ADMIN', DAY_BEFORE);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'SAME_STATUS');
  });
});

describe('cancelamento com antecedência mínima (DOM-03, DOM-09)', () => {
  it('cliente e profissional cancelam até 2h antes; depois, não', () => {
    for (const actor of ['CLIENT', 'EMPLOYEE'] as const) {
      assert.equal(check('SCHEDULED', 'CANCELLED', actor, minutes(-121)).ok, true, actor);
      const late = check('SCHEDULED', 'CANCELLED', actor, minutes(-119));
      assert.equal(late.ok, false, actor);
      if (!late.ok) assert.equal(late.code, 'CANCELLATION_WINDOW_CLOSED');
    }
  });

  it('o admin cancela a qualquer momento, até com o atendimento em andamento', () => {
    assert.equal(check('CONFIRMED', 'CANCELLED', 'ADMIN', minutes(-5)).ok, true);
    assert.equal(check('IN_PROGRESS', 'CANCELLED', 'ADMIN', AFTER_START).ok, true);
  });

  it('com o atendimento em andamento, só o admin cancela', () => {
    const result = check('IN_PROGRESS', 'CANCELLED', 'EMPLOYEE', AFTER_START);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.statusCode, 403);
  });

  it('o cliente só cancela: não confirma, não conclui, não registra falta', () => {
    for (const to of ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'NO_SHOW'] as const) {
      const result = check('SCHEDULED', to, 'CLIENT', AFTER_START);
      assert.equal(result.ok, false, to);
      if (!result.ok) assert.equal(result.statusCode, 403, to);
    }
  });

  it('com antecedência zero, o cliente cancela até o início', () => {
    const result = checkTransition({
      from: 'CONFIRMED',
      to: 'CANCELLED',
      actor: 'CLIENT',
      start: START,
      cancellationNoticeMinutes: 0,
      now: minutes(-1),
    });
    assert.equal(result.ok, true);
  });
});

describe('menu de status (allowedTransitions)', () => {
  it('na véspera, o profissional confirma ou cancela', () => {
    assert.deepEqual(
      allowedTransitions({
        from: 'SCHEDULED',
        actor: 'EMPLOYEE',
        start: START,
        cancellationNoticeMinutes: NOTICE,
        now: DAY_BEFORE,
      }),
      ['CONFIRMED', 'CANCELLED'],
    );
  });

  it('depois do início, o profissional inicia, conclui ou registra falta', () => {
    assert.deepEqual(
      allowedTransitions({
        from: 'CONFIRMED',
        actor: 'EMPLOYEE',
        start: START,
        cancellationNoticeMinutes: NOTICE,
        now: AFTER_START,
      }),
      ['IN_PROGRESS', 'COMPLETED', 'NO_SHOW'],
    );
  });

  it('para o cliente, só "cancelar" dentro do prazo', () => {
    const base = { from: 'CONFIRMED' as const, actor: 'CLIENT' as const, start: START };
    assert.deepEqual(
      allowedTransitions({ ...base, cancellationNoticeMinutes: NOTICE, now: DAY_BEFORE }),
      ['CANCELLED'],
    );
    assert.deepEqual(
      allowedTransitions({ ...base, cancellationNoticeMinutes: NOTICE, now: minutes(-30) }),
      [],
    );
  });

  it('status final não oferece nada', () => {
    assert.deepEqual(
      allowedTransitions({
        from: 'COMPLETED',
        actor: 'ADMIN',
        start: START,
        cancellationNoticeMinutes: NOTICE,
        now: AFTER_START,
      }),
      [],
    );
  });
});

describe('desfazer (UX-06)', () => {
  const change = {
    fromStatus: 'CONFIRMED' as const,
    toStatus: 'COMPLETED' as const,
    actorId: 'admin-1',
    createdAt: AFTER_START,
    revertedAt: null,
  };

  it('quem fez desfaz dentro da janela', () => {
    const now = new Date(AFTER_START.getTime() + 60_000);
    assert.equal(
      checkUndo({ change, currentStatus: 'COMPLETED', actorId: 'admin-1', now }).ok,
      true,
    );
  });

  it('outra pessoa não desfaz', () => {
    const result = checkUndo({
      change,
      currentStatus: 'COMPLETED',
      actorId: 'admin-2',
      now: AFTER_START,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.statusCode, 403);
  });

  it('depois da janela, não', () => {
    const now = new Date(AFTER_START.getTime() + (UNDO_WINDOW_MINUTES + 1) * 60_000);
    const result = checkUndo({ change, currentStatus: 'COMPLETED', actorId: 'admin-1', now });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'UNDO_EXPIRED');
  });

  it('cancelamento não se desfaz', () => {
    const cancelled = { ...change, toStatus: 'CANCELLED' as const };
    const result = checkUndo({
      change: cancelled,
      currentStatus: 'CANCELLED',
      actorId: 'admin-1',
      now: AFTER_START,
    });
    assert.equal(result.ok, false);
    assert.equal(undoDeadline(cancelled), null);
  });

  it('mudança já desfeita ou que não é a atual não se desfaz de novo', () => {
    assert.equal(
      checkUndo({
        change: { ...change, revertedAt: AFTER_START },
        currentStatus: 'COMPLETED',
        actorId: 'admin-1',
        now: AFTER_START,
      }).ok,
      false,
    );
    assert.equal(
      checkUndo({ change, currentStatus: 'CONFIRMED', actorId: 'admin-1', now: AFTER_START }).ok,
      false,
    );
  });
});
