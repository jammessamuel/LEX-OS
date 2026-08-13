# Authorized audit API

**Status:** Backend contract implemented during authorized Delivery 10

**Last updated:** 2026-08-13

## Contract

`GET /api/v1/audit-logs` keyset-paginates the current organization's append-only audit metadata.
It requires both `audit.read` and `confidential_cases.read`: audit events may identify activity on a
confidential case, so audit permission alone is deliberately insufficient to traverse that boundary.

The route accepts opaque `cursor`, bounded `limit`, and optional exact filters for `action`,
`entityType`, `actorType`, `userId`, `entityId`, `from`, and `to`. Ordering is descending by
`(createdAt, id)`. Tenant scope and filters are applied in PostgreSQL before pagination.

## Safe response

Each row exposes only:

- audit identifier and creation time;
- actor type, safe actor identifier, and same-tenant `{ id, name }` user summary when available;
- action, entity type, and optional entity identifier;
- request, correlation, and processing-job identifiers.

The route never returns `old_data` or `new_data`. Those database snapshots are allowlisted at the
write boundary, but omitting them from the general reader also protects against an unsafe legacy row
or alternate writer. The read itself creates `audit.log.listed` with only result count and applied
filter dimensions; no returned payload or legal content is copied into the new event.
