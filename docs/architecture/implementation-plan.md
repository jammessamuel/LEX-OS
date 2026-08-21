# Incremental implementation plan

**Status:** Delivery 13 accepted; Delivery 14 authorized

**Last updated:** 2026-08-20

## Delivery strategy

Build LEX OS as reviewable vertical increments. Each delivery must leave the repository buildable, tested for its risk, and documented. A delivery may prepare a narrow interface for the next step, but it must not implement unrelated future behavior.

No delivery is complete merely because code exists. Completion requires the stated acceptance checks, a report of commands/tests, and no ignored TypeScript or migration failure.

## Delivery 0 — Architecture baseline

**Scope**

- product vision and MVP boundary;
- root agent/project rules;
- modular-monolith, tenancy, storage, job, AI, and search design;
- initial entity model and Prisma proposal;
- eight mandated ADRs;
- incremental plan and explicit open decisions.

**Acceptance**

- all documents are internally linked and use consistent terminology;
- the schema covers only the requested initial domain tables plus documented authentication support;
- every AI-derived record has a provenance path;
- every tenant-owned relationship has a documented isolation strategy;
- no product runtime, frontend, database, or infrastructure code has begun.

## Delivery 1 — Monorepo quality foundation

**Scope**

- initialize Git only if the user requests it;
- root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, lockfile, `.gitignore`, `.editorconfig`, `.npmrc`, `.env.example`;
- shared strict TypeScript, ESLint, and Prettier packages/configuration;
- minimal `apps/api`, `apps/worker`, and `apps/web` bootstraps with no product features;
- root scripts for format, lint, typecheck, test, build, and database validation;
- Husky/lint-staged only after Git exists;
- README with prerequisites and commands.

**Acceptance**

- supported Node and pnpm versions are pinned and documented;
- `pnpm install --frozen-lockfile`, format check, lint, typecheck, tests, and build pass;
- API, worker, and web each have one deterministic smoke test;
- no service requires a real AI credential;
- no secret or local `.env` is tracked.

## Delivery 2 — Local infrastructure and health

**Scope**

- Docker Compose for PostgreSQL/pgvector, Redis, MinIO, API, worker, web, and optional Mailpit;
- named development volumes and private MinIO bucket bootstrap;
- validated typed configuration with fail-fast production rules;
- API liveness/readiness endpoints and bounded dependency checks;
- worker startup/readiness signal;
- structured logging with request/correlation IDs.

**Acceptance**

- `docker compose config` succeeds;
- one documented command starts all required services;
- health checks become healthy from a clean checkout;
- no development default is silently accepted in production mode;
- stopping/restarting containers preserves intended volumes;
- logs contain correlation IDs and no secrets.

## Delivery 3 — Database, migration, and fictional seed

**Scope**

- executable Prisma schema based on the reviewed proposal;
- initial migration with pgcrypto, pgvector, composite tenant constraints, partial indexes, and checks;
- Prisma client package and transaction helper;
- idempotent fictional seed for organization, admin, roles, permissions, document types, and demo case;
- authentication support table for hashed refresh sessions;
- migration validation in CI/local scripts.

**Acceptance**

- format/validate/migrate/reset/seed work on a clean database;
- generated SQL is reviewed and documented;
- negative SQL/integration tests prove representative cross-tenant relations fail;
- partial uniqueness works for global and tenant records;
- seed reruns without duplication and contains no real data;
- no binary or plaintext token/password is stored.

## Delivery 4 — HTTP platform, authentication, tenant, and RBAC

**Scope**

- `/api/v1`, OpenAPI, DTO validation, error envelope, pagination primitives;
- login, refresh rotation/revocation, logout, blocked-user checks, last login;
- Argon2id and rate limiting/brute-force controls;
- request actor/tenant context and current organization;
- permission catalog/policy guard;
- safe audit service and authentication audit events.

**Acceptance**

- valid/invalid/blocked login and refresh replay/revocation tests pass;
- authorization is permission-based, not role-name branching;
- body/query/path tenant spoofing cannot change tenant context;
- errors do not enumerate users or cross-tenant resources;
- token/audit/log assertions prove sensitive values are absent;
- API contract and OpenAPI tests pass.

## Delivery 5 — People, cases, and participants

**Scope**

- tenant-aware person, case, and participant repositories/services/routes;
- CPF/CNPJ normalization and safe output/log policy;
- case internal-code uniqueness, responsibility, status, priority, confidentiality;
- participant role/side validation;
- audit for material mutations and confidential access.

**Acceptance**

- CRUD and validation tests pass for authorized users;
- list, direct ID, relation, update, and confidential-read cross-tenant tests fail safely;
- a participant cannot link a case/person across organizations at application or database level;
- soft-deleted data is excluded from ordinary queries;
- audit records use safe field allowlists.

