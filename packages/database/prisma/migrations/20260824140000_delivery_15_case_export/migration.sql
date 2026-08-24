-- Delivery 15 — the case dossier is exported by the worker, like every other heavy job.
--
-- Forward-only. Nothing is dropped: a new value on an existing enum.

ALTER TYPE "job_type" ADD VALUE IF NOT EXISTS 'CASE_EXPORT';
