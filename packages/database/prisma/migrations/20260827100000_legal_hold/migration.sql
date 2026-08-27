-- Legal hold no caso (ADR-012).
--
-- A marca bloqueia todo caminho de exclusao, inclusive administrativo, e a decisao manda falhar
-- fechado: se o estado do hold nao puder ser determinado, a exclusao e recusada. A restricao
-- abaixo torna o estado indeterminado impossivel de existir, em vez de deixa-lo para o codigo
-- detectar — os tres campos entram e saem juntos.

-- AlterTable
ALTER TABLE "cases"
    ADD COLUMN "legal_hold_at" TIMESTAMPTZ(6),
    ADD COLUMN "legal_hold_by" UUID,
    ADD COLUMN "legal_hold_reason" TEXT;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_organization_id_legal_hold_by_fkey" FOREIGN KEY ("organization_id", "legal_hold_by") REFERENCES "users"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "cases_organization_id_legal_hold_at_idx" ON "cases"("organization_id", "legal_hold_at");

-- Estado de hold e tudo ou nada. Um caso com data de retencao e sem responsavel, ou com motivo
-- e sem data, seria exatamente o estado ambiguo que o ADR-012 manda recusar.
ALTER TABLE "cases"
    ADD CONSTRAINT "cases_legal_hold_all_or_nothing" CHECK (
        (
            "legal_hold_at" IS NULL
            AND "legal_hold_by" IS NULL
            AND "legal_hold_reason" IS NULL
        )
        OR (
            "legal_hold_at" IS NOT NULL
            AND "legal_hold_by" IS NOT NULL
            AND "legal_hold_reason" IS NOT NULL
            AND length(btrim("legal_hold_reason")) > 0
        )
    );

-- Caso sob retencao nunca esta logicamente excluido. Sem isto, um caso ja excluido poderia
-- receber a marca e ficar num estado que nenhuma tela sabe representar.
ALTER TABLE "cases"
    ADD CONSTRAINT "cases_legal_hold_not_deleted" CHECK (
        "legal_hold_at" IS NULL OR "deleted_at" IS NULL
    );
