-- Tenant-first keyset indexes for Delivery 8 HTTP resource lists.
CREATE INDEX "timeline_events_tenant_case_created_at_id_idx"
    ON "timeline_events"("organization_id", "case_id", "created_at" DESC, "id" DESC);

CREATE INDEX "case_checklists_tenant_case_created_at_id_idx"
    ON "case_checklists"("organization_id", "case_id", "created_at" DESC, "id" DESC);

CREATE INDEX "tasks_active_tenant_case_created_at_id_idx"
    ON "tasks"("organization_id", "case_id", "created_at" DESC, "id" DESC)
    WHERE "deleted_at" IS NULL;
