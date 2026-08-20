-- Delivery 12 — organization onboarding and user administration.
--
-- Forward-only. Two additions:
--   1. organizations.slug, the human-readable identity that replaces the UUID at sign-in;
--   2. user_invitations, the single-use hashed invitation that moves a user to ACTIVE.

-- The slug is derived from the existing trade name for rows that already exist, then made
-- mandatory. Doing it in three steps keeps the column NOT NULL without a table rewrite that
-- fails on a populated database.
ALTER TABLE "organizations" ADD COLUMN "slug" VARCHAR(63);

-- translate() em vez de unaccent(): a extensao nao esta instalada e uma migracao nao
-- deveria passar a depender de uma. O sufixo hexadecimal garante unicidade sem consultar as
-- outras linhas, e o coalesce cobre um nome comercial sem nenhum caractere aproveitavel.
UPDATE "organizations"
SET "slug" = left(
  coalesce(
    nullif(
      regexp_replace(
        regexp_replace(
          lower(translate("trade_name",
            'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
            'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')),
          '[^a-z0-9]+', '-', 'g'),
        '(^-+)|(-+$)', '', 'g'),
      ''),
    'escritorio'
  ) || '-' || left(replace("id"::text, '-', ''), 6),
  63
)
WHERE "slug" IS NULL;

ALTER TABLE "organizations" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations" ("slug");

-- Only lowercase letters, digits and single inner hyphens: the slug is typed by hand and
-- travels inside invitation links, so an ambiguous character is a support call.
ALTER TABLE "organizations"
  ADD CONSTRAINT "organizations_slug_format" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

CREATE TABLE "user_invitations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "token_hash" VARCHAR(64) NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "accepted_at" TIMESTAMPTZ(6),
  "revoked_at" TIMESTAMPTZ(6),
  "invited_by_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "user_invitations_pkey" PRIMARY KEY ("id"),
  -- Um convite aceito ou revogado carrega o instante do fato; nunca os dois ao mesmo tempo.
  CONSTRAINT "user_invitations_single_outcome"
    CHECK ("accepted_at" IS NULL OR "revoked_at" IS NULL)
);

CREATE UNIQUE INDEX "user_invitations_token_hash_key" ON "user_invitations" ("token_hash");
CREATE UNIQUE INDEX "user_invitations_organization_id_id_key"
  ON "user_invitations" ("organization_id", "id");
CREATE INDEX "user_invitations_organization_id_user_id_idx"
  ON "user_invitations" ("organization_id", "user_id");
CREATE INDEX "user_invitations_expires_at_idx" ON "user_invitations" ("expires_at");

ALTER TABLE "user_invitations"
  ADD CONSTRAINT "user_invitations_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Chave composta com o tenant: um convite nunca pode apontar para usuario de outra
-- organizacao, e o banco recusa em vez de depender da aplicacao lembrar.
ALTER TABLE "user_invitations"
  ADD CONSTRAINT "user_invitations_organization_id_user_id_fkey"
  FOREIGN KEY ("organization_id", "user_id") REFERENCES "users" ("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_invitations"
  ADD CONSTRAINT "user_invitations_organization_id_invited_by_id_fkey"
  FOREIGN KEY ("organization_id", "invited_by_id") REFERENCES "users" ("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