## Delivery 6 — Secure file intake and documents

**Scope**

- private object-storage adapter and local MinIO implementation;
- streamed multipart upload for authorized cases;
- size/count allowlists, filename sanitation, generated keys, SHA-256, MIME/signature validation;
- quarantine/status lifecycle and virus-scanner interface/mock;
- same-tenant duplicate detection/linkage;
- file/document/job creation transaction and short-lived download authorization;
- orphan/stale intake reconciliation baseline.

**Acceptance**

- accepted file appears privately in MinIO and its hash/metadata persist;
- invalid, oversized, mismatched-MIME, path-like filename, and scanner-failure cases are safe;
- duplicate uploads are recorded without cross-tenant disclosure;
- unauthorized and confidential downloads are denied before URL generation;
- API does not buffer a test large file in full;
- no binary is stored in PostgreSQL;
- upload/download/duplicate/rejection audits are present and redacted.

ZIP extraction remains disabled unless expanded-size, recursion, file-count, path traversal, symlink, and archive-bomb controls are included and tested.

## Delivery 7 — Persistent mock processing pipeline

**Scope**

- versioned queue contracts and BullMQ adapter;
- processing-job transition service with optimistic guards;
- API enqueue and separate worker processors;
- deterministic mock OCR/text/classification/entity providers;
- immutable extraction/entity persistence;
- retry/idempotency, stale queued-job reconciler, safe failure metadata;
- progress query endpoints and audits.

**Acceptance**

- HTTP returns before heavy processing;
- worker consumes by `processingJobId` and reloads/validates tenant state;
- creation, allowed transitions, retry, terminal failure, cancellation-ready path, and recovery tests pass;
- duplicate delivery does not duplicate one logical execution result;
- extraction metadata identifies mock provider/model/execution;
- AI/system actor types are correct;
- a browser/API refresh reconstructs processing state from PostgreSQL.

## Delivery 8 — Timeline and checklist review

**Scope**

- deterministic sourced timeline provider/output;
- source locator and extraction linkage;
- unconfirmed-by-default event creation and human confirmation;
- seed/versioned checklist template, application to case, mock analysis, item updates;
- traceable task creation for selected pending items;
- routes and audit events.

**Acceptance**

- no AI event can be created without a valid same-tenant source;
- AI events remain unconfirmed until an authorized human action;
- confirmation records user/time and preserves original extraction;
- checklist snapshot stays stable if a template is later deactivated;
- cross-tenant event/checklist/source/document links fail;
- timeline, checklist, confirmation, and audit tests pass.

## Delivery 9 — Text and semantic search foundation

**Scope**

- deterministic normalization/chunking with locators and hashes;
- PostgreSQL full-text index/query;
- mock embedding provider and pgvector exact search;
- hybrid ranking adapter and structured filters;
- permission/confidentiality enforcement and source-shaped results;
- insufficient-evidence response contract;
- sensitive-search audit.

**Acceptance**

- repeated indexing is idempotent;
- lexical and vector searches filter in the database by organization and authorized scope;
- cross-tenant, confidential, and deleted sources never appear in results or counts;
- every result contains a resolvable citation;
- no-answer behavior does not invent a response;
- selected query plans and synthetic-corpus performance are documented.

## Delivery 10 — Essential web vertical slice

**Scope**

- pt-BR accessible design foundation and authenticated shell;
- login, dashboard, case list/create/details;
- participants, upload, processing progress, documents;
- timeline confirmation, checklist, tasks, search, authorized audit;
- explicit placeholders for deferred case tabs;
- polling with backoff and recoverable error/empty/loading states.

**Acceptance**

- keyboard and screen-reader basics pass for the critical flow;
- session expiry/refresh and authorization failures are handled safely;
- progress recovers after reload and shows actionable failure states;
- client route visibility agrees with permissions but server denial remains authoritative;
- Vitest component/store tests and essential Playwright flow pass at responsive breakpoints;
- no technical database labels are exposed to users.

## Delivery 11 — Full MVP verification and CI hardening

**Scope**

- complete required unit/integration/API/E2E matrix;
- CI format, lint, typecheck, unit, integration, migration validation, build, and Playwright gates;
- end-to-end fictional organization → login → case → upload → worker → extraction → timeline → confirmation → audit flow;
- security abuse cases, dependency review, synthetic recovery rehearsal, and operational runbook;
- OpenAPI and architecture documents synchronized with implementation.

**Acceptance**

- all mandatory tests in the product specification pass in CI;
- CI performs no deploy;
- a clean-machine run follows README without undocumented steps;
- restore and reconciliation procedures are exercised with synthetic data;
- remaining limitations and production blockers are explicitly recorded.

