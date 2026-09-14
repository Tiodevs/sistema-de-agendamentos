CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  ALTER TABLE "appointments"
    ADD CONSTRAINT "appointments_employee_no_overlap"
    EXCLUDE USING gist (
      "employeeId" WITH =,
      tsrange("date", "endDate", '[)') WITH &&
    )
    WHERE (status NOT IN ('CANCELLED', 'NO_SHOW'));
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
  WHEN exclusion_violation THEN
    RAISE NOTICE 'Constraint appointments_employee_no_overlap skipped because overlapping rows already exist';
END $$;
