# Local development topology

**Status:** Updated through Delivery 10
**Last updated:** 2026-08-13

## Purpose

The local environment provides deterministic infrastructure for API, worker, and web development without coupling the product to a hosted vendor. A single Compose project starts PostgreSQL with pgvector, Redis, private object storage, a local SMTP sink, and all three application processes.

## Topology

| Service       | Container port | Default host binding | Persistence              |
| ------------- | -------------- | -------------------- | ------------------------ |
| PostgreSQL    | 5432           | 127.0.0.1:5433       | `postgres_data` volume   |
| Redis         | 6379           | 127.0.0.1:6379       | `redis_data` volume      |
| MinIO API     | 9000           | 127.0.0.1:9000       | `minio_data` volume      |
| MinIO console | 9001           | 127.0.0.1:9001       | `minio_data` volume      |
| Mailpit SMTP  | 1025           | 127.0.0.1:1025       | intentionally ephemeral  |
| Mailpit web   | 8025           | 127.0.0.1:8025       | intentionally ephemeral  |
| API           | 3000           | 127.0.0.1:3000       | stateless                |
| Web           | 5173           | 127.0.0.1:5173       | stateless                |
| Worker        | none           | none                 | stateless readiness file |

All published ports bind to loopback. Containers use service names and container ports internally. PostgreSQL is published on 5433 to avoid colliding with a conventional local PostgreSQL on 5432.

## Environment preparation

From a clean checkout:

```bash
pnpm install --frozen-lockfile
cp .env.example .env
```

Replace all `replace-with-*` placeholders. `.env` is ignored and is the only local credential source. The applications do not silently invent missing values: environment, ports, dependency timeout, database, Redis, processing queue/retry/reconciliation policy, object storage, authentication token lifetimes, login-attempt policy, allowed web origin, log level, and worker readiness path are all parsed and validated before startup.

Production mode adds a fail-fast check for weak or recognizable placeholder secrets. Local defaults are never promoted implicitly into a production configuration.

## Operating the stack

```bash
pnpm infra:config
pnpm infra:up
pnpm infra:ps
pnpm infra:down
```

`infra:up` builds application images and waits until all long-running services are healthy. `minio-init` is a one-shot bootstrap container and must finish successfully. It creates the configured bucket if needed and explicitly sets anonymous access to `none`.

### Why `infra:dependencies` is a script

`docker compose up --wait` waits for every named service to reach running or healthy, and reports a container that _exits_ as a failure even when it exits `0`. `minio-init` creates the bucket and exits, so naming it alongside the long-running services made the command fail after the whole stack had come up correctly. CI caught this on its first clean run.

`infra/scripts/start-dependencies.mjs` waits on the long-running services, then runs the bootstrap as its own foreground step, which propagates the real exit code and guarantees the bucket exists before anything downstream needs it.

`infra:up` was exercised locally with Docker Compose v5.3.1. The dependency conditions on `api` and `worker` correctly accept the successful completion of `minio-init`, and the command returns only after PostgreSQL, Redis, MinIO, Mailpit, API, worker, and web report healthy.

`infra:down` removes containers and networks but preserves named volumes. Deleting volumes is an explicit destructive maintenance action and is not part of the ordinary command.

For host watch mode, start only dependencies with `pnpm infra:dependencies`, keep the project database on port `5433`, and then run `pnpm dev`. A separate local PostgreSQL on `5432` is outside this project and must not be selected by project commands.

### Windows notes

- Every workspace script is shell-agnostic and runs under PowerShell, `cmd`, and Git Bash alike. Keep it that way: no `VAR=value command` prefixes and no `set -a; . file` sourcing in `package.json`. When a script needs environment setup, put it in a Node runner, as `apps/worker/test/run-integration.mjs` does.
- `.gitattributes` pins the working tree to LF. Do not set `core.autocrlf=true` for this repository; CRLF on disk makes `pnpm format:check` fail on every tracked file even though the content is correct.
- `WORKER_READY_FILE` defaults to the POSIX path `/tmp/lex-os-worker-ready` because the Compose healthcheck reads that exact path inside the container. In host watch mode Node resolves it to `C:\tmp\lex-os-worker-ready` and creates the directory on demand. Override it in your local `.env` if you would rather keep `C:\tmp` clean.

## Database migration workflow

Delivery 3 uses `DATABASE_URL` for Prisma CLI and runtime database connections. The recommended local target is the Compose PostgreSQL service published on `127.0.0.1:5433`; this avoids changing an existing PostgreSQL installation on host port 5432.

```bash
pnpm db:format
pnpm db:validate
pnpm db:migrate:deploy
pnpm db:migrate:status
pnpm db:seed
pnpm test:integration
```

The seed refuses to run with `NODE_ENV=production`, requires an explicit local password, hashes it with Argon2id, and creates only reserved fictional fixtures. It can be rerun without duplicate records.

`pnpm db:reset` is a destructive development-only command. Confirm the exact host, port, and database before using it; never run it against production or a database containing data that must be retained.

## HTTP and authentication

The API is rooted at `/api/v1`. Interactive OpenAPI is available at `/api/v1/docs`, with machine-readable JSON at `/api/v1/docs/openapi.json`. The seeded administrator uses the fictional `.invalid` address declared in the seed and the local password supplied through `SEED_ADMIN_PASSWORD`; the password is never documented or logged.

