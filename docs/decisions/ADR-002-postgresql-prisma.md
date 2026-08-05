# ADR-002: Use PostgreSQL with Prisma as the primary data layer

- **Status:** Accepted
- **Date:** 2026-08-05
- **Deciders:** SAMUEL DEV LTDA / LEX OS architecture

## Context

The product needs relational integrity across tenants, users, cases, documents, jobs, and audit records; transactional changes; JSON metadata; full-text search; and vector storage. Type-safe application access is valuable, but PostgreSQL-specific constraints and extensions remain necessary.

## Decision

Use PostgreSQL as the system of record and Prisma as the primary ORM/migration workflow.

- UUIDs use PostgreSQL `gen_random_uuid()`.
- Times use `timestamptz`; date-only legal values use `date`.
- Tenant-consistent composite foreign keys are created wherever possible.
- JSONB is reserved for genuinely variable metadata, not as a substitute for modeled fields.
- Prisma migrations remain canonical, with reviewed SQL additions for pgvector, partial indexes, generated full-text structures, checks, and other unsupported PostgreSQL features.
- Production migrations run as a controlled release step. `prisma db push` is not used for shared or production databases.

## Consequences

### Positive

- transactional consistency for core workflow and audit;
- strong relational constraints against cross-tenant linkage;
- typed query client and reproducible migrations;
- one database supports structured, full-text, JSON, and initial vector needs;
- lower operational complexity for the MVP.

### Negative

- Prisma does not model every PostgreSQL feature; migrations need manual review;
- careless direct Prisma usage can omit tenant filters;
- high-volume vector or text workloads may eventually require specialization;
- schema changes to large tables will need production-safe rollout patterns.

## Rejected alternatives

- **MongoDB/document database:** weaker fit for the relationship and transaction-heavy model.
- **Separate databases for relational and search data immediately:** adds synchronization and tenancy failure paths prematurely.
- **SQL query builder only:** offers control but less standardized schema/client workflow for the initial team; targeted raw SQL remains available.

## Compliance checks

- CI runs Prisma format/validate and migration checks on a clean PostgreSQL instance.
- Generated SQL is reviewed for destructive changes, locks, constraints, and indexes.
- Integration tests attempt representative forbidden cross-tenant inserts.
- Repositories/application services, not controllers, own Prisma access.
