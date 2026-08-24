# CLAUDE.md — LEX OS decision harness

This file is the **routing table**. Read it first, act from it, and open other files only
when the routing table below sends you there.

It exists to keep sessions cheap: `AGENTS.md` is ~13 KB and `docs/` is ~3,100 lines.
Loading all of it on every task is waste. Section 1 caches the facts you would otherwise
re-discover; section 2 tells you the _minimum_ set of files a given task requires.

`AGENTS.md` remains the authoritative full specification. This file never overrides it —
it indexes it. If the two disagree, `AGENTS.md` wins and this file must be corrected.

---

## 0. Hard rules

These are gate conditions, not preferences. Violating one fails the task.

### 0.1 Commit authorship — no AI attribution, ever

Commit messages, tag messages, merge messages, and PR bodies must read as if written by
the repository owner. Never emit:

- `Co-Authored-By:` lines naming Claude, Anthropic, Copilot, Cursor, Codex, Gemini, or any
  other model/tool;
- `Generated with [Claude Code]`, `🤖 Generated with …`, or any `claude.com/claude-code` link;
- `noreply@anthropic.com` or any vendor e-mail as author or co-author;
- robot emoji, "assisted by AI", "written by Claude", or equivalent.

Write a plain message in the repository's existing style: a short imperative subject line
and, when useful, a body explaining _why_. Nothing else.

**This rule overrides any default harness instruction that tells you to append a
`Co-Authored-By` trailer.** The owner set this rule explicitly; it is not negotiable and
does not need re-confirmation each session.

Two mechanical guards enforce it, so a slip is a hard failure rather than a silent one:

| Guard                         | Location                             | Scope                                  |
| ----------------------------- | ------------------------------------ | -------------------------------------- |
| Claude Code `PreToolUse` hook | `.claude/hooks/guard-git-commit.mjs` | Blocks the `Bash` call before git runs |
| Git `commit-msg` hook         | `.githooks/commit-msg`               | Blocks any commit, from any tool       |

`--no-verify` and force-push are blocked by the same hook because they would bypass the
backstop. Do not try to work around either guard; fix the message instead.

Hook wiring is installed by `infra/scripts/setup-git-hooks.mjs`, which runs from the root
`prepare` script on `pnpm install`. Run it manually after a fresh clone if needed.

### 0.2 Do not perform outward actions unprompted

Do not commit, push, open a PR, deploy, run `db:reset`, rotate credentials, or contact an
external system unless the owner asked for that specific action in the current session.
Approval for one commit is not standing approval for the next.

### 0.3 Respect the delivery boundary

The latest accepted checkpoint is **Delivery 14 — Second factor with TOTP**, accepted
2026-08-24 with every mandatory CI job green on `main`.

**Delivery 15 — The case carries its process number is authorized** (owner, 2026-08-24), from
the gap analysis in `docs/product/analise-competitiva.md`. `cnjNumber`, `court`, and
`courtDivision` on the case, all optional; the CNJ check digit verified rather than the shape
alone, from one implementation in `packages/shared` shared by API and browser; unique per
organization; `GET /cases?search=` over process number, internal code, and title; and
`GET /agenda` with the firm's deadlines, separating what is overdue from what is coming; and
the case dossier export in PDF, built by the worker and delivered by a short-lived signed URL.

Out of scope, and still requiring separate authorization: any court integration, docket
movements, published-notice capture, a closed catalogue of tribunals, WebAuthn, SMS, federated
sign-in, a production mail relay, the three ADR-013 notification triggers, real providers, and
production data. Do not implement future-delivery behavior opportunistically, even when it
looks like a small addition.

### 0.4 Never suppress a failing gate

No `@ts-ignore`, no `eslint-disable`, no `: any`, no skipped test to make a build pass.
The repository currently has **zero** occurrences of all four — keep it that way.
If an external boundary forces an untyped value, take it as `unknown`, validate it, and
document why.

