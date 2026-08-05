# LEX OS MVP scope

**Status:** Baseline proposal  
**Last updated:** 2026-08-05

## MVP objective

Prove one secure, end-to-end workflow: an authorized user of a fictional organization creates a case, uploads a document, observes asynchronous processing, reviews sourced mock results, confirms a timeline event, and finds the resulting audit trail.

The MVP must establish production-oriented boundaries while using deterministic mocks where real AI, OCR, transcription, and virus-scanning integrations are not yet required.

## In scope

### Organization, identity, and access

- one `Organization` as the tenant boundary;
- local bootstrap/seed of a fictional organization and administrator;
- e-mail/password login with Argon2id;
- short-lived access tokens and hashed, revocable refresh sessions;
- blocked-user and last-login state;
- extensible roles and granular permissions;
- current-organization endpoint;
- tenant context derived from authentication;
- rate limiting and brute-force protection;
- tenant-isolation tests.

Self-service organization signup and billing are not required. Until onboarding is specified, organizations are provisioned administratively in local/development flows.

### People and cases

- create, list, view, and update people;
- normalize CPF/CNPJ values while masking them in logs and responses where appropriate;
- create, list, view, and update internal legal cases;
- associate people to cases with legal role, side, and client indicator;
- assign responsible users and confidentiality levels;
- prevent access to confidential cases without permission.

### Files and documents

- stream uploads to private MinIO/S3-compatible storage;
- configurable type and size limits;
- non-predictable object keys and sanitized display filenames;
- server-side SHA-256 calculation;
- actual MIME inspection;
- corruption/validation state;
- duplicate detection within the current organization;
- separate physical `File` and semantic `Document` records;
- short-lived, authorized download URLs;
- immutable original objects and append-only document extraction history.

ZIP intake is part of the target preparation experience, but safe extraction limits and archive-bomb defenses must be implemented before ZIP files are enabled.

### Processing pipeline

- persistent `ProcessingJob` lifecycle;
- BullMQ queue contracts and a worker process;
- file validation, duplicate detection, text extraction, classification, entity extraction, embedding, timeline, and checklist stages;
- prepared virus-scan and transcription stages;
- deterministic mock providers for the first vertical flow;
- retry, terminal failure, cancellation-ready status, correlation IDs, and safe error metadata;
- visible progress that can recover after a browser refresh.

### Reviewable intelligence

- append-only extraction records with provider/model/prompt metadata;
- extracted entities with source locations when available;
- preliminary, unconfirmed timeline events tied to sources;
- human confirmation with actor and timestamp;
- versioned checklist templates and case checklist state;
- tasks created manually or from a traceable automated source;
- every AI-created record distinguishable from human-created data.

### Search and memory foundation

- tenant-scoped PostgreSQL full-text search over authorized extracted content;
- chunk creation with source, page/segment metadata, content hash, model, and version;
- pgvector extension and provider-agnostic embedding storage foundation;
- tenant- and authorization-filtered semantic search;
- results that expose source references;
- explicit insufficient-evidence behavior rather than an unsupported answer.

### Audit and operations

- append-only audit records for the actions listed in the product specification;
- field allowlisting/redaction before audit persistence;
- structured logs with request and correlation identifiers;
- API, dependency, and worker health checks;
- basic metrics interface and OpenTelemetry-ready boundaries;
- OpenAPI for implemented routes;
- local Docker Compose environment and CI quality gates.

### Essential web experience

- login and authenticated layout;
- dashboard;
- case list, creation, and details;
- case tabs in Portuguese;
- participants and document upload;
- processing progress and errors;
- documents, chronology, checklist, tasks, search, and authorized audit views;
- explicit disabled/placeholders for MVP tabs not yet implemented;
- responsive, keyboard-accessible UI with understandable loading, empty, and error states.

## Explicitly out of scope

- automatic petition filing or complete petition generation;
- automatic court movement capture or broad tribunal integrations;
- advanced jurimetrics;
- billing, charging, subscription management, or commercial CRM;
- WhatsApp service or live messaging integrations;
- native mobile applications;
- public precedent ingestion in the first sprint;
- every ERP connector;
- autonomous legal decisions or unsupervised confirmation;
- production migration to microservices, Kubernetes, or a separate search cluster;
- claims of comprehensive LGPD compliance before governance policies exist.

