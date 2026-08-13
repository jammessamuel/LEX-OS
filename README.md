# LEX OS

LEX OS is an intelligent legal operations system for Brazilian law firms. The project receives disorganized operational material and prepares a structured, searchable, and traceable legal dossier for human analysis.

The latest accepted checkpoint is **Delivery 10 — Essential web vertical slice**. The repository provides the reproducible local stack, authenticated and tenant-aware legal/file platform, a seven-stage persistent BullMQ pipeline, deterministic sourced timeline/checklist analysis and embedding indexation, PostgreSQL Portuguese full-text search, exact pgvector retrieval, hybrid ranking, resolvable citations, source-grounded mock answers, per-case processing ceilings, safe audit provenance, and a responsive pt-BR interface over the implemented API. Real providers and Delivery 11 verification hardening remain intentionally deferred.

## Architecture baseline

- pnpm workspace with Turborepo;
- NestJS API and separate NestJS worker processes;
- Vue 3 web client with Vite, Pinia, and Vue Router;
- PostgreSQL 18 with pgvector, Redis, private MinIO, and Mailpit through Docker Compose;
- Prisma 7 database package with a PostgreSQL driver adapter and transaction helper;
- reviewed migration with pgcrypto, pgvector, composite tenant foreign keys, partial indexes, and checks;
- idempotent fictional seed with Argon2id password hashing;
- `/api/v1` HTTP platform with strict DTO validation, stable error envelopes, cursor-pagination primitives, CORS/Helmet, and generated OpenAPI;
- short-lived JWT access tokens plus opaque refresh cookies stored only as SHA-256 hashes, with rotation, family revocation, and replay detection;
- Redis-backed login brute-force protection, blocked-user checks, and non-enumerating authentication failures;
- tenant context derived from the authenticated session and permission-code authorization without role-name branching;
- append-only allowlisted authentication audits and structured-log redaction tests;
- tenant-scoped people and case CRUD with soft delete, opaque keyset pagination, and cross-tenant not-found behavior;
- CPF/CNPJ validation and normalization with masked API output and no identity values in logs/audits;
- case responsibility, status, priority, confidentiality policy, and confidential-read audits;
- validated case participants backed by composite tenant foreign keys and single-query person summaries;
- streamed multipart intake to private S3-compatible storage with bounded memory, generated keys, SHA-256, actual MIME/signature checks, and a fail-closed scanner interface;
- same-tenant duplicate linkage, transactional file/document/job persistence, 60-second authorized download URLs, and non-destructive storage reconciliation;
- tenant-aware document listing, detail, human metadata correction, document-type visibility checks, and audited soft deletion;
- strict versioned queue messages containing only job/tenant/correlation identifiers, with one BullMQ queue per implemented stage;
- optimistic persistent job transitions, bounded exponential retries, deterministic child IDs, duplicate-delivery safety, and stale-job reconciliation;
- deterministic development/test OCR/text, classification, and entity extraction with append-only provenance and mandatory human-review state;
- validated deterministic timeline/checklist outputs, same-case source locators, immutable generation extractions, and unconfirmed AI events;
- audited human timeline confirmation, versioned checklist snapshots, item review, and one traceable task per selected pending item;
- tenant/RBAC/confidentiality-aware processing progress, extraction history, and reprocessing HTTP routes;
- tenant/RBAC/confidentiality-aware timeline, checklist, and task HTTP routes;
- person-to-case traversal, assignable-user summaries, task lifecycle updates, and extracted-entity confirmation;
- source-grounded answer generation that refuses without authorized evidence and validates every claim citation;
- exact BRL processing-cost accounting with atomic reservations and a hard recoverable ceiling per case;
- typed environment configuration with explicit production validation;
- structured JSON logs with request and correlation IDs;
- API liveness, readiness, and process metrics;
- named development volumes for PostgreSQL, Redis, and MinIO.

Read [`AGENTS.md`](./AGENTS.md), the [local development guide](./docs/architecture/local-development.md), and the documents under [`docs/`](./docs/) before changing the system. [`CLAUDE.md`](./CLAUDE.md) is the routing table an agent should read first.

[Roadmap alignment](./docs/product/roadmap-alignment.md) maps the conceptual proposal's 11 components and 4 phases onto the 12 deliveries, and records the four decisions that are still open.

## Prerequisites

- Node.js `>=24.14.0 <25` (`24.18.0` is pinned in `.node-version`);
- Corepack and pnpm `11.9.0`;
- Docker Desktop or a compatible Docker Engine with Compose.

## Install and configure

```bash
corepack enable
corepack prepare pnpm@11.9.0 --activate
pnpm install --frozen-lockfile
cp .env.example .env
```

Replace every `replace-with-*` value in `.env` with a local-only credential. The file is ignored by Git. Never commit it or paste its values into logs, issues, or documentation.

## Start the complete stack

One command builds the applications, starts every required service, and waits for health checks:

```bash
pnpm infra:up
```

Local endpoints:

