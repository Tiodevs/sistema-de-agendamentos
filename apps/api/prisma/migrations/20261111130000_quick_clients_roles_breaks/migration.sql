-- Fase 3 (refatoração e experiência).

-- ARQ-04: o papel da conta vira enum, e o banco passa a recusar valor fora da lista.
-- O pre-deploy (scripts/predeploy-check.mjs) para o deploy antes daqui se existir papel inválido.
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN', 'EMPLOYEE');

ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role" USING ("role"::"Role");
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'USER';

-- UX-03: "cliente rápido" cadastrado pela recepção, sem e-mail e sem senha.
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;

-- UX-12: pausas por dia (almoço) no estúdio e por profissional, e respiro entre atendimentos.
ALTER TABLE "business_hours" ADD COLUMN "breaks" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "employee_business_hours" ADD COLUMN "breaks" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "employees" ADD COLUMN "bufferMinutes" INTEGER NOT NULL DEFAULT 0;
