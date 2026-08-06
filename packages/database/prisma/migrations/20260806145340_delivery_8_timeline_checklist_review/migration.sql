-- Delivery 8 strengthens source provenance and case-level tenant isolation.
ALTER TABLE "case_checklist_items" ADD COLUMN "case_id" UUID;

UPDATE "case_checklist_items" AS item
SET "case_id" = checklist."case_id"
FROM "case_checklists" AS checklist
WHERE checklist."organization_id" = item."organization_id"
  AND checklist."id" = item."case_checklist_id";

ALTER TABLE "case_checklist_items" ALTER COLUMN "case_id" SET NOT NULL;

CREATE UNIQUE INDEX "case_checklists_organization_id_case_id_id_key"
    ON "case_checklists"("organization_id", "case_id", "id");

CREATE UNIQUE INDEX "documents_organization_id_case_id_id_key"
    ON "documents"("organization_id", "case_id", "id");

ALTER TABLE "timeline_events"
    DROP CONSTRAINT "timeline_events_organization_id_extraction_id_fkey";

DROP INDEX "timeline_events_organization_id_extraction_id_idx";

CREATE INDEX "timeline_events_organization_id_source_id_extraction_id_idx"
    ON "timeline_events"("organization_id", "source_id", "extraction_id");

ALTER TABLE "timeline_events"
    ADD CONSTRAINT "timeline_events_organization_id_case_id_source_id_fkey"
        FOREIGN KEY ("organization_id", "case_id", "source_id")
        REFERENCES "documents"("organization_id", "case_id", "id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "timeline_events_organization_id_source_id_extraction_id_fkey"
        FOREIGN KEY ("organization_id", "source_id", "extraction_id")
        REFERENCES "document_extractions"("organization_id", "document_id", "id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "timeline_events_ai_source_required" CHECK (
        "created_by_actor_type" <> 'AI'
        OR (
            "source_type" = 'DOCUMENT'
            AND "source_id" IS NOT NULL
            AND "source_locator" IS NOT NULL
            AND jsonb_typeof("source_locator") = 'object'
            AND "source_locator" ? 'pageNumber'
            AND "source_locator" ? 'startOffset'
            AND "source_locator" ? 'endOffset'
            AND "extraction_id" IS NOT NULL
        )
    );

ALTER TABLE "case_checklist_items"
    DROP CONSTRAINT "case_checklist_items_organization_id_case_checklist_id_fkey",
    DROP CONSTRAINT "case_checklist_items_organization_id_document_id_fkey";

DROP INDEX "case_checklist_items_organization_id_case_checklist_id_stat_idx";
DROP INDEX "case_checklist_items_organization_id_document_id_idx";

CREATE INDEX "case_checklist_items_organization_id_case_id_case_checklist_idx"
    ON "case_checklist_items"("organization_id", "case_id", "case_checklist_id", "status");

CREATE INDEX "case_checklist_items_organization_id_case_id_document_id_idx"
    ON "case_checklist_items"("organization_id", "case_id", "document_id");

ALTER TABLE "case_checklist_items"
    ADD CONSTRAINT "case_checklist_items_organization_id_case_id_case_checklist_fkey"
        FOREIGN KEY ("organization_id", "case_id", "case_checklist_id")
        REFERENCES "case_checklists"("organization_id", "case_id", "id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "case_checklist_items_organization_id_case_id_document_id_fkey"
        FOREIGN KEY ("organization_id", "case_id", "document_id")
        REFERENCES "documents"("organization_id", "case_id", "id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "case_checklist_items_validation_consistent" CHECK (
        ("validated_by" IS NULL AND "validated_at" IS NULL)
        OR
        ("validated_by" IS NOT NULL AND "validated_at" IS NOT NULL)
    );

CREATE INDEX "tasks_organization_id_source_type_source_id_idx"
    ON "tasks"("organization_id", "source_type", "source_id");

CREATE UNIQUE INDEX "tasks_active_ai_checklist_source_key"
    ON "tasks"("organization_id", "source_id")
    WHERE "source_type" = 'AI_CHECKLIST'
      AND "source_id" IS NOT NULL
      AND "deleted_at" IS NULL;