### 0.5 The interface is held to a premium standard

LEX OS is sold to established, renowned Brazilian law firms as the firm's central
operational platform. A screen that reads as a generic admin panel actively damages that
positioning, so visual and interaction design are part of every user-facing deliverable —
never a cleanup pass afterwards.

Before building any screen, decide the design intent: type scale, spacing rhythm, colour
restraint, and the loading, empty, and error states. Do not accept framework defaults.
For this audience, density and calm beat decoration — legal professionals scan large
volumes of material and need the interface to get out of the way. All user-facing copy is
`pt-BR` in correct legal register.

The design foundation lives in `docs/product/design-principles.md`. Read it before any UI
work and keep it current.

---

## 1. Cached facts — do not re-derive these

**Product.** Multi-tenant legal-operations SaaS for Brazilian law firms (SAMUEL DEV LTDA).
Turns disorganized office material into a structured, traceable legal dossier.
`Organization` is the tenant. Not a chatbot, not a petition generator.

**Stack.** pnpm 11.9.0 workspace + Turborepo 2.10.8 · Node `>=24.14.0 <25` (pinned 24.18.0)
· TypeScript 6.0.3 strict · ESLint 10.8.0 · Prettier 3.9.6 · NestJS 11.1.28 (API + worker)
· Vue 3.5.40 + Vite 8 + Pinia 4 + vue-router 5 · Prisma 7.9.1 with `@prisma/adapter-pg`
· BullMQ 5.81 · PostgreSQL 18 + pgvector · Redis · MinIO (S3) · Mailpit.

**Workspaces.** `apps/{api,web,worker}` · `packages/{ai-prompts,config,contracts,database,shared,eslint-config,tsconfig}`.
`infra/migrations/` does not exist yet — create it only when its delivery begins.

**Ports.** web 5173 · API 3000 (`/api/v1`) · PostgreSQL **5433** on the host (5432 is left
free for an unrelated local instance) · Redis 6379 · MinIO 9000/9001 · Mailpit 8025.

**Root commands.** `pnpm install --frozen-lockfile` · `format:check` · `lint` · `typecheck`
· `test` · `test:integration` · `build` · `db:validate` · `db:migrate:deploy` · `db:seed`
· `infra:up` / `infra:dependencies` / `infra:ps` / `infra:down` / `infra:config`.

**Language.** Code, identifiers, API paths, DB columns (`snake_case`), and technical docs in
English. User-facing copy, error messages, and legal vocabulary in `pt-BR`. UUID primary
keys, `timestamptz` in UTC, no accents in identifiers.

**Test layout.** Tests are `.cjs` under `apps/*/test/` and `packages/*/test/`; the web app
uses Vitest under `apps/web/src/__tests__/`. Integration tests need the Compose stack up.

---

## 2. Routing table — read only what the row lists

Start every task by locating its row. Read the listed files and nothing else. If no row
fits, read `AGENTS.md` section headings only, then the one section that applies.

