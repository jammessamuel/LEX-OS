-- Delivery 15 — the case carries the court's own number.
--
-- Forward-only. Nullable because a case exists before it is filed; the number arrives with
-- the protocol.

ALTER TABLE "cases"
  ADD COLUMN "cnj_number" VARCHAR(25),
  ADD COLUMN "court" VARCHAR(160),
  ADD COLUMN "court_division" VARCHAR(160);

-- A forma e conferida aqui alem da aplicacao: um valor com pontuacao errada nao deveria
-- conseguir entrar por nenhuma porta. O digito verificador continua sendo trabalho do codigo.
ALTER TABLE "cases"
  ADD CONSTRAINT "cases_cnj_number_format"
  CHECK ("cnj_number" IS NULL OR "cnj_number" ~ '^[0-9]{7}-[0-9]{2}\.[0-9]{4}\.[0-9]\.[0-9]{2}\.[0-9]{4}$');

-- Um processo pertence a um caso so, dentro do escritorio. Nulos nao colidem entre si em
-- indice unico do PostgreSQL, entao caso sem numero — o normal antes do protocolo — nao trava.
CREATE UNIQUE INDEX "cases_organization_cnj_key" ON "cases" ("organization_id", "cnj_number");
