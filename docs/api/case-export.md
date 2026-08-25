# Case dossier export API

**Status:** Implemented in Delivery 15
**Last updated:** 2026-08-24

The dossier is the single document a firm sends to a client: the confirmed chronology, the
documental checklist, and — for every fact the model identified — the file, the page, and the
excerpt it came from. It is the one artefact that carries our differentiator outside the
system, to people who will never log in.

## Routes

| Method | Route                       | Permission   | Behavior                                         |
| ------ | --------------------------- | ------------ | ------------------------------------------------ |
| POST   | `/api/v1/cases/:id/exports` | `cases.read` | Queues the dossier and returns `202` immediately |
| GET    | `/api/v1/case-exports/:id`  | `cases.read` | Status, and the signed URL once it is ready      |

## Why it is a job

Assembling a PDF for a large case is bounded work, but it is not small: dozens of pages,
hundreds of rows, and megabytes of buffer inside whatever process is holding the request. The
repository's rule is that heavy work is persisted, enqueued, and returned from — so the export
is a `processing_job` of type `CASE_EXPORT` on its own `case-export` queue, and the worker
builds it.

That queue is deliberately **not** part of `processingQueueNames`. That map governs the AI
pipeline, where every job type has a provider, a model, and a per-execution cost. A PDF built
from rows already in the database has none of those, and forcing it into that map would mean
inventing a fictional provider to satisfy the cost model — which is how a cost control stops
meaning anything.

## The flow

`POST` persists the job, publishes it, and returns `202` with status `QUEUED`. If an export of
the same case is already `QUEUED`, `PROCESSING`, or `RETRYING`, the existing job is returned
instead of a second one: the button is visible, nothing happens on screen for a few seconds,
and clicking twice is the normal thing to do.

`GET` reports the status. The **permission is re-checked on every call** against the case, not
just at request time — someone who lost access to the case between asking and downloading must
not keep downloading because they held on to a job identifier.

When the job is `COMPLETED`, the response carries a freshly signed, short-lived `downloadUrl`
and its expiry. The URL is generated per call and stored nowhere: not in the job row, not in
the audit trail, not in logs. It is the credential.

Failures return the job with status `FAILED` and an `errorCode`, never a storage path or case
text in the message.

## What goes into the document

**Only confirmed facts.** The chronology contains events a person confirmed. Events the model
proposed and nobody verified are **counted** at the end of the section and never narrated. A
document a lawyer signs cannot blur what was checked with what was guessed.

**Every extracted datum shows its origin.** Each fact carries the document title, the page, and
the excerpt sliced from the extraction at the recorded offsets, plus provider, model, model
version, and confidence. The excerpt is capped at 240 characters, so a bad offset cannot dump
a whole page into the PDF.

**Dates respect the recorded precision.** A fact the record dates only to a month is printed as
a month. Inventing precision is the kind of error that surfaces when the other side points at
it.

**Confidentiality is on every page.** A case that is not `STANDARD` prints `documento sigiloso`
in the footer of every page, beside the process number.

## The words in the document

The dossier prints Portuguese, never enum codes. A PDF that reaches a client saying
`AWAITING_VALIDATION · obrigatório` announces that the page came out of an admin panel, and
that is the first thing that disqualifies the product in front of a partner.

The labels live in `@lex-os/shared/legal-vocabulary` because the screen and the exported
document describe **the same case**: if they diverge, the client reads one thing in the PDF
and the lawyer sees another on screen, and the difference surfaces in the meeting where
someone compares them. The web keeps its own typed maps against the API contract, and
`apps/web/src/__tests__/vocabulary-drift.spec.ts` fails if the two ever disagree — it caught
four missing checklist statuses the first time it ran.

## Audit

`case.export.requested` records the job identifier. `case.export.downloaded` records the job
identifier and the URL lifetime. `case.export.generated` is written by the worker with the byte
size. None of the three carries the case title, any document text, the storage key, or the
signed URL. Exporting a confidential case appends the usual `case.confidential.read` entry with
`access: EXPORT`.

## Storage

The generated PDF is written by the worker under `exports/{organizationId}/{caseId}/{jobId}.pdf`
in the private bucket, with metadata `lifecycle: generated`. It is a file we produced, never one
someone uploaded, so it does not enter the quarantine and virus-scan path that governs intake.

That key is **derived, never stored**: it is a pure function of the three identifiers, computed
by the worker to write and by the API to sign. `outputMetadata` on the job holds only the byte
size, because the generic `GET /processing-jobs` route echoes that column verbatim and the
storage layout has no reason to leave the building.

## Cost

The Delivery 10 constraint `processing_jobs_completed_cost_recorded` requires provider, model,
model version and cost on every job that reaches `COMPLETED`. That rule is about ADR-011: an AI
execution must never finish without leaving what it cost.

A dossier is not an AI execution, so the constraint was narrowed to exempt `CASE_EXPORT` and a
second constraint, `processing_jobs_export_has_no_cost`, now asserts the opposite for it —
no provider, no cost, no reservation. Satisfying the old rule instead would have meant writing
a fictional provider and a zero cost into the ledger, and a cost report showing executions that
never happened is worse than no report.

## Recovering from a crash

An export whose worker died stays `PROCESSING`. The request route reuses an in-flight job only
while it is younger than `PROCESSING_STALE_AFTER_SECONDS`; past that, a new job is created.
Without that window a single worker crash would lock one case out of exporting forever.