| Component     | URL or port                                      |
| ------------- | ------------------------------------------------ |
| Web           | `http://localhost:5173`                          |
| API           | `http://localhost:3000/api/v1`                   |
| OpenAPI UI    | `http://localhost:3000/api/v1/docs`              |
| OpenAPI JSON  | `http://localhost:3000/api/v1/docs/openapi.json` |
| Liveness      | `http://localhost:3000/api/v1/health/live`       |
| Readiness     | `http://localhost:3000/api/v1/health/ready`      |
| Metrics       | `http://localhost:3000/api/v1/metrics`           |
| PostgreSQL    | `localhost:5433` from Docker, internal port 5432 |
| Redis         | `localhost:6379`                                 |
| MinIO API     | `http://localhost:9000`                          |
| MinIO console | `http://localhost:9001`                          |
| Mailpit       | `http://localhost:8025`                          |

The Docker PostgreSQL port defaults to `5433`, so a PostgreSQL instance already using the conventional host port `5432` can remain active.

The API listens on the managed-platform `PORT` environment variable when one is present and
falls back to `API_PORT` for local and Compose execution. This keeps external routing and health
checks on the same port without changing the local development contract.

Inspect or stop the environment without deleting persistent volumes:

```bash
pnpm infra:ps
pnpm infra:down
```

`infra:down` deliberately omits `--volumes`; PostgreSQL, Redis, and MinIO data survive normal container recreation.

## Run applications on the host

For watch mode, start only the dependencies and then the three application processes:

```bash
pnpm infra:dependencies
pnpm dev
```

Host processes for this project must use the Compose-managed PostgreSQL on `DATABASE_PORT=5433`. An unrelated local PostgreSQL may remain on `5432`; the LEX OS commands must not target it. Do not run the Compose `api`, `worker`, and `web` services at the same time as host watch mode on the same ports.

## Quality checks

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm build
pnpm db:validate
pnpm infra:config
```

`db:validate` formats and validates the Prisma schema and checks that the reviewed raw SQL additions remain in the migration. Database integration tests require the Compose PostgreSQL service with the migration already applied. Playwright requires the complete stack, the fictional seed, and the local `SEED_ADMIN_PASSWORD`; it exercises the critical authenticated flow in desktop and mobile viewports without creating legal data.

API authentication and tenant contract tests also require the Compose PostgreSQL on `5433`, authenticated Redis, and private MinIO. See [Authentication and HTTP contract](./docs/api/authentication.md), [Dashboard summary API](./docs/api/dashboard.md), [People, cases, and participants API](./docs/api/people-cases-participants.md), [Files and documents API](./docs/api/files-documents.md), [Processing API](./docs/api/processing.md), [Grounded assistant API](./docs/api/assistant.md), [Authorized audit API](./docs/api/audit.md), and [Timeline, checklist, and tasks API](./docs/api/timeline-checklists-tasks.md).

## Database workflow

The repository `.env` must define `DATABASE_URL` and a local-only `SEED_ADMIN_PASSWORD`. For the Compose database, use the PostgreSQL endpoint on host port `5433`.

```bash
pnpm infra:dependencies
pnpm db:validate
pnpm db:migrate:deploy
pnpm db:migrate:status
pnpm db:seed
pnpm test:integration
```

Use `pnpm db:migrate:dev --name <descriptive_name>` only to create a reviewed forward migration. `pnpm db:reset` irreversibly removes all data from the configured database and is permitted only for an explicitly verified development database.

## Current limitations

- login currently requires the organization UUID because public organization discovery/onboarding is deferred;
- public organization onboarding and user administration endpoints remain deferred;
- person identifiers are intentionally masked in API responses until a dedicated sensitive-identifier permission is designed;
- participant removal/update and case-team ownership policies remain deferred; Delivery 5 supports validated association and listing;
- the generic NestJS request throttle is process-local; login brute-force state is Redis-backed and shared;
- trusted reverse-proxy/IP policy must be configured before an internet-facing production deployment;
- ZIP intake is disabled; accepted types are PDF, JPEG, PNG, and UTF-8 text, with a default maximum of 25 MiB per file and 10 files per request;
- the deterministic malware scanner is development/test-only and the API refuses to start with it in production; a production scanner adapter is still required;
- processing and embedding providers are deterministic development/test mocks; API/worker startup fails in production until real provider adapters are configured;
- duplicate uploads are linked within one tenant, but their second object is retained until a production retention/deduplication policy is approved;
- reconciliation reports missing, stale-quarantine, and orphan conditions without automatically deleting legal evidence;
- no e-mail adapter despite local Mailpit;
- the essential review/search UI is implemented, but complete person administration and organization/user onboarding remain deferred;
- grounded answers and processing providers still use only deterministic development/test adapters;
- production object retention, legal hold, backup/restore, and irreversible purge policies remain governance blockers;
- the essential Playwright matrix runs locally; broad abuse-case coverage, dependency review, backup/restore rehearsal, and CI hardening remain scheduled for Delivery 11;
- Git hooks cover commit-message policy only; a pre-commit lint/format gate is not installed yet.

The accepted checkpoint is **Delivery 10 — Essential web vertical slice**. Remaining governed work is tracked in [`docs/product/backlog.md`](./docs/product/backlog.md); Delivery 11 still requires explicit authorization.