Authentication settings are explicit environment values:

- `WEB_ORIGIN` is the only credentialed CORS origin;
- `AUTH_ACCESS_TOKEN_SECRET` signs HS256 access tokens and must be replaced with a production secret of at least 32 characters;
- `AUTH_ACCESS_TOKEN_TTL_SECONDS` and `AUTH_REFRESH_TOKEN_TTL_SECONDS` define access and refresh lifetime bounds;
- `AUTH_LOGIN_ATTEMPT_LIMIT` and `AUTH_LOGIN_ATTEMPT_WINDOW_SECONDS` define the Redis-backed brute-force policy.

The refresh token is an opaque `HttpOnly`, `SameSite=Strict` cookie scoped to `/api/v1/auth`. Browsers must send credentials for login/refresh/logout requests. See [Authentication and HTTP contract](../api/authentication.md), [People, cases, and participants API](../api/people-cases-participants.md), [Files and documents API](../api/files-documents.md), and [Processing API](../api/processing.md) for route details.

## Processing configuration

`PROCESSING_QUEUE_PREFIX` namespaces every BullMQ key. Attempts, backoff, worker concurrency, stale-job threshold, and reconciliation interval are explicit bounded environment settings. Use a distinct prefix for integration tests so a running development worker cannot consume their jobs.

The development worker consumes `file-validation`, `virus-scan`, `ocr-processing`, `document-classification`, and `entity-extraction`. It refuses production startup while deterministic mock providers are selected. Readiness is emitted only after the Nest context, database adapter, queue publishers, consumers, and initial reconciliation are initialized.

## File intake configuration

MinIO remains private. `OBJECT_STORAGE_ENDPOINT` is the API/worker endpoint; `OBJECT_STORAGE_PUBLIC_ENDPOINT` is used only to build browser-reachable signed downloads. `OBJECT_STORAGE_DOWNLOAD_URL_TTL_SECONDS` defaults to 60 seconds, while `OBJECT_STORAGE_QUARANTINE_STALE_AFTER_SECONDS` defines the reporting threshold for stale quarantine.

`FILE_INTAKE_MAX_FILE_BYTES`, `FILE_INTAKE_MAX_FILES_PER_REQUEST`, and `FILE_INTAKE_ALLOWED_MIME_TYPES` are required validated values. The repository defaults to 25 MiB, 10 files, and `application/pdf,image/jpeg,image/png,text/plain`. ZIP is not enabled. The bundled deterministic scanner is development/test-only and intentionally prevents a production startup until a real adapter is selected.

For a local smoke upload, authenticate using the documented login contract and send a fictional file without putting the token or local password in shell history or documentation:

```bash
curl --fail-with-body \
  -H "Authorization: Bearer $LEX_OS_ACCESS_TOKEN" \
  -F "files=@/absolute/path/to/fictional.pdf;type=application/pdf" \
  "http://127.0.0.1:3000/api/v1/cases/$LEX_OS_CASE_ID/files/upload"
```

The response contains file/document/job identifiers and statuses, never a storage key or checksum. Use the authenticated download-URL route rather than addressing the bucket directly.

## Health and readiness

- `GET /api/v1/health/live` reports only that the API event loop can serve a request.
- `GET /api/v1/health/ready` checks PostgreSQL, authenticated Redis, and MinIO with a configured upper time bound. It returns HTTP 503 if any dependency is down.
- `GET /api/v1/metrics` exposes process uptime, memory, request count, status classes, average request duration, and `processing.deferredEnqueues` for local operations. A rising `deferredEnqueues` value means jobs committed to PostgreSQL could not be published to Redis and are waiting for the reconciler; the work is recoverable, but the queue needs attention.
- the worker creates a mode-0600 readiness file only after its Nest application context starts, and removes it during graceful shutdown.

Compose health checks depend on these signals, so a process that merely exists but cannot reach required infrastructure is not considered ready.

## Logging and sensitive data

API and worker logs are newline-delimited JSON. Every record contains `correlation_id`; HTTP completion records also contain `request_id`, safe method/path data, status, and duration. Incoming identifiers are length/character validated before propagation, and query strings are not logged.

The shared logger recursively redacts password, secret, authorization, cookie, token, signed-URL, and Brazilian identity-document fields. It also strips credentials embedded in URLs. Application code must still avoid passing raw documents or unnecessary legal content to the logger.

## Delivery boundary

The accepted checkpoint remains Delivery 10 until the authorized Delivery 11 branch passes CI. The complete local stack, database and HTTP foundations,
tenant-aware legal/file modules, persistent mock processing, timeline/checklist review, hybrid
search, grounded mock answers, supervised audit retrieval, processing-cost ceiling, and essential
responsive web workflow are implemented. Delivery 11 extends Playwright through fictional case
creation, upload, worker processing, extraction, sourced timeline confirmation, and audit at desktop
and mobile breakpoints; it also adds dependency, recovery, and CI gates. E-mail behavior, complete
user administration, full person management, and real AI/OCR/scanner providers remain separately
governed. See the [operational runbook](../operations/runbook.md).