**Implementation status (2026-08-20):** authorized and implemented on `main`. The
workflow now has every required quality/integration/Playwright/dependency/recovery gate and contains
no deploy step. The full fictional browser journey, guarded clean-machine bootstrap, synthetic
PostgreSQL/private-object recovery rehearsal, security coverage matrix, and operational runbook are
present. Accepted on 2026-08-20: every mandatory CI job passed on `main` at `ab9de3d`.

## Delivery 12 — Organization onboarding and user administration

Authorized by the owner on 2026-08-20. Until this delivery, a firm cannot add a second lawyer and
signing in requires pasting the organization UUID. Every other governed increment depends on it:
there is nobody to notify, assign, or address a case to.

**Scope**

- human-readable organization identity: a unique, immutable `slug` replaces the UUID at sign-in,
  and the login form accepts it prefilled from a link;
- user administration inside the tenant: list, invite, change roles, block, reactivate, and
  soft-delete, all behind permission codes and never behind a role name;
- invitation lifecycle: single-use hashed token with expiry, accepted by setting a password, which
  moves the user from `INVITED` to `ACTIVE`. The token is never stored in clear text, never
  logged, and never audited;
- role assignment over the existing `Role`/`UserRole`/`RolePermission` tables, restricted to
  roles that are global or belong to the acting tenant;
- deactivation revokes every refresh session of the target user in the same transaction, so a
  blocked lawyer loses access immediately rather than at token expiry;
- the pt-BR administration screens, with the same premium standard as the rest of the interface.

**Out of scope** — public self-service organization signup, billing, SSO, password recovery by
e-mail, and cross-organization users. Real client data stays blocked by ADR-012.

**Acceptance**

- sign-in never requires a UUID, and an unknown slug is indistinguishable from a wrong password;
- an invited user cannot authenticate before accepting, and a token is refused when reused,
  expired, or belonging to another tenant;
- a tenant-isolation negative test covers list, direct ID, invitation acceptance, role assignment,
  and deactivation, per the cross-delivery matrix;
- privilege escalation is impossible: a user cannot grant a permission they do not hold, cannot
  assign a role of another tenant, and cannot remove their own last administrative access;
- deactivation invalidates access within the same request, proven by an integration test that
  replays the refresh token afterwards;
- audit records every administrative action through the field allowlist, without password hash,
  token, or e-mail body;
- Playwright covers invite → accept → sign in with the slug → role change → block.

## Delivery 13 — E-mail adapter and password recovery

Authorized by the owner on 2026-08-20, resolving items 1 and 2 of
[ADR-014](../decisions/ADR-014-fronteira-de-identidade-e-acesso.md). It is the only remaining
item that pushes risk outside the system: today an invitation link is handed over by whatever
channel the administrator picks, and a forgotten password has no path but an administrator.

**Scope**

- an `EmailProvider` contract in `packages/shared`, with a deterministic development/test
  adapter that records instead of sending and an SMTP adapter for the local Mailpit and for a
  future production relay. The adapter is infrastructure: no domain code imports a mail SDK;
- **sending happens in the worker**, never in an HTTP handler, through a queued job. The API
  persists the intent and returns; the worker delivers and retries;
- password recovery: request and reset, reusing the invitation mechanism — single-use token,
  stored only as a hash, with expiry — pointing at an already active person;
- invitation delivery by e-mail, with the copyable link kept as the fallback for as long as no
  relay is configured;
- audit of every send with recipient identifier, template and outcome, **never the body, never
  the token, never the address in clear text beyond the allowlisted field**.

**Out of scope** — the three ADR-013 notification triggers with their opt-out preferences, a
production relay contract, and anything about deliverability. Those are separate increments.

**Acceptance**

- no mail SDK outside the infrastructure adapter, and the mock refuses production startup;
- a recovery request for an unknown, blocked, or invited address is indistinguishable from one
  that will arrive: the response never reveals whether an account exists;
- a reset token is refused when reused, expired, revoked, or belonging to another tenant, with
  the same message in every case;
- resetting a password revokes every open refresh session of that person in the same
  transaction, so a stolen session does not survive the recovery;
- the audit record carries no body, no token, and no password;
- the local flow is exercised end to end against Mailpit, and the tenant-isolation negative
  tests of the cross-delivery matrix cover request, reset, and resend.

## Delivery 14 — Second factor with TOTP

Authorized by the owner on 2026-08-20, resolving item 3 of
[ADR-014](../decisions/ADR-014-fronteira-de-identidade-e-acesso.md). A whole legal archive
behind one password is the first thing a security review asks about, and the decision recorded
there is explicit: our own TOTP, never delegated to an identity provider, because a second
factor that exists only for the clients who happen to have an IdP is not a control — it is an
exception to explain in every sale.

**Scope**

- RFC 6238 TOTP in `packages/shared`: HMAC-SHA1, 30-second step, six digits, with a one-step
  window on each side for clock drift. No dependency — the algorithm is thirty lines over
  `node:crypto`, and a library here would be a supply-chain surface for no gain;
