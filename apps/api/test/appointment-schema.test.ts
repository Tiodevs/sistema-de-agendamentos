import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  availabilitySlotsSchema,
  listAppointmentsQuerySchema,
  myAppointmentsQuerySchema,
  professionalAppointmentsQuerySchema,
} from '../src/schemas/appointment.schema';

describe('validação das queries de agendamento (SEC-05)', () => {
  it('disponibilidade recusa datas que não existem', () => {
    for (const date of ['2026-13-45', '2026-02-29', '2026-11-31', '20261107', 'amanhã']) {
      const result = availabilitySlotsSchema.safeParse({ employeeId: 'e', productId: 'p', date });
      assert.equal(result.success, false, date);
    }
    assert.equal(
      availabilitySlotsSchema.safeParse({ employeeId: 'e', productId: 'p', date: '2028-02-29' })
        .success,
      true,
    );
  });

  it('status fora do enum ou repetido na query volta erro', () => {
    assert.equal(myAppointmentsQuerySchema.safeParse({ status: 'DELETED' }).success, false);
    assert.equal(
      myAppointmentsQuerySchema.safeParse({ status: ['SCHEDULED', 'NO_SHOW'] }).success,
      false,
    );
    assert.equal(myAppointmentsQuerySchema.safeParse({ status: 'NO_SHOW' }).success, true);
  });

  it('from/to aceitam dia ou instante ISO e recusam o resto', () => {
    assert.equal(listAppointmentsQuerySchema.safeParse({ from: '2026-13-01' }).success, false);
    assert.equal(listAppointmentsQuerySchema.safeParse({ to: 'ontem' }).success, false);
    assert.equal(listAppointmentsQuerySchema.safeParse({ from: '1' }).success, false);

    const parsed = listAppointmentsQuerySchema.parse({
      from: '2026-11-07T13:00:00.000Z',
      to: '2026-11-08T10:00:00-03:00',
    });
    assert.equal(parsed.from?.toISOString(), '2026-11-07T13:00:00.000Z');
    assert.equal(parsed.to?.toISOString(), '2026-11-08T13:00:00.000Z');
  });

  it('um dia em from/to cobre o dia inteiro no fuso de São Paulo', () => {
    const parsed = professionalAppointmentsQuerySchema.parse({
      from: '2026-11-07',
      to: '2026-11-07',
    });
    assert.equal(parsed.from?.toISOString(), '2026-11-07T03:00:00.000Z');
    assert.equal(parsed.to?.toISOString(), '2026-11-08T02:59:59.999Z');
  });
});