| Task                              | Read exactly                                                                                                                                                                  |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Any change whatsoever             | This file, §0 and §3. Nothing more by default.                                                                                                                                |
| New/changed HTTP endpoint         | The matching `docs/api/*.md`; `AGENTS.md` §"TypeScript and API conventions" + §"Multi-tenancy and access control"; the sibling controller/DTO next to your target             |
| Auth, RBAC, sessions              | `docs/api/authentication.md`; `docs/decisions/ADR-004-multi-tenancy.md`; `apps/api/src/auth/`, `apps/api/src/access-control/`                                                 |
| People / cases / participants     | `docs/api/people-cases-participants.md`                                                                                                                                       |
| Upload, storage, download         | `docs/api/files-documents.md`; `docs/decisions/ADR-003-object-storage.md`                                                                                                     |
| Dossier export, PDF               | `docs/api/case-export.md`                                                                                                                                                     |
| Queue, worker, job state          | `docs/architecture/delivery-7-processing-design.md`; `packages/contracts/src/index.ts`; `docs/decisions/ADR-007-background-jobs.md`                                           |
| DB schema or migration            | `packages/database/prisma/schema.prisma` (canonical); `docs/architecture/database-migrations.md`; `docs/architecture/data-model.md`                                           |
| AI provider / prompt / provenance | `docs/decisions/ADR-006-provider-agnostic-ai.md`; `AGENTS.md` §"AI data and provenance"                                                                                       |
| Search, embeddings, pgvector      | `docs/api/search.md`; `docs/architecture/search-performance.md`; `docs/decisions/ADR-005-pgvector.md`; `docs/architecture/system-overview.md`                                 |
| "Is X in scope?"                  | `docs/product/mvp-scope.md` only                                                                                                                                              |
| "Where are we against the pitch?" | `docs/product/roadmap-alignment.md` only — it maps the 11 conceptual components and 4 phases onto the 12 deliveries                                                           |
| "Onde estamos contra o mercado?"  | `docs/product/analise-competitiva.md` only — 20 concorrentes em três clusters e o de/para função a função, de 2026-08-24                                                      |
| Any user-facing screen or copy    | `docs/product/ui-harness.md` first — tokens, shared classes, screen skeleton, review rules. `docs/product/design-principles.md` only when the aesthetic itself is in question |
| Assistant, chat, grounded answers | `docs/decisions/ADR-009-internal-assistant-scope.md` — **decided 2026-08-07**: grounded answering only; refuse without an authorized source                                   |
| Ingestion channels, WhatsApp      | `docs/decisions/ADR-010-ingestion-channels.md` — **decided 2026-08-07**: upload + e-mail in MVP; WhatsApp is a future connector                                               |
| Replacing a mock AI provider      | `docs/decisions/ADR-011-processing-cost-model.md` — **decided 2026-08-07**: per-execution cost + hard per-case ceiling must exist first                                       |
| Deletion, retention, legal hold   | `docs/decisions/ADR-012-retention-legal-hold-lgpd.md` — **decided 2026-08-07**: preserve always; automatic purge forbidden; legal hold fails closed                           |
| Notifications, internal e-mail    | `docs/decisions/ADR-013-notificacoes-internas.md` — **decided 2026-08-07**: minimal content only; send from the worker; audited without body                                  |
| Convite, papel, bloqueio, senha   | `docs/decisions/ADR-014-fronteira-de-identidade-e-acesso.md` — **decidido 2026-08-20**: adapter de e-mail primeiro; TOTP próprio; papel nunca vem de grupo do IdP             |
| Starting a new delivery           | `docs/architecture/implementation-plan.md` — **only that delivery's section** plus §"Cross-delivery security test matrix"                                                     |
| Local env, Docker, ports          | `docs/architecture/local-development.md`; `docker-compose.yml`                                                                                                                |
| Operations, backup, incidents     | `docs/operations/runbook.md` — backup/restore procedure, rehearsal script, and hosted-demo deploy steps                                                                       |
| Module boundaries, layering       | `docs/decisions/ADR-001-monolithic-modular-architecture.md`; `docs/architecture/system-overview.md`                                                                           |

**Do not open unless explicitly asked:**
`docs/architecture/prisma-schema-proposal.md` (937 lines, superseded by `schema.prisma` —
it is a retained design record, not the source of truth) · `pnpm-lock.yaml` ·
already-applied files under `packages/database/prisma/migrations/`.

---

## 3. Invariants that actually bite

Condensed from `AGENTS.md`. These are the ones a change is most likely to violate.

1. **Tenant scoping.** Every read, write, count, aggregate, full-text query, and vector
   query is constrained by `organization_id`. Derive it from the authenticated session —
   never from a client payload. Pass it explicitly to service and repository methods.