- **the shared secret is encrypted at rest** with AES-256-GCM under a key from configuration.
  A database dump must not hand over the second factor; storing it in clear text would make
  the whole delivery theatre;
- enrolment: generate, present as an `otpauth://` URI, and activate **only after** the person
  proves a valid code. A secret that activates without proof locks people out;
- recovery codes issued once at activation, single-use, stored only as hashes — the same
  mechanics as the invitation token;
- sign-in asks for the code as a second step, and the failed-attempt counter covers it;
- the firm can require the second factor for everyone, and the person can enable it alone.

**Out of scope** — WebAuthn, SMS, and delegation to an identity provider (item 4).

**Acceptance**

- a code is accepted once and refused on replay inside the same step;
- a code from the previous or next step is accepted, and one two steps away is refused;
- the stored secret is unreadable without the configured key, proven by a test that inspects
  the column;
- enrolment cannot complete without a valid code, and a second enrolment cannot silently
  replace an active secret;
- a recovery code works once and only once, and using one is audited;
- brute force on the code is counted and blocked by the same Redis counter as the password;
- audit records enrolment, activation, and each verification outcome, never the secret, the
  code, or a recovery code;
- the tenant-isolation negative tests cover enrolment and verification.

## Governed follow-up increments

ADRs 009–013 define product policy that extends beyond the numbered Delivery 0–11 plan. They do not authorize opportunistic implementation. Each capability must receive a separate vertical increment with schema, security, audit, failure-path, and documentation acceptance criteria before coding begins:

- source-grounded assistant responses after Delivery 9 retrieval is accepted (ADR-009) — backend
  contract implemented with a deterministic mock during Delivery 10;
- authenticated e-mail ingestion that reuses the hostile-file intake pipeline (ADR-010);
- per-execution cost accounting and a hard recoverable case ceiling before any real provider
  (ADR-011) — backend and worker controls implemented during Delivery 10;
- fail-closed case legal hold and required governance procedures before real client data (ADR-012);
- minimum-content worker e-mail notifications with preferences and body-free audit records (ADR-013).

Governance and cost controls precede real providers. Retrieval precedes assistant responses. Inbound ingestion and outbound notification remain distinct increments. Exact ordering after Delivery 11 requires a reviewed plan update and explicit authorization.

## Cross-delivery security test matrix

Every tenant-owned capability must test at least:

- same-tenant allowed operation;
- different-tenant list exclusion;
- different-tenant direct-ID access;
- different-tenant relation/link attempt;
- missing granular permission;
- confidential resource without confidentiality permission;
- soft-deleted resource behavior;
- audit/log redaction;
- opaque not-found/forbidden behavior appropriate to the endpoint.

File, processing, AI, and search deliveries add malicious input, duplicate delivery, prompt injection, and source-provenance tests.

## Checkpoint report template

At the end of each delivery, report:

1. outcome and active acceptance criteria;
2. files created/changed;
3. architectural/product decisions made;
4. commands executed;
5. tests passed;
6. tests failed or not run, with reasons;
7. known limitations and security implications;
8. exact next proposed delivery.

## Next-step acceptance criteria

The Delivery 9 checkpoint is **Text and semantic search foundation**. It is complete only when:

- the persistent graph ends with a separate `EMBEDDING` job rather than indexing in HTTP;
- normalization/chunking is deterministic and retains resolvable source offsets and hashes;
- repeated processing and queue delivery do not duplicate one logical chunk;
- PostgreSQL Portuguese full-text and exact pgvector queries constrain organization, confidentiality, soft deletion, file state, source type, extraction state/version, and structured filters before ranking;
- hybrid ranking combines lexical and semantic ranks without assuming their raw scores share a scale;
- every returned excerpt maps to a same-document completed extraction citation;
- foreign-tenant, confidential, deleted, superseded, or malformed sources never appear in results or counts;
- empty authorized retrieval returns `INSUFFICIENT_EVIDENCE` and no invented response;
- search audit stores allowlisted dimensions but not the query or source content;
- prompt injection remains untrusted data and cannot alter authorization or tenant scope;
- synthetic `EXPLAIN (ANALYZE, BUFFERS)` evidence documents lexical GIN and exact-vector behavior;
- the full format, lint, typecheck, unit, integration, build, migration-validation, migration-status, and Compose gates pass.

That checkpoint is accepted. **Delivery 10 — Essential web vertical slice** is also accepted: its
responsive, permission-aware pt-BR interface uses real API contracts, exposes recoverable states,
and passes the component and essential desktop/mobile Playwright gates. Delivery 11 is authorized,
implemented locally, and awaits its mandatory CI result; governed follow-up increments remain
separately authorized work.
