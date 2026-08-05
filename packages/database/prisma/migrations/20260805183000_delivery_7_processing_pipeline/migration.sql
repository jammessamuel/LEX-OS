-- Delivery 7 keeps progress reads and enqueue-gap reconciliation tenant-first and keyset-friendly.
CREATE INDEX "processing_jobs_tenant_created_at_id_idx"
    ON "processing_jobs" ("organization_id", "created_at" DESC, "id" DESC);

CREATE INDEX "processing_jobs_reconcilable_updated_at_id_idx"
    ON "processing_jobs" ("status", "updated_at", "id")
    WHERE "status" IN ('QUEUED', 'RETRYING');

CREATE INDEX "document_extractions_tenant_document_created_at_id_idx"
    ON "document_extractions" ("organization_id", "document_id", "created_at" DESC, "id" DESC);

ALTER TABLE "processing_jobs"
    ADD CONSTRAINT "processing_jobs_priority_bounded"
        CHECK ("priority" BETWEEN 0 AND 100),
    ADD CONSTRAINT "processing_jobs_lifecycle_consistent"
        CHECK (
            ("status" = 'QUEUED' AND "started_at" IS NULL AND "finished_at" IS NULL)
            OR ("status" IN ('PROCESSING', 'RETRYING') AND "started_at" IS NOT NULL AND "finished_at" IS NULL)
            OR ("status" IN ('COMPLETED', 'FAILED', 'CANCELLED') AND "finished_at" IS NOT NULL)
        ),
    ADD CONSTRAINT "processing_jobs_error_state_consistent"
        CHECK (
            ("status" IN ('RETRYING', 'FAILED') AND "error_code" IS NOT NULL)
            OR ("status" NOT IN ('RETRYING', 'FAILED') AND "error_code" IS NULL)
        );

ALTER TABLE "documents"
    ADD CONSTRAINT "documents_confidence_score_bounded"
        CHECK ("confidence_score" IS NULL OR "confidence_score" BETWEEN 0 AND 1);

ALTER TABLE "document_extractions"
    ADD CONSTRAINT "document_extractions_confidence_score_bounded"
        CHECK ("confidence_score" IS NULL OR "confidence_score" BETWEEN 0 AND 1);

ALTER TABLE "extracted_entities"
    ADD CONSTRAINT "extracted_entities_confidence_score_bounded"
        CHECK ("confidence_score" IS NULL OR "confidence_score" BETWEEN 0 AND 1),
    ADD CONSTRAINT "extracted_entities_page_number_positive"
        CHECK ("page_number" IS NULL OR "page_number" > 0),
    ADD CONSTRAINT "extracted_entities_offsets_consistent"
        CHECK (
            ("start_offset" IS NULL AND "end_offset" IS NULL)
            OR (
                "start_offset" IS NOT NULL
                AND "end_offset" IS NOT NULL
                AND "start_offset" >= 0
                AND "end_offset" >= "start_offset"
            )
        );
