# Timeline, checklist, and tasks API

**Status:** Implemented in Delivery 8; task lifecycle extended in Delivery 10
**Last updated:** 2026-08-13

## Security and authorization

All routes derive `organizationId` from the authenticated session and first authorize the owning case. `cases.read` protects timeline/checklist reads, `cases.update` protects event confirmation and checklist mutations, `tasks.read` protects task lists, and `tasks.manage` protects task creation. Confidential-case policy is inherited from the case. Foreign-tenant or inaccessible resource IDs return opaque `404 NOT_FOUND` responses.

User-facing timeline text, checklist snapshots, and reviewer notes are deliberately absent from audit snapshots. Audits retain only identifiers, statuses, source types, counts, permissions-relevant state, and correlation metadata.

## Routes

| Method | Route                                   | Permission     | Behavior                                                       |
| ------ | --------------------------------------- | -------------- | -------------------------------------------------------------- |
| GET    | `/api/v1/cases/:id/timeline-events`     | `cases.read`   | Keyset-paginates sourced events                                |
| POST   | `/api/v1/timeline-events/:id/confirm`   | `cases.update` | Records one human confirmation without changing the extraction |
| GET    | `/api/v1/cases/:id/checklist-templates` | `cases.read`   | Lists active global/tenant templates compatible with the case  |
| GET    | `/api/v1/cases/:id/checklists`          | `cases.read`   | Lists applied template-version snapshots and current items     |
| POST   | `/api/v1/cases/:id/checklists`          | `cases.update` | Applies a visible active template idempotently                 |
| PATCH  | `/api/v1/checklist-items/:id`           | `cases.update` | Reviews status, same-case document, notes, and validation      |
| POST   | `/api/v1/checklist-items/:id/tasks`     | `tasks.manage` | Creates one task from a selected pending item                  |
| GET    | `/api/v1/cases/:id/tasks`               | `tasks.read`   | Keyset-paginates non-deleted case tasks                        |
| PATCH  | `/api/v1/tasks/:id`                     | `tasks.manage` | Changes status, priority, due date, or assignee                |

## Timeline provenance

The deterministic provider output is validated as schema v1 before persistence. Every generated event contains a page/start/end locator that must fit the authorized text extraction. The stored event references the same-case source document and the immutable timeline-analysis extraction. PostgreSQL rejects AI events without these fields.

AI events start with `confirmedByUser=false`. Confirmation uses a guarded update and stores `confirmedById` and `confirmedAt` in the same transaction as the allowlisted USER audit. A second confirmation returns `409 TIMELINE_EVENT_ALREADY_CONFIRMED`.

## Checklist snapshots and tasks

The seed contains a global version-1 template for the fictional labor case. Application copies each item's title, description, and required flag into `case_checklist_items`; deactivating the template therefore does not erase the historical checklist. Both application checks and composite foreign keys require a linked document to belong to the checklist's tenant and case.

AI analysis only promotes a matching missing item to `AWAITING_VALIDATION`; it does not overwrite human-reviewed statuses. Human review records validator/time for `VALIDATED`, `NOT_APPLICABLE`, `INVALID`, `EXPIRED`, and `ILLEGIBLE`. The checklist becomes `COMPLETED` only when every required item is `VALIDATED` or `NOT_APPLICABLE`.

A task can be created only from a pending `MISSING`, `INVALID`, `EXPIRED`, or `ILLEGIBLE` item. Its source is `AI_CHECKLIST` with the item ID, while the title is derived from the immutable snapshot. A partial unique index rejects a second non-deleted task for the same tenant/source.

## Task lifecycle extension

Delivery 10 adds `PATCH /tasks/:id` for status, priority, due date, and assignee changes. Completion
time is set by the server; reopening clears it. The write compares the previously read `updatedAt`
inside the tenant-scoped update, so concurrent changes fail with `409 TASK_UPDATE_CONFLICT` instead
of silently overwriting one another. Task audits contain only lifecycle fields and identifiers, never
the task title or description.

Delivery 8 did not add search/embeddings; Delivery 9 implements that separate foundation. Real
AI/OCR/embedding/language-model providers, full user administration, general audit browsing, and
the complete feature UI remain assigned to later authorized work.
