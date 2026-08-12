-- Delivery 9 keeps exact vector search and adds the Portuguese lexical-search path.
ALTER TABLE "knowledge_chunks"
ADD COLUMN "search_vector" tsvector
GENERATED ALWAYS AS (to_tsvector('portuguese', coalesce("content", ''))) STORED;

CREATE INDEX "knowledge_chunks_search_vector_gin_idx"
ON "knowledge_chunks" USING GIN ("search_vector");

CREATE INDEX "knowledge_chunks_tenant_source_lookup_idx"
ON "knowledge_chunks" ("organization_id", "source_type", "source_id", "chunk_index");

CREATE INDEX "knowledge_chunks_tenant_embedding_scope_idx"
ON "knowledge_chunks" (
  "organization_id",
  "embedding_provider",
  "embedding_model",
  "embedding_version",
  "embedding_dimensions",
  "case_id",
  "document_id"
)
WHERE "embedding" IS NOT NULL;
