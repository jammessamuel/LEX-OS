-- Delivery 6 adds tenant-first partial indexes for active file/document access and
-- strengthens persisted checksum metadata. It contains no destructive statements.

CREATE INDEX "files_active_organization_created_at_id_idx"
ON "files" ("organization_id", "created_at" DESC, "id" DESC)
WHERE "deleted_at" IS NULL;

CREATE INDEX "files_available_organization_checksum_size_created_idx"
ON "files" ("organization_id", "checksum_sha256", "size_bytes", "created_at", "id")
WHERE "deleted_at" IS NULL
  AND "status" = 'AVAILABLE'
  AND "virus_scan_status" = 'CLEAN';

CREATE INDEX "documents_active_organization_case_created_at_id_idx"
ON "documents" ("organization_id", "case_id", "created_at" DESC, "id" DESC)
WHERE "deleted_at" IS NULL;

ALTER TABLE "files"
ADD CONSTRAINT "files_checksum_sha256_lower_hex"
CHECK ("checksum_sha256" ~ '^[0-9a-f]{64}$');
