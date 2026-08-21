-- Delivery 13 — password recovery.
--
-- Forward-only. Same mechanics as the invitation: an opaque token stored only as a SHA-256
-- hash, single use, with an expiry. The difference is the recipient — here the person is
-- already active, and completing the reset revokes every session they hold.

CREATE TABLE "password_reset_requests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "token_hash" VARCHAR(64) NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "used_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "password_reset_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "password_reset_requests_token_hash_key"
  ON "password_reset_requests" ("token_hash");
CREATE UNIQUE INDEX "password_reset_requests_organization_id_id_key"
  ON "password_reset_requests" ("organization_id", "id");
CREATE INDEX "password_reset_requests_organization_id_user_id_idx"
  ON "password_reset_requests" ("organization_id", "user_id");
CREATE INDEX "password_reset_requests_expires_at_idx"
  ON "password_reset_requests" ("expires_at");

ALTER TABLE "password_reset_requests"
  ADD CONSTRAINT "password_reset_requests_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Chave composta com o tenant: um pedido nunca pode apontar para usuario de outra
-- organizacao, e o banco recusa em vez de depender da aplicacao lembrar.
ALTER TABLE "password_reset_requests"
  ADD CONSTRAINT "password_reset_requests_organization_id_user_id_fkey"
  FOREIGN KEY ("organization_id", "user_id") REFERENCES "users" ("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Caixa de saida de e-mail. A API grava a intencao na mesma transacao do fato que a origina;
-- o worker drena. Handler HTTP nunca abre conexao SMTP.
CREATE TYPE "email_outbox_status" AS ENUM ('PENDING', 'SENT', 'FAILED');

CREATE TABLE "email_outbox" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "template_id" VARCHAR(64) NOT NULL,
  "recipient" VARCHAR(320) NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "status" "email_outbox_status" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "last_error" VARCHAR(500),
  "sent_at" TIMESTAMPTZ(6),
  "provider_message_id" VARCHAR(255),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "email_outbox_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "email_outbox_attempts_nonnegative" CHECK ("attempts" >= 0),
  -- Enviado carrega o instante; pendente e falho, nunca.
  CONSTRAINT "email_outbox_sent_consistent"
    CHECK (("status" = 'SENT') = ("sent_at" IS NOT NULL))
);

CREATE UNIQUE INDEX "email_outbox_organization_id_id_key" ON "email_outbox" ("organization_id", "id");
CREATE INDEX "email_outbox_status_created_at_idx" ON "email_outbox" ("status", "created_at");

ALTER TABLE "email_outbox"
  ADD CONSTRAINT "email_outbox_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "email_outbox"
  ADD CONSTRAINT "email_outbox_organization_id_user_id_fkey"
  FOREIGN KEY ("organization_id", "user_id") REFERENCES "users" ("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
