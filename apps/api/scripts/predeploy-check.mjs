#!/usr/bin/env node
// Checagem de pre-deploy, só de leitura, que roda antes do `prisma migrate deploy` (Railway:
// `npm run db:deploy --workspace=api`). Roda dentro da rede do Railway com o DATABASE_URL do
// serviço, então nenhuma credencial sai de lá.
//
// - DOM-05: sem a trava `appointments_employee_no_overlap` e com agendamentos ativos sobrepostos,
//   a migration 20261107150100 falharia no meio do deploy, depois de aplicar as anteriores. Aqui o
//   deploy para antes de qualquer migration e os conflitos vão para o log (só ids, sem dados de
//   cliente).
// - Uma migration marcada como falha também para o deploy, com o nome no log.
import pg from 'pg';

const CONFLICT_FILTER = `
  FROM appointments a
  JOIN appointments b
    ON a."employeeId" = b."employeeId"
   AND a.id < b.id
   AND tsrange(a."date", a."endDate", '[)') && tsrange(b."date", b."endDate", '[)')
  WHERE a.status NOT IN ('CANCELLED', 'NO_SHOW')
    AND b.status NOT IN ('CANCELLED', 'NO_SHOW')`;

async function check(client) {
  const {
    rows: [tables],
  } = await client.query(
    `SELECT to_regclass('public.appointments') IS NOT NULL AS has_appointments,
            to_regclass('public._prisma_migrations') IS NOT NULL AS has_migrations`,
  );
  if (!tables.has_appointments) {
    console.log('[predeploy] Banco sem a tabela de agendamentos: nada a checar.');
    return 0;
  }

  const {
    rows: [constraint],
  } = await client.query(
    `SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_employee_no_overlap') AS present`,
  );

  let conflictCount = 0;
  let conflicts = [];
  if (!constraint.present) {
    const { rows } = await client.query(`SELECT count(*)::int AS total ${CONFLICT_FILTER}`);
    conflictCount = rows[0].total;
    if (conflictCount > 0) {
      conflicts = (
        await client.query(
          `SELECT a.id AS first_id, b.id AS second_id, a."employeeId" AS employee_id,
                  a."date" AS first_start, b."date" AS second_start
           ${CONFLICT_FILTER}
           ORDER BY a."date"
           LIMIT 20`,
        )
      ).rows;
    }
  }

  const failed = tables.has_migrations
    ? (
        await client.query(
          `SELECT migration_name FROM _prisma_migrations
           WHERE finished_at IS NULL AND rolled_back_at IS NULL
           ORDER BY started_at`,
        )
      ).rows.map((row) => row.migration_name)
    : [];

  console.log(
    `[predeploy] Trava de sobreposição: ${constraint.present ? 'presente' : 'ausente'}. ` +
      `Pares de agendamentos ativos sobrepostos: ${conflictCount}. Migrations com falha: ${failed.length}.`,
  );

  if (conflictCount > 0) {
    console.error(
      '[predeploy] Deploy parado antes das migrations (DOM-05): cancele ou remarque um dos ' +
        'agendamentos de cada par abaixo e faça o deploy de novo.',
    );
    for (const row of conflicts) {
      console.error(
        `  ${row.first_id} x ${row.second_id} (profissional ${row.employee_id}; ` +
          `${new Date(row.first_start).toISOString()} / ${new Date(row.second_start).toISOString()})`,
      );
    }
    if (conflictCount > conflicts.length) {
      console.error(`  … e mais ${conflictCount - conflicts.length} par(es).`);
    }
    return 1;
  }

  if (failed.length > 0) {
    console.error(
      `[predeploy] Migration marcada como falha: ${failed.join(', ')}. ` +
        'Resolva com `prisma migrate resolve` antes de subir.',
    );
    return 1;
  }

  return 0;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('[predeploy] DATABASE_URL ausente.');
    return 1;
  }

  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query('BEGIN READ ONLY');
    return await check(client);
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    await client.end();
  }
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(
      '[predeploy] A checagem falhou:',
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  },
);