These items belong in a separately prioritized backlog. Their data placeholders do not authorize their implementation.

## MVP roles and permissions

Initial role bundles are `ADMIN`, `PARTNER`, `LAWYER`, `ASSISTANT`, `INTERN`, and `READ_ONLY`. Authorization evaluates permissions, not role names.

The initial permission catalog includes:

- `organizations.read`, `organizations.manage`;
- `users.read`, `users.manage`;
- `roles.read`, `roles.manage`;
- `persons.read`, `persons.manage`;
- `cases.read`, `cases.manage`, `cases.create`, `cases.update`, `cases.delete`;
- `documents.read`, `documents.manage`, `documents.upload`, `documents.update`, `documents.delete`, `documents.export`;
- `tasks.read`, `tasks.manage`;
- `knowledge.search`;
- `audit.read`;
- `confidential_cases.read`.

Permission bundles will be seeded, but organization-specific roles may later compose the same catalog differently.

## Required API surface

Routes live under `/api/v1` and are exposed only when their delivery is implemented. Delivery 7 exposes authentication, current organization, people, cases, participant association/listing, secure file intake/list/download authorization, document list/detail/correction/soft delete, processing progress/detail, extraction history, and reprocessing. Users, timeline, checklist, tasks, search, and general audit endpoints remain scheduled for later deliveries.

Every list route must define pagination, sorting allowlists, filters, and stable ordering. Every error uses:

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Dados inválidos.",
  "details": [],
  "requestId": "..."
}
```

Error messages must not disclose whether an unauthorized resource exists in another organization.

## Fictional seed

Local-only seed data contains:

- organization `Lex OS Demonstração` with reserved fixture identifiers and invalid all-zero document data;
- user `admin@lexos.invalid`, whose local-only password is supplied through `SEED_ADMIN_PASSWORD` and is never embedded in documentation;
- six global role bundles, 24 granular permissions, and 21 global document types;
- fictional case `DEMO-0001`, explicitly described as containing no real people, documents, or facts.

The password must never be used outside local development and must not be emitted in application logs.

## End-to-end acceptance

The first executable MVP is accepted when:

1. One documented command starts the local environment.
2. Migrations and the idempotent fictional seed succeed.
3. The seeded administrator can log in.
4. Automated tests prove direct and indirect tenant isolation.
5. An authorized user can create a case and stream an accepted file to MinIO.
6. SHA-256 and metadata are persisted and a same-tenant duplicate is identified.
7. A persistent job is created and consumed by the worker.
8. Deterministic mock extraction, classification, timeline, and checklist output is persisted with provenance.
9. A user can confirm an AI-proposed event without destroying its original provenance.
10. Search returns only authorized same-tenant sources.
11. Audit records exist for the complete flow and contain no prohibited sensitive values.
12. The web application displays the case, processing state, results, and actionable failures.
13. Formatting, lint, typecheck, unit, integration, essential Playwright, migration validation, and build checks pass in CI.

## Open product decisions

These questions do not block the documentation/foundation bootstrap, but they must be resolved before their affected deliveries:

| Decision                    | Conservative MVP default                               | Required before                     |
| --------------------------- | ------------------------------------------------------ | ----------------------------------- |
| Organization onboarding     | Administrative provisioning only                       | Public authentication release       |
| Data region and residency   | Single documented region; no cross-region copies       | Production storage selection        |
| Retention and legal hold    | Preserve; no automatic purge                           | Production data onboarding          |
| Maximum file/archive limits | Deny by configurable allowlist; safe low defaults      | File upload release                 |
| Malware scanner outage      | Keep file quarantined and retry                        | File download release               |
| Refresh sessions            | Per-device hashed token family with rotation           | Authentication release              |
| Embedding model/dimension   | Mock configuration; store model and dimension metadata | Semantic indexing release           |
| Confidentiality inheritance | Case policy applies to derived artifacts by default    | Case/document authorization release |
