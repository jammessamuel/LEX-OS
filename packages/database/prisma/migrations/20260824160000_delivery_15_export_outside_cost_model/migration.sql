-- Delivery 15 — the dossier export completes without a cost record, on purpose.
--
-- The Delivery 10 constraint says no job reaches COMPLETED without provider, model, model
-- version and cost. That rule is about ADR-011: an AI execution must never finish without
-- leaving what it cost and which model produced it.
--
-- A dossier is not an AI execution. It is a PDF assembled from rows already in the database:
-- no provider, no model, no per-execution cost. Satisfying the old constraint would mean
-- writing a fictional provider and a zero cost into the ledger, which is precisely how a cost
-- control stops meaning anything — the report would show executions that never happened.
--
-- So the constraint is narrowed to say what it actually means, and stays strict for every
-- other job type. Forward-only: the constraint is replaced, nothing is dropped.

ALTER TABLE "processing_jobs"
    DROP CONSTRAINT "processing_jobs_completed_cost_recorded";

ALTER TABLE "processing_jobs"
    ADD CONSTRAINT "processing_jobs_completed_cost_recorded" CHECK (
        "status" <> 'COMPLETED'
        OR "job_type" = 'CASE_EXPORT'
        OR (
            "provider" IS NOT NULL
            AND "model_name" IS NOT NULL
            AND "model_version" IS NOT NULL
            AND "cost_amount" IS NOT NULL
            AND "reserved_cost_amount" = 0
        )
    );

-- Um trabalho de exportacao nao reserva nem gasta nada. Se algum dia alguem tentar cobrar por
-- ele, esta linha impede que passe despercebido.
ALTER TABLE "processing_jobs"
    ADD CONSTRAINT "processing_jobs_export_has_no_cost" CHECK (
        "job_type" <> 'CASE_EXPORT'
        OR ("cost_amount" IS NULL AND "reserved_cost_amount" = 0 AND "provider" IS NULL)
    );
