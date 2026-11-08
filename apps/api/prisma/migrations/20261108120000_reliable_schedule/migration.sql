-- Fase 1 (agenda confiável).

-- DOM-01: histórico das mudanças de status, base das regras de transição e do "Desfazer".
CREATE TABLE "appointment_status_changes" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "fromStatus" "AppointmentStatus" NOT NULL,
    "toStatus" "AppointmentStatus" NOT NULL,
    "actorRole" TEXT NOT NULL,
    "actorId" TEXT,
    "reason" TEXT,
    "revertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_status_changes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "appointment_status_changes_appointmentId_createdAt_idx" ON "appointment_status_changes"("appointmentId", "createdAt");
CREATE INDEX "appointment_status_changes_actorId_idx" ON "appointment_status_changes"("actorId");

ALTER TABLE "appointment_status_changes" ADD CONSTRAINT "appointment_status_changes_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "appointment_status_changes" ADD CONSTRAINT "appointment_status_changes_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- SEC-03: convite para o profissional ligar a própria conta ao cadastro.
CREATE TABLE "employee_invites" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "employee_invites_tokenHash_key" ON "employee_invites"("tokenHash");
CREATE INDEX "employee_invites_employeeId_usedAt_idx" ON "employee_invites"("employeeId", "usedAt");
CREATE INDEX "employee_invites_expiresAt_idx" ON "employee_invites"("expiresAt");

ALTER TABLE "employee_invites" ADD CONSTRAINT "employee_invites_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DOM-07: o expediente padrão do estúdio nasce aqui, e não mais num GET que gravava no banco.
-- Só quando a tabela está vazia, como fazia o GET: um expediente já configurado não muda.
INSERT INTO "business_hours" ("id", "dayOfWeek", "openTime", "closeTime", "isClosed", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, d.day_of_week, d.open_time, d.close_time, d.is_closed, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
  VALUES
    (0, '08:00', '18:00', true),
    (1, '08:00', '18:00', false),
    (2, '08:00', '18:00', false),
    (3, '08:00', '18:00', false),
    (4, '08:00', '18:00', false),
    (5, '08:00', '18:00', false),
    (6, '08:00', '12:00', false)
) AS d(day_of_week, open_time, close_time, is_closed)
WHERE NOT EXISTS (SELECT 1 FROM "business_hours");
