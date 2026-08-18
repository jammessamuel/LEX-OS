# Operational runbook

**Status:** Delivery 11 operational baseline
**Last updated:** 2026-08-18
**Language:** English, per the engineering-documentation convention in `AGENTS.md`.

This runbook covers the environments that exist today: the local/CI Compose stack and the
hosted demo (Vercel front, Railway backend). Every environment holds **fictional data only**;
production procedures for real client data remain blocked by the governance items in
`docs/product/backlog.md` (retention, legal hold, purge — ADR-012).

## Topology

| Environment | Front                     | API + worker           | Data                                      |
| ----------- | ------------------------- | ---------------------- | ----------------------------------------- |
| Local / CI  | Vite dev or Compose web   | Compose `api`/`worker` | Compose PostgreSQL, Redis, MinIO          |
| Hosted demo | Vercel project lex-os-web | Railway project lex-os | Railway postgres (pgvector), Redis, MinIO |

The Vercel front proxies `/api/v1/*` to the Railway API (`apps/web/vercel.json`), keeping the
refresh cookie same-origin. Railway configuration as code lives in `infra/railway/*.json`.

## Health and diagnosis

- Liveness: `GET /api/v1/health/live` — process only.
- Readiness: `GET /api/v1/health/ready` — PostgreSQL, Redis, and MinIO connectivity.
- Metrics: `GET /api/v1/metrics`.
- Local logs: `docker compose logs --no-color --tail 200 <service>`.
- Railway logs: `railway logs --service <api|worker> --lines 200`.
- Structured logs carry `correlation_id`; an API error envelope exposes `requestId` for
  cross-referencing without touching legal content.

Common failures:

| Symptom                                  | First check                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------ |
| Readiness lists a dependency as `down`   | The dependency container/service and its credentials in the environment  |
| Worker restart loop, mock-provider error | `NODE_ENV` — mock providers refuse `production` by design                |
| Healthcheck timeout on Railway           | Service variable `PORT` must match the API port (3000)                   |
| Uploads accepted but never processed     | Worker logs; processing budget ceiling on the case (`BRL` limit reached) |
| Login returns 429                        | Redis-backed brute-force window (5 attempts / 15 min per org+email+IP)   |

## Backup

The unit of backup is the PostgreSQL database plus the MinIO object volume. Redis holds only
queue state and login-attempt counters; it is rebuilt by the worker and is not backed up.

```bash
# Database (plain SQL dump, no owner/privilege statements)
docker compose exec -T postgres pg_dump --username "$DATABASE_USER" \
  --dbname "$DATABASE_NAME" --no-owner --no-privileges > backup.sql

# Objects (from the MinIO volume; requires the stack running)
docker compose exec -T minio sh -c 'tar -cf - /data' > minio-data.tar
```

For the Railway demo, use `railway ssh` (or a one-off pre-deploy command when SSH is blocked)
to run the same `pg_dump`, and treat the MinIO volume as rebuildable demo fixture.

## Restore

```bash
# Destroy and restore the database schema
docker compose exec -T postgres psql --username "$DATABASE_USER" --dbname "$DATABASE_NAME" \
  --command 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
docker compose exec -T postgres psql --username "$DATABASE_USER" --dbname "$DATABASE_NAME" \
  --set ON_ERROR_STOP=on < backup.sql

# Verify
pnpm db:migrate:status
```

After a restore, run the storage reconciliation review: the worker reports missing, stale
quarantine, and orphan objects **without deleting legal evidence** — deletion decisions are
always human.

## Rehearsal

The rehearsal is automated and runs in CI after the integration tests, against synthetic
data only:

```bash
node infra/scripts/backup-restore-rehearsal.mjs
```

It dumps the seeded database, drops the schema, restores from the dump, and verifies that
the fictional seed organization and the migration ledger survived. A rehearsal that only
lives in a document is a rehearsal that fails when needed.

## Deploy (hosted demo)

- Front: `vercel build --cwd apps/web --prod --yes` then
  `vercel deploy --cwd apps/web --prebuilt --prod --yes`.
- Backend: `railway up --service api --detach` and `railway up --service worker --detach`
  from the repository root; the API pre-deploy runs `pnpm db:migrate:deploy`. The worker
  never runs migrations.
- CI performs no deploy, by design.

## Incident basics

1. Identify the failing layer with readiness + logs (correlation ID first).
2. Never edit data manually in PostgreSQL; use migrations or documented procedures.
3. Never delete storage objects manually; reconciliation reports, humans decide.
4. Rotating secrets: update the platform variables (Railway/Vercel), redeploy, and revoke
   the old value at the provider. Secrets never enter Git, logs, or audit records.
