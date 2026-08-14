-- ADR-011: make provider cost measurable and enforce a recoverable hard limit per case.
CREATE TYPE "processing_budget_status" AS ENUM ('ACTIVE', 'LIMIT_REACHED');

ALTER TABLE "cases"
    ADD COLUMN "processing_cost_limit_amount" DECIMAL(18,6) NOT NULL DEFAULT 0,
    ADD COLUMN "processing_cost_spent_amount" DECIMAL(18,6) NOT NULL DEFAULT 0,
    ADD COLUMN "processing_cost_reserved_amount" DECIMAL(18,6) NOT NULL DEFAULT 0,
    ADD COLUMN "processing_cost_currency" CHAR(3) NOT NULL DEFAULT 'BRL',
    ADD COLUMN "processing_budget_status" "processing_budget_status" NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN "processing_limit_reached_at" TIMESTAMPTZ(6),
    ADD CONSTRAINT "cases_processing_cost_nonnegative" CHECK (
        "processing_cost_limit_amount" >= 0
        AND "processing_cost_spent_amount" >= 0
        AND "processing_cost_reserved_amount" >= 0
    ),
    ADD CONSTRAINT "cases_processing_cost_within_limit" CHECK (
        "processing_cost_spent_amount" + "processing_cost_reserved_amount"
        <= "processing_cost_limit_amount"
    ),
    ADD CONSTRAINT "cases_processing_cost_currency_valid" CHECK (
        "processing_cost_currency" ~ '^[A-Z]{3}$'
    ),
    ADD CONSTRAINT "cases_processing_budget_state_consistent" CHECK (
        ("processing_budget_status" = 'ACTIVE' AND "processing_limit_reached_at" IS NULL)
        OR
        ("processing_budget_status" = 'LIMIT_REACHED' AND "processing_limit_reached_at" IS NOT NULL)
    );

ALTER TABLE "processing_jobs"
    ADD COLUMN "model_version" VARCHAR(120),
    ADD COLUMN "reserved_cost_amount" DECIMAL(18,6) NOT NULL DEFAULT 0,
    ADD COLUMN "cost_amount" DECIMAL(18,6),
    ADD COLUMN "cost_currency" CHAR(3) NOT NULL DEFAULT 'BRL';

UPDATE "processing_jobs"
SET "model_version" = COALESCE("model_version", 'legacy-unknown'),
    "cost_amount" = 0
WHERE "status" = 'COMPLETED';

ALTER TABLE "processing_jobs"
    ADD CONSTRAINT "processing_jobs_cost_nonnegative" CHECK (
        "reserved_cost_amount" >= 0
        AND ("cost_amount" IS NULL OR "cost_amount" >= 0)
    ),
    ADD CONSTRAINT "processing_jobs_cost_currency_valid" CHECK (
        "cost_currency" ~ '^[A-Z]{3}$'
    ),
    ADD CONSTRAINT "processing_jobs_completed_cost_recorded" CHECK (
        "status" <> 'COMPLETED'
        OR (
            "provider" IS NOT NULL
            AND "model_name" IS NOT NULL
            AND "model_version" IS NOT NULL
            AND "cost_amount" IS NOT NULL
            AND "reserved_cost_amount" = 0
        )
    );

CREATE INDEX "processing_jobs_organization_id_case_id_provider_model_name_idx"
    ON "processing_jobs"("organization_id", "case_id", "provider", "model_name");
