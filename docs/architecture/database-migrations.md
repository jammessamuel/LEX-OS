# Database migrations

**Status:** Initial migration plus Delivery 5, 6, and 7 indexes/constraints implemented and reviewed  
**Last updated:** 2026-08-05

## Canonical artifacts

- Prisma schema: [`packages/database/prisma/schema.prisma`](../../packages/database/prisma/schema.prisma)
- initial SQL migration: [`packages/database/prisma/migrations/20260805145549_initial_schema/migration.sql`](../../packages/database/prisma/migrations/20260805145549_initial_schema/migration.sql)
- Delivery 5 indexes: [`packages/database/prisma/migrations/20260805154500_delivery_5_resource_indexes/migration.sql`](../../packages/database/prisma/migrations/20260805154500_delivery_5_resource_indexes/migration.sql)
- Delivery 6 file/document indexes and checksum check: [`packages/database/prisma/migrations/20260805170000_delivery_6_secure_file_indexes/migration.sql`](../../packages/database/prisma/migrations/20260805170000_delivery_6_secure_file_indexes/migration.sql)
- Delivery 7 processing indexes and lifecycle checks: [`packages/database/prisma/migrations/20260805183000_delivery_7_processing_pipeline/migration.sql`](../../packages/database/prisma/migrations/20260805183000_delivery_7_processing_pipeline/migration.sql)
- fictional seed: [`packages/database/prisma/seed.ts`](../../packages/database/prisma/seed.ts)
- SQL integration tests: [`packages/database/test/schema.integration.test.cjs`](../../packages/database/test/schema.integration.test.cjs)

The generated Prisma client is ignored build output. Applications import the database package, which constructs Prisma Client with the pinned PostgreSQL driver adapter and exposes a bounded interactive-transaction helper.

## Initial SQL review

The migration creates 22 PostgreSQL enums and 24 application/support tables. Prisma generated the tables, UUID/timestamptz columns, ordinary/unique indexes, and foreign keys. The migration was then amended in the same review with capabilities that the Prisma schema cannot fully express:

- `pgcrypto` and `vector` extensions before any dependent table;
- partial unique indexes for global and organization-scoped roles, document types, and checklist-template versions;
- non-negative file size, extraction duration, processing attempts, and processing version checks;
- file self-duplicate prevention and timeline-confirmation consistency;
- refresh-session hash-format and timestamp-order checks.

Tenant-owned parents expose unique `(organization_id, id)` pairs. Dependent relations carry `organization_id` in their foreign keys, including case responsibility, participants, files, documents, extractions/entities, timeline events, checklist instances/items, tasks, knowledge chunks, processing jobs, and audit links. Common foreign-key/list paths have tenant-first or direct supporting indexes.

Delete actions were kept conservative: tenant-owned records normally restrict deletion, join rows and refresh sessions cascade from their owning identity, and nullable global-definition ownership uses `SET NULL`. Production hard deletion and retention remain governance decisions.

Delivery 5 adds partial tenant-first indexes for active person and case keyset pagination plus a covering participant list index. The application filters `deleted_at IS NULL`, orders with deterministic timestamp/UUID tie-breakers, and does not use deep `OFFSET` scans.

Delivery 6 adds partial tenant-first indexes for active file/document keyset pagination and the clean/available same-tenant checksum/size duplicate lookup. It also requires lowercase 64-character SHA-256 metadata. Foreign-key paths continue to use their existing supporting indexes; no object bytes are added to PostgreSQL.

Delivery 7 adds the tenant/creation keyset indexes used by processing and extraction APIs, plus a partial `(status, updated_at, id)` index limited to reconcilable queued/retrying jobs. Reviewed checks bound priority/confidence/page/offset values and require lifecycle timestamps and safe error codes to agree with every job state.

## Deliberate deferrals

The `knowledge_chunks.embedding` column is an unbounded pgvector value. No HNSW or IVFFlat index is created until one production embedding dimension/model is selected and benchmarked with synthetic representative data. Portuguese full-text generated columns/indexes are also deferred until normalization and text-search configuration have dedicated tests.

Global-or-organization visibility for roles, document types, and checklist templates cannot be completely encoded by an ordinary foreign key. Delivery 4 enforces role visibility while assembling the authenticated permission set. Delivery 6 enforces global/same-tenant document-type visibility during human document correction. Checklist-template visibility remains deferred to its product delivery.

## Local operation

```bash
pnpm db:format
pnpm db:validate
pnpm db:migrate:deploy
pnpm db:migrate:status
pnpm db:seed
pnpm test:integration
```

Create new migrations with `pnpm db:migrate:dev --name <descriptive_name>`, review the generated SQL, and add a forward migration instead of editing an already-shared migration.

`pnpm db:reset` irreversibly recreates the configured schema. It is only for an explicitly verified development database and must never target production or retained data.

## Seed safety

The local seed uses reserved fixed UUIDs, an `.invalid` administrator e-mail, invalid all-zero organization document data, and a case explicitly labeled as fictional. It refuses production mode and requires a local password from the environment. The password is transformed with Argon2id before the transaction; no plaintext password or refresh token is persisted or logged. Upserts make repeated seed executions structurally idempotent. Delivery 5 seeds six global permission bundles and 24 granular permissions; historical permission UUIDs remain stable and seed-owned bundle assignments are rebuilt deterministically on each run.
