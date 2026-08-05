# Delivery 7 processing design

**Status:** Authorized implementation contract  
**Last updated:** 2026-08-05

## Boundary

Delivery 7 turns the persisted `processing_jobs` rows from Delivery 6 into an asynchronous, observable mock pipeline. It implements queue publication/consumption, job state transitions, deterministic mock text/OCR, classification and entity extraction, append-only results, progress reads, reprocessing, retries and enqueue-gap recovery.

Timeline, checklist, task generation, embeddings/search, real OCR/AI/scanner providers and product UI remain outside this delivery.

## Queue contract

Every message is schema version 1 and contains only:

```json
{
  "schemaVersion": 1,
  "processingJobId": "uuid",
  "organizationId": "uuid",
  "correlationId": "bounded-safe-identifier"
}
```

No file bytes, extracted text, filename, bucket/key, credential, signed URL or rich database state enters Redis. The worker validates the message, reloads the authoritative row under both job and organization IDs, and validates its tenant-consistent file/document/case relationships.

BullMQ uses `processingJobId` as the queue-local job ID. Redis delivery is at least once; PostgreSQL is the product source of truth.

## Implemented stage graph

```text
FILE_VALIDATION
  -> OCR (mock OCR or text extraction selected by MIME)
  -> DOCUMENT_CLASSIFICATION (mock, always needs human review)
  -> ENTITY_EXTRACTION (mock, immutable entities)
  -> document NEEDS_REVIEW
```

`VIRUS_SCAN` remains fail-closed. The deterministic development scanner failure is retried and then becomes a safe terminal failure without releasing the quarantined object.

Each stage owns one persistent job and one queue. The previous job, its allowlisted audit, the derived immutable result and the next queued job are committed together in one short transaction. Publication of the next queue message occurs after commit. A deterministic child job UUID makes repeated completion idempotent.

## State machine

Allowed transitions are:

```text
QUEUED -> PROCESSING
RETRYING -> PROCESSING
PROCESSING -> COMPLETED
PROCESSING -> RETRYING
PROCESSING -> FAILED
QUEUED | RETRYING | PROCESSING -> CANCELLED
```

All other transitions fail. Updates constrain `organization_id`, `id`, expected status and `version`, then increment `version`. Claim increments `attempts`. A duplicate delivery that observes an already completed/cancelled job is acknowledged without repeating results.

Retryable errors store only stable error codes and pt-BR safe messages. BullMQ applies bounded exponential retry. The final failed attempt marks both job and document failed. Cancellation is implemented as an application service/state path but has no public endpoint in this delivery.

## Idempotency and recovery

- queue messages use a custom job ID and retained completion/failure history;
- the worker rejects a delivery whose queue job ID differs from its persistent job reference;
- job claims use optimistic compare-and-swap in PostgreSQL;
- a BullMQ stalled redelivery with the same queue job ID resumes an interrupted `PROCESSING` claim and increments its persisted attempt/version;
- extraction execution IDs are deterministic per persistent job and protected by an existing tenant/provider/execution unique index;
- entity rows are inserted in the same transaction as their extraction and job completion;
- the next persistent job has a deterministic UUID derived from the completed parent and next type;
- the reconciler republishes stale `QUEUED`/`RETRYING` rows that are missing from Redis;
- the reconciler never mutates completed results or infers success from Redis state.

## API surface

- `GET /api/v1/processing-jobs`
- `GET /api/v1/processing-jobs/:id`
- `GET /api/v1/documents/:id/extractions`
- `POST /api/v1/documents/:id/reprocess`

Reads use tenant-first keyset pagination and the same case-confidentiality policy as documents. Reprocessing creates a new root OCR job and therefore appends new extraction executions; it never overwrites prior results.

## Mock-provider contract

Mocks are deterministic, provider-independent and explicitly identify themselves in provenance. They produce a small fictional payload suitable only for local development and tests. Production startup rejects the mock processing pipeline until real provider adapters are configured.

Document content is always data, never an instruction channel. Mock providers do not invoke tools, execute document instructions or access other tenant resources.
