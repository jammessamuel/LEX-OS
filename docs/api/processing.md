# Processing API

**Status:** Extended during authorized Delivery 11

**Last updated:** 2026-08-18

## Contract summary

PostgreSQL is the product-visible source of truth. Redis carries only a strict schema-v1 envelope with `processingJobId`, `organizationId`, and `correlationId`; file metadata, content, extracted text, storage locations, and secrets never enter queue messages.

All routes require an authenticated actor. Tenant identity comes from the session, `documents.read` protects progress/extraction reads, and `documents.manage` protects reprocessing. Case confidentiality and soft-delete rules are inherited by processing artifacts. Unknown, foreign-tenant, or inaccessible resources return the same opaque `404 NOT_FOUND`.

## Routes

| Method | Route                                    | Permission         | Behavior                                                         |
| ------ | ---------------------------------------- | ------------------ | ---------------------------------------------------------------- |
| GET    | `/api/v1/processing-jobs`                | `documents.read`   | Keyset-paginates authorized persistent jobs                      |
| GET    | `/api/v1/processing-jobs/:id`            | `documents.read`   | Returns safe progress and failure metadata                       |
| GET    | `/api/v1/documents/:id/extractions`      | `documents.read`   | Lists immutable executions and their entities                    |
| POST   | `/api/v1/extracted-entities/:id/confirm` | `documents.manage` | Records one human confirmation without changing extracted values |
| POST   | `/api/v1/documents/:id/reprocess`        | `documents.manage` | Appends a new queued OCR-root execution                          |

Job lists accept `limit`, `cursor`, and optional `caseId`, `documentId`, `jobType`, `status`,
`provider`, and `modelName`. This makes execution cost queryable under the authenticated organization
by case, provider, and model. Extraction lists accept `limit`, `cursor`, and optional
`extractionType`. Both use descending `(createdAt, id)` ordering and opaque cursors.

Responses deliberately omit job input metadata, file names, storage keys, checksums, signed URLs, queue internals, and document content. Job output metadata is a small safe stage/progress/result-ID allowlist. Extraction responses preserve provider, model, version, prompt version, execution ID, timing, confidence, validated structured data, and source offsets.

Extracted entities expose `confirmedByUser`, `confirmedById`, and `confirmedAt`. Confirmation is single-assignment and transactional: concurrent attempts yield one success and one conflict, the source extraction and extracted values remain unchanged, and the audit stores only review metadata rather than legal content.

Completed provider jobs expose `provider`, `modelName`, `modelVersion`, exact six-decimal
`costAmount`, and `costCurrency`. Pending work exposes any reserved maximum separately. Values are
normalized to BRL by the configured cost policy; provider-native billing metadata must remain in a
governed adapter rather than being inferred from document count.

## Processing behavior

The deterministic development graph is:

```text
FILE_VALIDATION -> OCR -> DOCUMENT_CLASSIFICATION -> ENTITY_EXTRACTION
                -> TIMELINE_GENERATION -> CHECKLIST_ANALYSIS -> EMBEDDING
```

Each stage is a separate persistent job and BullMQ delivery. A worker claims `QUEUED` or `RETRYING` with an optimistic `status + version` update, increments attempts, writes results/next job/audits in a short transaction, and publishes the child only after commit. Completed, failed, or cancelled duplicate deliveries are acknowledged without repeating results.

Classification uses the global/same-tenant `OUTRO` type with deliberately low mock confidence. Timeline and checklist stages append their own immutable executions; timeline events start unconfirmed and checklist matches start `AWAITING_VALIDATION`. When the case type has no active checklist template, `CHECKLIST_ANALYSIS` still completes: it records `templateAvailable: false` and `itemCount: 0`, appends no extraction or case checklist, and continues to `EMBEDDING`. A missing template is not a document failure. `EMBEDDING` then normalizes and chunks the latest completed OCR extraction, records hashes/locators/provider metadata, and inserts exact-search vectors idempotently. The chain finishes with the document `NEEDS_REVIEW`. Reprocessing requires an `AVAILABLE/CLEAN` file, rejects another active chain with `409 DOCUMENT_PROCESSING_ACTIVE`, creates a fresh OCR root, and never overwrites earlier extractions or chunks.

`VIRUS_SCAN` remains fail-closed: the deterministic scanner outage retries with bounded exponential backoff and finishes as a safe failure while the object stays quarantined. A periodic reconciler republishes stale `QUEUED`/`RETRYING` rows missing from Redis.

## Production boundary

Mock text/OCR, classification, entity, timeline, checklist, embedding, language-model, cost-policy, and scanner adapters refuse production startup. Retrieval and grounded answering use deterministic development/test adapters only. The backend does not yet implement real provider calls, cancellation HTTP, or full user administration. Supervised audit browsing and the Delivery 10 essential UI are implemented; Delivery 11 verifies their complete fictional path without broadening the product surface.
