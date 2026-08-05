# ADR-007: Use persistent processing jobs with BullMQ workers

- **Status:** Accepted
- **Date:** 2026-08-05
- **Deciders:** SAMUEL DEV LTDA / LEX OS architecture

## Context

File validation, malware scanning, OCR, transcription, classification, extraction, embedding, timeline, and checklist work can be slow, expensive, rate-limited, and retryable. Performing it within HTTP requests causes timeouts, duplicated work, poor progress visibility, and unreliable recovery.

Redis queue state alone is not sufficient as long-term product history or audit evidence.

## Decision

Use BullMQ on Redis for delivery/retry mechanics and a separate `apps/worker` process for execution. Persist a `processing_jobs` record in PostgreSQL as the product-visible source of truth.

- HTTP intake creates resource records and a queued job, then enqueues a small versioned message containing the job ID, tenant ID, and correlation ID.
- The worker reloads authoritative data, validates tenant consistency, and uses a centralized state-transition service.
- Delivery is treated as at least once; processors and result persistence are idempotent.
- Safe errors, attempt count, provider/model, timings, and progress metadata are persisted.
- Stale queued jobs are reconciled/re-enqueued when database commit succeeds but queue publication fails.
- Audits use `SYSTEM` or `AI` according to who produced the effect.

An outbox may replace/enhance reconciliation if measured failure modes require it.

## Consequences

### Positive

- bounded HTTP latency and visible progress;
- independent API/worker process scaling;
- controlled retries and provider rate management;
- PostgreSQL preserves processing history if Redis data expires;
- deterministic mock processors support end-to-end tests.

### Negative

- database/queue publication is a dual write;
- at-least-once delivery requires careful idempotency;
- stuck-job detection, retry policy, and dead-letter operations need ownership;
- Redis and worker health become runtime dependencies.

## Rejected alternatives

- **Synchronous processing in controllers:** violates explicit latency/reliability requirements.
- **BullMQ state only:** insufficient for durable UI, audit, and tenant queries.
- **Exactly-once assumption:** not guaranteed by the queue and unsafe under crashes.
- **Kafka/event platform for the MVP:** disproportionate operational complexity for command-like document jobs.

## Compliance checks

- Integration tests cover every allowed/forbidden state transition.
- Duplicate message delivery does not duplicate one logical result.
- Worker restart and enqueue-gap reconciliation are tested.
- Queue payloads contain references, not document content or secrets.
- API tests prove heavy providers are never called in the request path.
