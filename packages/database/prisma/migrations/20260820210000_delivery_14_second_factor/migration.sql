-- Delivery 14 — second factor with TOTP.
--
-- Forward-only. The shared secret is stored encrypted by the application (AES-256-GCM); the
-- column holds ciphertext, never the secret itself. Recovery codes follow the invitation and
-- password-reset mechanics: single use, stored only as a hash.

ALTER TABLE "organizations"
  ADD COLUMN "require_second_factor" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "users"
  ADD COLUMN "totp_secret" VARCHAR(255),
  ADD COLUMN "totp_activated_at" TIMESTAMPTZ(6),
  ADD COLUMN "totp_last_step" BIGINT;

-- Ativado exige segredo: um usuario ativo sem segredo nao teria como gerar codigo, e o
-- banco recusa esse estado em vez de deixar a aplicacao descobrir depois.
ALTER TABLE "users"
  ADD CONSTRAINT "users_totp_activation_consistent"
  CHECK ("totp_activated_at" IS NULL OR "totp_secret" IS NOT NULL);

CREATE INDEX "users_organization_id_totp_activated_at_idx"
  ON "users" ("organization_id", "totp_activated_at");

CREATE TABLE "totp_recovery_codes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "code_hash" VARCHAR(64) NOT NULL,
  "used_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "totp_recovery_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "totp_recovery_codes_code_hash_key" ON "totp_recovery_codes" ("code_hash");
CREATE UNIQUE INDEX "totp_recovery_codes_organization_id_id_key"
  ON "totp_recovery_codes" ("organization_id", "id");
CREATE INDEX "totp_recovery_codes_organization_id_user_id_used_at_idx"
  ON "totp_recovery_codes" ("organization_id", "user_id", "used_at");

ALTER TABLE "totp_recovery_codes"
  ADD CONSTRAINT "totp_recovery_codes_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Chave composta com o tenant: um codigo nunca pode pertencer a usuario de outra organizacao.
ALTER TABLE "totp_recovery_codes"
  ADD CONSTRAINT "totp_recovery_codes_organization_id_user_id_fkey"
  FOREIGN KEY ("organization_id", "user_id") REFERENCES "users" ("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
