# Dashboard summary API

**Status:** Backend contract implemented during authorized Delivery 10

**Last updated:** 2026-08-13

`GET /api/v1/dashboard/summary` requires `cases.read`, `documents.read`, and `tasks.read`. It returns
one snapshot with active case, document-review, task, and processing counts plus the server timestamp.
The client does not need to traverse paginated resources to assemble these numbers.

All aggregates execute in one PostgreSQL statement. The accessible-case CTE applies organization,
soft-delete, and confidentiality policy before any dependent document, task, or processing-job count.
An actor without `confidential_cases.read` receives no count or other signal derived from a
confidential case. A supervisor whose summary includes confidential cases generates a minimal
`case.confidential.read` audit with access type `DASHBOARD` and count only.

The response groups:

- cases: total, open, high priority, and processing-limit reached;
- documents: total, processing, awaiting review, and failed;
- tasks: open and overdue;
- processing: active and failed jobs.

Dates remain UTC. The overdue count compares persisted `due_at` with the database clock and does not
invent a tenant-local calendar day.
