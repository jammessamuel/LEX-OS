# ADR-004: Use shared-schema application-enforced multi-tenancy

- **Status:** Accepted
- **Date:** 2026-08-05
- **Deciders:** SAMUEL DEV LTDA / LEX OS architecture

## Context

`Organization` is the SaaS tenant. LEX OS processes confidential legal, personal, financial, and medical data, so a cross-organization disclosure is a critical failure. The MVP should not incur database-per-tenant operational cost, but application-only filtering without structural guardrails is too fragile.

## Decision

Use one PostgreSQL database and shared schema for the MVP.

- Every tenant-owned table carries `organization_id`.
- Tenant identity is derived from the authenticated user/session, never trusted from client payloads.
- Application and repository methods receive tenant context explicitly and constrain every read/write/search/aggregate.
- Authorization additionally evaluates granular permission and resource confidentiality.
- Composite `(organization_id, id)` candidate keys and foreign keys enforce same-tenant relationships where possible.
- Global-or-tenant definitions use explicit visibility policies and negative tests.
- Cross-tenant “not found” behavior avoids resource enumeration.
- PostgreSQL RLS is a possible later defense-in-depth layer, not the MVP's only or initial enforcement.

## Consequences

### Positive

- efficient SaaS operations and migrations;
- strong database protection against many cross-tenant relations;
- straightforward transactions and shared reference catalogs;
- a clear path to RLS or higher-isolation tiers later.

### Negative

- every query path remains security-sensitive;
- nullable global ownership cannot be protected entirely with ordinary composite foreign keys;
- shared resource contention and backup/restore are not tenant-isolated;
- tenant-specific data export/deletion requires careful tooling.

## Rejected alternatives

- **Database per tenant:** strongest physical separation but excessive provisioning, migration, pooling, and analytics overhead for the MVP.
- **Schema per tenant:** still creates migration/connection complexity and weak ecosystem support.
- **Trusting an `organization_id` request field:** directly enables tenant spoofing.
- **RLS only from day one:** valuable later, but session context/pooling mistakes can create false confidence and it does not replace authorization.

## Compliance checks

Each tenant-owned feature tests:

- list exclusion;
- direct ID access;
- relation/link attempts;
- mutation and deletion;
- counts/search/export/download;
- confidentiality denial;
- audit/log non-disclosure.

Code review rejects unscoped `findUnique`, raw SQL, vector search, or object-key access for tenant resources.
