-- Delivery 5 list endpoints use keyset pagination and consistently exclude soft-deleted rows.
-- Partial indexes keep active-resource scans compact while retaining the original history.
CREATE INDEX "persons_active_organization_created_at_id_idx"
ON "persons" ("organization_id", "created_at" DESC, "id" DESC)
WHERE "deleted_at" IS NULL;

CREATE INDEX "cases_active_organization_updated_at_id_idx"
ON "cases" ("organization_id", "updated_at" DESC, "id" DESC)
WHERE "deleted_at" IS NULL;

CREATE INDEX "cases_active_organization_status_updated_at_id_idx"
ON "cases" ("organization_id", "status", "updated_at" DESC, "id" DESC)
WHERE "deleted_at" IS NULL;

CREATE INDEX "case_participants_organization_case_created_id_idx"
ON "case_participants" ("organization_id", "case_id", "created_at", "id");
