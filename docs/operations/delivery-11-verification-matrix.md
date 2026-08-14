# Delivery 11 verification matrix

**Status:** Implemented locally; acceptance awaits the branch CI result

**Last updated:** 2026-08-14

## Mandatory gates

| Concern                         | Executable evidence                                           | CI job                                       |
| ------------------------------- | ------------------------------------------------------------- | -------------------------------------------- |
| Formatting                      | `pnpm format:check`                                           | `quality`                                    |
| Lint                            | `pnpm lint` and local `.githooks/pre-commit`                  | `quality`                                    |
| Strict types                    | `pnpm typecheck`                                              | `quality`                                    |
| Unit/component contracts        | `pnpm test`                                                   | `quality`                                    |
| Prisma/migration review         | `pnpm db:validate`, migrate deploy/status on clean PostgreSQL | `quality`, `integration`, `e2e-and-recovery` |
| API/database/worker integration | `pnpm test:integration`                                       | `integration`                                |
| Build and Compose parity        | `pnpm build`, `pnpm infra:config`, container builds           | `quality`                                    |
| Dependency risk                 | `pnpm deps:audit` and GitHub dependency review on PR diffs    | `quality`, `dependency-review`               |
| Browser vertical slice          | `pnpm test:e2e` in desktop Chromium and Pixel 7 viewport      | `e2e-and-recovery`                           |
| PostgreSQL/object recovery      | `pnpm ops:recovery:rehearse`                                  | `e2e-and-recovery`                           |

All jobs are verification-only. The workflow contains no deploy, publish, cloud credential, or
production environment access.

## Product journey

`apps/web/e2e/critical-flow.spec.ts` covers, through the real browser/API/worker/data path:

1. login to the fixed fictional organization;
2. creation of an isolated fictional labor case with an assigned fictional user;
3. streamed text upload through the private intake boundary;
4. asynchronous seven-stage worker completion;
5. document review state, extracted text, entity provenance, and immutable execution history;
6. sourced preliminary timeline event;
7. human confirmation;
8. supervised audit filtering for `timeline.event.confirmed`.

The spec also retains permission-aware navigation, reload-safe server state, keyboard focus, no
horizontal overflow, and console/HTTP error collection at desktop and mobile breakpoints. Every run
uses generated case/file identifiers and contains no personal or legal data.

## Security abuse matrix

| Boundary               | Required negative evidence                                                                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication/session | generic invalid/blocked response, Redis brute-force limit, refresh rotation/replay revocation, logout revocation, password/token-free audit                    |
| Tenant and RBAC        | tenant spoof input ignored, foreign list/direct/mutation/relation paths hidden, granular permission denial, same-tenant composite FK rejection                 |
| Confidentiality        | unauthorized case, aggregate, document, download, processing, timeline, task, search, and person traversal do not reveal existence/counts                      |
| Input/file             | unknown fields, invalid UUID/cursor, MIME/signature mismatch, path-like name, oversized file, infection, scanner outage fail closed                            |
| Evidence/provenance    | invalid provider schema/locator rejected, unsourced AI event rejected, cross-case source rejected, immutable extraction retained                               |
| Queue/idempotency      | orphan delivery skipped, stalled claim resumed, duplicate delivery idempotent, retry bounded, enqueue gap reconciled, budget ceiling blocks provider           |
| Search/assistant       | tenant/confidential/deleted/stale source filtering occurs before ranking; prompt injection remains data; empty evidence refuses; every claim citation resolves |
| Audit/logging          | safe allowlists, query length instead of query, no snapshots on general route, no password/token/content/storage key/signed URL leakage                        |
| Storage consistency    | missing/stale/orphan objects reported without automatic deletion                                                                                               |

The executable assertions live in the API/worker/database integration suites and are deliberately
kept below the browser layer, where exact status, database constraints, redaction, concurrent races,
and foreign-tenant fixtures can be proved deterministically.

## Recovery and reconciliation evidence

The recovery rehearsal restores a real custom-format dump to a temporary database and compares core
table fingerprints. It also verifies an exact synthetic object through a temporary private bucket.
The worker integration suite republishes a stale persistent job missing from Redis, and the intake
integration suite reports missing/orphan storage state without deletion. Together these exercise
the two non-atomic boundaries described by ADR-003 and ADR-007.

## Acceptance boundary

Local completion is not acceptance by itself. Delivery 11 becomes accepted only after every
mandatory GitHub CI job passes for the branch/PR and review confirms the limitations in the runbook
and README. Production remains outside this acceptance.
