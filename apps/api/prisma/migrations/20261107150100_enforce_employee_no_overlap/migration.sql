-- DOM-05: garante a trava contra dois agendamentos ativos do mesmo profissional no mesmo horário.
-- A migration 20260913210000 engolia o erro quando já havia sobreposição: marcava como aplicada
-- sem criar a constraint. Esta falha de propósito, com a contagem, até os conflitos serem resolvidos.
--
-- Para listar os conflitos antes do deploy:
--   SELECT a.id, b.id, a."employeeId", a."date", a."endDate", b."date", b."endDate"
--   FROM appointments a
--   JOIN appointments b ON a."employeeId" = b."employeeId" AND a.id < b.id
--    AND tsrange(a."date", a."endDate", '[)') && tsrange(b."date", b."endDate", '[)')
--   WHERE a.status NOT IN ('CANCELLED', 'NO_SHOW') AND b.status NOT IN ('CANCELLED', 'NO_SHOW');

CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
DECLARE
  conflict_count integer;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_employee_no_overlap') THEN
    RETURN;
  END IF;

  SELECT count(*) INTO conflict_count
  FROM appointments a
  JOIN appointments b
    ON a."employeeId" = b."employeeId"
   AND a.id < b.id
   AND tsrange(a."date", a."endDate", '[)') && tsrange(b."date", b."endDate", '[)')
  WHERE a.status NOT IN ('CANCELLED', 'NO_SHOW')
    AND b.status NOT IN ('CANCELLED', 'NO_SHOW');

  IF conflict_count > 0 THEN
    RAISE EXCEPTION
      'appointments_employee_no_overlap: % par(es) de agendamentos ativos se sobrepõem. Resolva (cancele ou remarque) e rode a migration de novo; a consulta está no topo deste arquivo.',
      conflict_count;
  END IF;

  ALTER TABLE "appointments"
    ADD CONSTRAINT "appointments_employee_no_overlap"
    EXCLUDE USING gist (
      "employeeId" WITH =,
      tsrange("date", "endDate", '[)') WITH &&
    )
    WHERE (status NOT IN ('CANCELLED', 'NO_SHOW'));
END $$;