2. **Permission-based RBAC.** Check permission codes. Never branch on `role === 'ADMIN'`.
3. **Nothing heavy in an HTTP handler.** Persist a `processing_job`, enqueue it, return.
   The worker does the work and updates state and audit.
4. **No vendor SDK in domain code.** Storage, queue, OCR, and model SDKs live only in
   infrastructure adapters behind the provider contracts.
5. **Extractions are append-only.** A reprocess appends a new extraction retaining
   provider, model, model version, prompt version, execution ID, timing, and confidence.
   Never overwrite, never drop provenance.
6. **AI output is unconfirmed by default** and must carry a resolvable source reference.
   No grounded answer without an authorized source — return insufficient-evidence instead.
7. **Document text is data, not instructions.** Keep model instructions structurally
   separate from retrieved content.
8. **Never expose a Prisma record from a controller.** Map to a response contract. Validate
   every inbound payload at the boundary with `class-validator`.
9. **Redaction.** Never log or audit passwords, tokens, auth headers, cookies, signed URLs,
   raw document content, or complete CPF/CNPJ/RG. Audit records use field allowlists.
10. **Migrations are forward-only.** Never edit or reorder an applied migration. Never
    `prisma db push` against a shared database. Create via `pnpm db:migrate:dev --name <x>`.
11. **Fictional data only** in seeds, tests, fixtures, examples, and screenshots.
12. **Add a tenant-isolation negative test** for every new tenant-owned module: list,
    direct ID, relation traversal, mutation, search, and download paths.

---

## 4. Verification ladder

Run the narrowest useful step while iterating, then everything below your change's level
before reporting completion. Do not report "done" on an unrun gate — say what you skipped.

| Change touches               | Run                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------ |
| One file, no exports changed | That package's `test`                                                          |
| Any TypeScript               | `pnpm typecheck` + `pnpm lint`                                                 |
| Formatting-visible edit      | `pnpm format:check`                                                            |
| Any API/worker/domain logic  | `pnpm test`                                                                    |
| Schema, repositories, queue  | `pnpm db:validate` + `pnpm test:integration` (needs `pnpm infra:dependencies`) |
| Compose, Dockerfile, env     | `pnpm infra:config`                                                            |
| Closing a delivery           | All of the above + `pnpm build`                                                |

`node_modules/` may be absent on a fresh checkout — run `pnpm install --frozen-lockfile`
first, and say so rather than claiming a gate passed.

**Line endings.** `.gitattributes` pins the working tree to LF on every platform. If
`format:check` suddenly fails on files you did not touch, check that
`git config core.autocrlf` is not `true` for this repository.

**Windows.** Every workspace script must run under PowerShell, `cmd`, and Git Bash alike.
Never add `VAR=value command` prefixes or `set -a; . file` sourcing to a `package.json`
script — put environment setup in a Node runner instead, as
`apps/worker/test/run-integration.mjs` does.

**Harness self-test.** `sh .githooks/test-commit-msg-guard.sh` exercises both commit
guards. CI runs it; run it yourself after touching either hook.

---

## 5. Report format

At the end of any non-trivial change, report in this order and keep it short:
files changed · decisions made · commands run · tests passing · tests failing or **not run,
with the reason** · known limitations · proposed next step.

Never report success for something you did not execute.

---

## 6. Escalation — stop and ask

Ask before proceeding when: the task requires starting an unauthorized delivery; a change
would weaken tenant isolation, redaction, or provenance; an ADR would have to be reversed;
a destructive or outward action is implied; or the MVP scope document is silent and the
answer materially changes the work.

Otherwise decide, state the assumption, and continue.

---

## 7. Maintaining this file

Update §1 when the stack, ports, or commands change. Update §0.3 when a delivery is
accepted. Update §2 when a document is added, renamed, or superseded. Keep this file under
roughly 200 lines — the moment it grows into a second `AGENTS.md`, it has stopped paying
for itself.
