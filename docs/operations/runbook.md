# LEX OS operational runbook

**Status:** Delivery 11 implementation; production use remains blocked

**Last updated:** 2026-08-14

## Scope and safety boundary

This runbook covers a development or staging preview that contains fictional data only. It does not
authorize production onboarding, destructive purge, real provider activation, or an LGPD claim.
Production remains blocked by the controls listed below, especially a real malware scanner,
case-level legal hold, approved retention procedures, regional durable backups, restore objectives,
subprocessor governance, and production provider adapters.

Never paste secrets into commands, logs, tickets, or this document. Use the environment/secret
manager and service references. CI is verification-only and has no deployment step or production
credential.

## Clean local bootstrap

From a clean clone, install the pinned toolchain, create the ignored local environment file, replace
all placeholders with local-only values, and run:

```bash
corepack enable
corepack prepare pnpm@11.9.0 --activate
pnpm install --frozen-lockfile
cp .env.example .env
pnpm infra:bootstrap
```

`infra:bootstrap` refuses a non-development environment and a non-local database URL. It starts
dependencies, applies reviewed migrations, checks migration status, applies the idempotent fictional
seed, builds the applications, and waits for every Compose health check. Normal later starts use
`pnpm infra:up`; normal stops use `pnpm infra:down`, which preserves volumes.

## Health and first response

Check the stack and bounded dependency readiness:

```bash
pnpm infra:ps
curl --fail http://localhost:3000/api/v1/health/live
curl --fail http://localhost:3000/api/v1/health/ready
curl --fail http://localhost:3000/api/v1/metrics
```

If readiness fails, inspect recent logs without printing environment variables:

```bash
docker compose logs --no-color --tail 200 api worker postgres redis minio
```

Do not restart dependencies repeatedly before preserving the first failure evidence. Liveness means
only that the process responds; readiness is the signal used for traffic.

## Controlled migrations

Shared and staging databases use forward migrations only:

```bash
pnpm db:validate
pnpm db:migrate:status
pnpm db:migrate:deploy
pnpm db:migrate:status
```

Review generated SQL for table rewrites, destructive statements, long locks, tenant constraints,
and extension/index requirements before approval. Never use `prisma db push`. Production migration
must remain a separate release step; the worker never runs migrations.

## Synthetic recovery rehearsal

With the complete local stack healthy and only the fictional seed/E2E fixtures present, run:

```bash
pnpm ops:recovery:rehearse
```

The command fails closed unless it sees the explicit local Compose PostgreSQL endpoint,
`NODE_ENV=development|test`, at least one fixture organization, only `.invalid` users, and all
runtime services. It then:

1. creates a mode-0600 PostgreSQL custom dump in an operating-system temporary directory;
2. restores it into a randomly named temporary database;
3. compares counts and identifier fingerprints for the core evidence/audit tables and migrations;
4. writes one generated marker to the private development bucket, copies it through a temporary
   private restore bucket, and verifies its exact contents;
5. removes the marker, restore bucket, temporary database, and local dump.

It never resets the source database, deletes an existing legal object, or contacts an external
system. A warning after a failed cleanup names only the generated temporary resource to inspect.
This proves the rehearsal mechanism, not production durability, RPO, RTO, regional residency, or
provider backup policy.

## Queue and storage reconciliation

PostgreSQL is authoritative for processing. The worker automatically republishes stale
`QUEUED`/`RETRYING` jobs missing from Redis. Monitor `processing.deferredEnqueues`, queue age, and
worker logs. A rising value is recoverable work waiting for reconciliation, not permission to edit
Redis or mark a job complete manually.

Object reconciliation is deliberately report-only: it identifies active database rows with missing
objects, stale quarantine, and objects with no active database reference. It must not delete or
release evidence. The integration suite exercises both reconciliation boundaries with synthetic
data:

```bash
pnpm test:integration
```

Escalate a missing object or a repeatedly stale job with its safe resource identifier, request ID,
correlation ID, timestamps, and service logs. Never attach document content, signed URLs,
credentials, or raw Redis payloads.

## Verification and release evidence

Before merging a Delivery 11 change, run the root gates documented in the README. CI repeats format,
lint, typecheck, unit, integration/API, migration validation, build/container, dependency review,
desktop/mobile Playwright, and recovery rehearsal gates. Failed Playwright runs retain screenshots,
videos, traces, and the HTML report for seven days. CI does not deploy.

Staging deployments remain manual and separately authorized. Confirm health, migration status, web
login, one fictional case flow, and worker readiness after deployment. Never promote the current
deterministic/mock stack to production.

## Remaining production blockers

- real malware scanner and production OCR/AI/embedding/language-model adapters;
- approved provider/subprocessor terms forbidding training on submitted content;
- case-level legal hold that fails closed on every deletion path;
- retention, legal basis, data-subject, customer-offboarding, and irreversible-purge procedures;
- durable same-region PostgreSQL/object-storage backup policy with measured RPO/RTO and scheduled
  restore exercises;
- trusted reverse-proxy/IP policy, TLS, least-privilege service identities, alert routing, and secret
  rotation procedure;
- production e-mail ingestion/notification increments authorized separately under ADR-010/013;
- a reviewed real-provider cost policy and explicit release path after the per-case ceiling;
- load/adversarial-file evidence representative of production volume.

Until these are accepted, use fictional data only and make no LGPD compliance claim.
