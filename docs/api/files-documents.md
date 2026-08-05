# Files and documents API

**Status:** Implemented in Delivery 6  
**Last updated:** 2026-08-05

## Contract summary

All routes require a valid bearer access token. Tenant identity comes only from the verified session. A nested case must be active, belong to that tenant, and be visible under its confidentiality policy before file bytes are accepted or any resource is returned.

Files are physical-object metadata; documents are the semantic records used for classification and later extraction. PostgreSQL never stores the binary. Lists use bounded opaque keyset cursors and exclude soft-deleted resources.

## Routes and permissions

| Method | Route                                | Permission         | Behavior                                         |
| ------ | ------------------------------------ | ------------------ | ------------------------------------------------ |
| POST   | `/api/v1/cases/:caseId/files/upload` | `documents.upload` | Streams one multipart batch into private storage |
| GET    | `/api/v1/cases/:caseId/files`        | `documents.read`   | Lists active files for an authorized case        |
| GET    | `/api/v1/files/:id/download-url`     | `documents.read`   | Returns a 60-second authorized signed URL        |
| GET    | `/api/v1/cases/:caseId/documents`    | `documents.read`   | Lists active documents for a case                |
| GET    | `/api/v1/documents/:id`              | `documents.read`   | Reads one active authorized document             |
| PATCH  | `/api/v1/documents/:id`              | `documents.update` | Corrects human-managed document metadata         |
| DELETE | `/api/v1/documents/:id`              | `documents.delete` | Soft-deletes document/file metadata              |

Foreign-tenant, inaccessible confidential, soft-deleted, and unknown direct resources return the same opaque `404 NOT_FOUND`. A file linked to multiple active documents must be accessible through every linked case before a download URL is issued.

## Secure intake

The upload field is `files` (the singular legacy alias `file` is also accepted). The default limits are 10 files per request and 25 MiB per file. Configuration may lower or raise those bounded values. ZIP is disabled.

The allowlist is:

- PDF (`application/pdf`, `.pdf`);
- JPEG (`image/jpeg`, `.jpg` or `.jpeg`);
- PNG (`image/png`, `.png`);
- valid UTF-8 text (`text/plain`, `.txt`).

Each file is processed incrementally. The API validates and sanitizes its display name, rejects path-like names, generates an unpredictable `quarantine/<uuid>/<uuid>` key, streams the object privately with one S3 part in flight, computes SHA-256, checks detected content against client MIME and extension, verifies basic structural terminators, and runs the scanner session over the same stream. Original names, tenant/case identifiers, and legal content never enter object keys.

An invalid, infected, oversized, unsupported, malformed, or excessive-count intake is rejected with a stable pt-BR error and best-effort object cleanup. A scanner infrastructure failure is fail-closed: the object remains private and `QUARANTINED`, the scan status is `ERROR`, a `VIRUS_SCAN` job is persisted, and download returns `409 FILE_NOT_AVAILABLE`.

A clean file becomes `AVAILABLE/CLEAN`. One short PostgreSQL transaction creates the file, document, queued `FILE_VALIDATION` job, and allowlisted audits after storage inspection succeeds. Delivery 7 publishes the strict job identifier envelope after commit; a stale-job reconciler repairs publication gaps.

## Duplicate and storage rules

Duplicate lookup uses `(organization_id, checksum_sha256, size_bytes)` only among active clean/available files. A transaction-scoped advisory lock serializes concurrent decisions for the same tenant/hash. A repeated upload creates a distinct file/document/job and sets `duplicateOfFileId`; no lookup, identifier, or behavior discloses another tenant's matching bytes.

The current delivery retains the second private object. Automatic byte removal needs an approved retention/legal-hold policy and is not inferred from duplicate status.

The object adapter uses an internal S3-compatible endpoint for writes and a separate public endpoint only when signing downloads. Buckets remain anonymous-access denied. Signed URLs are generated only after tenant, permission, confidentiality, lifecycle, scan, soft-delete, and object-existence checks. URLs, signatures, keys, checksums, filenames, and content are excluded from audit/log payloads.

## Documents

Document lists accept `limit`, `cursor`, optional `documentTypeId`, and optional `processingStatus`. The stable status filter is `PENDING`, `QUEUED`, `PROCESSING`, `COMPLETED`, `NEEDS_REVIEW`, or `FAILED`.

`PATCH /documents/:id` accepts at least one of `title`, `description`, `documentDate`, `issuer`, `recipient`, `documentTypeId`, `isOriginal`, `isSigned`, or `isLegible`. A document type must be global or owned by the authenticated tenant. Selecting a type records human classification identity/time; clearing it returns classification to `PENDING`.

Soft deletion hides the document. If it was the last active document for that file, file metadata is soft-deleted in the same transaction. The private object is preserved as evidence; production purge and legal-hold rules are not part of this endpoint.

## Reconciliation and audit

The internal reconciliation service compares active database references with private objects and reports:

- database file IDs whose objects are missing;
- quarantined file IDs older than the configured stale threshold;
- count of objects with no active database reference.

It never deletes automatically. Intake, duplicate detection, rejection, quarantine, URL issuance, document correction, and deletion use action-specific audit allowlists. Tests assert that filenames, hashes, keys, legal content, and signed-URL material are absent.

## Production boundary

The included scanner and processing providers are deterministic and exist only for development/integration tests. Startup fails if they are selected with `NODE_ENV=production`. Real malware/OCR/AI adapters, retention/legal hold, durable object-store backup, and operational reconciliation monitoring are required before production use.
