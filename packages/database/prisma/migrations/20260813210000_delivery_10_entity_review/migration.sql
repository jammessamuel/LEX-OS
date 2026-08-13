-- Delivery 10 records human confirmation separately from immutable extracted values.
ALTER TABLE "extracted_entities"
    ADD COLUMN "confirmed_by_user" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "confirmed_by" UUID,
    ADD COLUMN "confirmed_at" TIMESTAMPTZ(6),
    ADD CONSTRAINT "extracted_entities_confirmation_consistent" CHECK (
        ("confirmed_by_user" = false AND "confirmed_by" IS NULL AND "confirmed_at" IS NULL)
        OR
        ("confirmed_by_user" = true AND "confirmed_by" IS NOT NULL AND "confirmed_at" IS NOT NULL)
    ),
    ADD CONSTRAINT "extracted_entities_organization_id_confirmed_by_fkey"
        FOREIGN KEY ("organization_id", "confirmed_by")
        REFERENCES "users"("organization_id", "id")
        ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "extracted_entities_organization_id_confirmed_by_idx"
    ON "extracted_entities"("organization_id", "confirmed_by");
