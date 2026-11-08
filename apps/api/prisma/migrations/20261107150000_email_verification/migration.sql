-- SEC-02: o cliente só reserva depois de confirmar o e-mail.
-- As contas que já existem ficam confirmadas, para ninguém perder o acesso à agenda.
ALTER TABLE "users" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

UPDATE "users" SET "emailVerifiedAt" = "createdAt" WHERE "emailVerifiedAt" IS NULL;
