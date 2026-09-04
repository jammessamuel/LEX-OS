# LEX OS operational runbook

**Status:** Delivery 16 accepted; production use remains blocked

**Last updated:** 2026-08-28

## Scope and safety boundary

This runbook covers a development or staging preview that contains fictional data only. It does not
authorize production onboarding, destructive purge, real provider activation, or an LGPD claim.
Production remains blocked by the controls listed below, especially a real malware scanner,
approved retention procedures, regional durable backups, restore objectives, international-transfer
governance, a named data-subject contact, and production provider adapters.

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

## Deploy (hosted demo)

- Front: `vercel build --cwd apps/web --prod --yes` then
  `vercel deploy --cwd apps/web --prebuilt --prod --yes`.
- Backend: `railway up --service api --detach` and `railway up --service worker --detach`
  from the repository root; the API pre-deploy runs `pnpm db:migrate:deploy`. The worker
  never runs migrations.
- CI performs no deploy, by design.

**A new required variable goes to the platform before the code that reads it.** The config
loader throws at startup, so a container missing one never becomes healthy, and Railway keeps
serving the previous deploy — which looks like nothing happened. Set it on **every service that
runs a Node process, in every environment**, with `--skip-deploys` so the change is inert until
you deploy:

```
railway variables --service api    --environment production --set K=V --skip-deploys
railway variables --service worker --environment production --set K=V --skip-deploys
railway variables --service api    --environment staging    --set K=V --skip-deploys
railway variables --service worker --environment staging    --set K=V --skip-deploys
```

Four places, not two: the project has **production and staging**, and both carry `api` and
`worker`. `web`, `postgres`, `Redis` and `minio` do not read the loader. Then add the line to
`.env.example` — CI builds its `.env` from that file — and to `docker-compose.yml`. Your own
`.env` is not in the repository and nobody can update it for you.

`CASE_ARCHIVE` is the current example: `fictional` or `real`, with no default. The current build
refuses `real` at startup in every environment, before opening an HTTP or worker entry. Staging
and production are `fictional` today. Do not change the value to admit a client archive: a future
approved delivery removes the startup guard only after the evidence package of ADR-012/016 is
complete.

## Preparar o demo para uma apresentação

Implantar o código não basta: o que o escritório vê são os registros já gravados no banco do
demo, e eles ficam com a forma do dia em que foram produzidos. Duas correções de 2026-09-03 — a
cronologia lendo as datas do documento e os dados identificados vindo do texto — só aparecem
depois de reprocessar. A ordem importa.

1. **Implante o worker antes do api.** Quem reprocessa é o worker; o api só recebe o pedido.
   O `railway.json` versionado é a variante do api: troque para a do worker (`worker/dist/main.js`,
   sem `preDeployCommand` e sem healthcheck), rode `railway up --service worker --environment
production --detach` e **restaure o arquivo imediatamente** — deixá-lo trocado faz o próximo
   deploy do api subir o worker.
2. **Implante o api:** `railway up --service api --environment production --detach`. O pre-deploy
   aplica migrações pendentes.
3. **Reprocesse os documentos do caso da apresentação.** Pela API, `POST /documents/{id}/reprocess`
   em cada um. Sem isto a cronologia continua mostrando os eventos antigos: extração é
   append-only, e o reprocessamento acrescenta a leitura nova preservando a anterior.
4. **Confira a cronologia na tela.** O sinal de que deu certo é a lista deixar de repetir a mesma
   linha e passar a trazer as datas de cada documento — admissão, pagamento, aviso prévio.

**Não rode `pnpm db:seed` contra o demo para "atualizar" o checklist.** O seed reescreve o
`slug` da organização e derruba o login que está nos seus atalhos. Exigência nova de checklist
entra por API, ou o slug volta na mão depois.

**Reveja as datas antes de apresentar.** Os prazos do demo são fixos e envelhecem: a agenda hoje
mostra três prazos vencidos e nada nos próximos sete dias, o que conta uma história pior do que a
verdadeira. Um escritório se reconhece numa agenda com algo vencido **e** algo à frente — remarque
as tarefas pela tela antes da conversa.

## Remaining production blockers

- real malware scanner and production OCR/embedding adapters;
- company-owned provider acceptance, transfer instruments and regional commitments compatible
  with ADR-012;
- retention, legal basis, data-subject, customer-offboarding, and irreversible-purge procedures;
- durable same-region PostgreSQL/object-storage backup policy with measured RPO/RTO and scheduled
  restore exercises;
- trusted reverse-proxy/IP policy, TLS, least-privilege service identities, alert routing, and secret
  rotation procedure;
- a production notification relay under ADR-013; inbound e-mail ingestion is post-MVP under ADR-016;
- a reviewed real-provider cost policy and explicit release path after the per-case ceiling;
- load/adversarial-file evidence representative of production volume.

Until these are accepted, use fictional data only and make no LGPD compliance claim.

## Incident basics

1. Identify the failing layer with readiness + logs (correlation ID first).
2. Never edit data manually in PostgreSQL; use migrations or documented procedures.
3. Never delete storage objects manually; reconciliation reports, humans decide.
4. Rotating secrets: update the platform variables (Railway/Vercel), redeploy, and revoke
   the old value at the provider. Secrets never enter Git, logs, or audit records.
