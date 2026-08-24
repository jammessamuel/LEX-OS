# Timeline, checklist, and tasks API

**Status:** Implemented in Delivery 8; task lifecycle extended in Delivery 10; firm agenda added in Delivery 15
**Last updated:** 2026-08-24

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
| GET    | `/api/v1/agenda`                        | `tasks.read`   | Firm-wide deadlines in a window, plus what is already overdue  |

## The agenda

`GET /api/v1/agenda` answers the question a partner opens the system with at eight in the
morning: what is due, and what is already late. It is the one task route that is not nested
under a case, because a deadline agenda that requires picking a case first is not an agenda.

`from` and `to` are ISO instants and both optional; absent, the window is now through
fourteen days. The **browser** decides the boundaries, because it knows the reader's time
zone and the server — which stores everything in UTC — does not. A `to` before `from`
returns `400 INVALID_AGENDA_RANGE`.

The response has two buckets rather than one list. `overdue` holds deadlines that fell before
the window and are still open; `upcoming` holds those inside it. They are separate on purpose:
merged into a single date-ordered list, a missed deadline sinks below everything still to come
and disappears at the first scroll — and it is exactly the one that needs the first look.

Only `OPEN` and `IN_PROGRESS` appear. A completed or cancelled task is history, not a
deadline. Each entry carries its case — id, internal code, CNJ number, title — and its
assignee's id and name, so the screen does not force opening a case to learn what a deadline
is about. The case's confidentiality level is used to filter and is never returned.

`scope=mine` narrows to the authenticated user; `assignedToId` narrows to someone else.

**Confidentiality and isolation.** A task whose case is confidential is absent for an actor
without `confidential_cases.read` — absent from the list _and_ from `total`, since a counter
that still counts reveals that the case exists. Tasks on soft-deleted cases never appear.
Firm-level tasks with no case have no confidentiality to respect and always appear. When an
authorized actor does see confidential deadlines, the read is audited as `access: AGENDA`
with a count and no case text.

**No silent cap.** Each bucket returns at most 200 entries alongside the real `total` and a
`truncated` flag. A cap that does not say it capped reads as "this is everything".

## Timeline provenance

The deterministic provider output is validated as schema v1 before persistence. Every generated event contains a page/start/end locator that must fit the authorized text extraction. The stored event references the same-case source document and the immutable timeline-analysis extraction. PostgreSQL rejects AI events without these fields.

AI events start with `confirmedByUser=false`. Confirmation uses a guarded update and stores `confirmedById` and `confirmedAt` in the same transaction as the allowlisted USER audit. A second confirmation returns `409 TIMELINE_EVENT_ALREADY_CONFIRMED`.

## Checklist snapshots and tasks

The seed contains a global version-1 template for the fictional labor case. Application copies each item's title, description, and required flag into `case_checklist_items`; deactivating the template therefore does not erase the historical checklist. Both application checks and composite foreign keys require a linked document to belong to the checklist's tenant and case.

AI analysis only promotes a matching missing item to `AWAITING_VALIDATION`; it does not overwrite human-reviewed statuses. When the worker finds no active template for the case type, it does not apply a snapshot and does not fail the document. Human review records validator/time for `VALIDATED`, `NOT_APPLICABLE`, `INVALID`, `EXPIRED`, and `ILLEGIBLE`. The checklist becomes `COMPLETED` only when every required item is `VALIDATED` or `NOT_APPLICABLE`.

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
