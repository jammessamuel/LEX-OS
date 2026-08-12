-- Forward-only repair after Prisma exposed previously unmodeled SQL indexes as drift.
ALTER TABLE "knowledge_chunks"
ADD COLUMN "search_vector" tsvector
GENERATED ALWAYS AS (to_tsvector('portuguese', coalesce("content", ''))) STORED;

CREATE INDEX "knowledge_chunks_search_vector_gin_idx"
ON "knowledge_chunks" USING GIN ("search_vector");

CREATE INDEX "knowledge_chunks_tenant_source_lookup_idx"
ON "knowledge_chunks" ("organization_id", "source_type", "source_id", "chunk_index");

CREATE INDEX "case_participants_organization_case_created_id_idx"
ON "case_participants" ("organization_id", "case_id", "created_at", "id");

CREATE INDEX "processing_jobs_tenant_created_at_id_idx"
ON "processing_jobs" ("organization_id", "created_at" DESC, "id" DESC);

CREATE INDEX "document_extractions_tenant_document_created_at_id_idx"
ON "document_extractions" ("organization_id", "document_id", "created_at" DESC, "id" DESC);

CREATE INDEX "timeline_events_tenant_case_created_at_id_idx"
ON "timeline_events" ("organization_id", "case_id", "created_at" DESC, "id" DESC);

CREATE INDEX "case_checklists_tenant_case_created_at_id_idx"
ON "case_checklists" ("organization_id", "case_id", "created_at" DESC, "id" DESC);
