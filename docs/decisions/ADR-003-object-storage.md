# ADR-003: Store original files in private S3-compatible object storage

- **Status:** Accepted
- **Date:** 2026-08-05
- **Deciders:** SAMUEL DEV LTDA / LEX OS architecture

## Context

LEX OS receives potentially large, sensitive, malicious, and legally important files. PostgreSQL is not appropriate for primary binary storage. Development needs local parity, while production must support managed durable storage without binding the domain to one vendor.

## Decision

Use an internal object-storage port with:

- MinIO for local development;
- a private S3-compatible service in production;
- generated, non-predictable storage keys without customer or file PII;
- streamed upload/download paths;
- quarantine until validation and required malware scanning complete;
- immutable original objects;
- separate keys for derived artifacts;
- short-lived download URLs issued only after tenant, permission, confidentiality, and file-state checks;
- SHA-256 and metadata persisted in PostgreSQL, never the primary binary.

Database/object-store reconciliation is mandatory because the two systems cannot commit atomically.

## Consequences

### Positive

- efficient handling of large binaries;
- private access policies and lifecycle features;
- local development parity through MinIO;
- provider portability through one small adapter;
- original evidence remains distinct from derived content.

### Negative

- upload/database operations are a distributed consistency boundary;
- signed URLs can leak if logged or given excessive lifetime;
- lifecycle, backups, object lock, region, retention, and legal hold need explicit production policy;
- S3-compatible providers may differ on edge semantics.

## Rejected alternatives

- **PostgreSQL bytea/large objects:** increases database size, backup cost, and serving complexity.
- **Local filesystem:** unsuitable for horizontally scaled or durable production workloads.
- **Public bucket with obscure URLs:** fails confidentiality and authorization requirements.
- **Direct vendor SDK calls in domain modules:** creates lock-in and makes security policy inconsistent.

## Compliance checks

- Bucket/object policy tests prove anonymous access is denied.
- Download URL tests cover tenant, permission, confidentiality, deletion, quarantine, and expiry.
- Upload tests verify streaming, actual MIME inspection, path-safe keys, size limits, and redacted logs.
- Reconciliation reports orphaned database rows and objects without deleting automatically in the first iteration.
