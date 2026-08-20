# Authentication and HTTP contract

**Status:** Implemented in Delivery 4; web permission projection added in Delivery 10
**Last updated:** 2026-08-13

## HTTP platform

All application routes use the `/api/v1` prefix. Swagger UI is served at `/api/v1/docs`, and the generated OpenAPI document is served at `/api/v1/docs/openapi.json`. OpenAPI contains only routes that exist in the running application.

Global request handling applies:

- Helmet response headers and one configured credentialed CORS origin;
- JSON/cookie parsing with request and correlation identifiers;
- DTO transformation, property allowlisting, rejection of unknown properties, and complete field validation;
- a stable safe error envelope;
- a bounded cursor-pagination query primitive with a default page size of 20 and maximum of 100.

Errors use this shape:

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Dados inválidos.",
  "details": [],
  "requestId": "request-identifier"
}
```

Validation details contain field names and safe constraints. Authentication failures intentionally use the same `INVALID_CREDENTIALS` response for an unknown user, invalid password, blocked user, deleted user, inactive organization, or a user presented under another organization.

## Implemented routes

| Method | Route                  | Authentication | Permission             | Behavior                                   |
| ------ | ---------------------- | -------------- | ---------------------- | ------------------------------------------ |
| POST   | `/api/v1/auth/login`   | Public         | none                   | Creates an access token and refresh family |
| POST   | `/api/v1/auth/refresh` | Refresh cookie | none                   | Atomically rotates the refresh session     |
| POST   | `/api/v1/auth/logout`  | Bearer JWT     | authenticated identity | Revokes the complete refresh-token family  |

`GET /api/v1/users/assignable` requires `users.read` and returns only active tenant users as
`{ id, name }`, using opaque keyset pagination. It never exposes e-mail, status, roles, permissions,
or password/session data. The read is audited with only the number of rows returned.
| GET | `/api/v1/organizations/current` | Bearer JWT | `organizations.read` | Returns the tenant derived from the session |

Health, metrics, and OpenAPI routes are public operational endpoints. The table above remains the Delivery 4 authentication surface. Later implemented resources are documented in [People, cases, and participants API](./people-cases-participants.md), [Files and documents API](./files-documents.md), [Processing API](./processing.md), [Timeline, checklists, and tasks API](./timeline-checklists-tasks.md), [Search API](./search.md), and [Authorized audit API](./audit.md).

The login body is:

```json
{
  "organizationSlug": "lex-os-demonstracao",
  "email": "admin@lexos.invalid",
  "password": "value-from-local-environment"
}
```

`organizationSlug` is the firm's human-readable identity, unique and immutable, matching `^[a-z0-9]+(-[a-z0-9]+)*# Authentication and HTTP contract

**Status:** Implemented in Delivery 4; web permission projection added in Delivery 10
**Last updated:** 2026-08-13

## HTTP platform

All application routes use the `/api/v1` prefix. Swagger UI is served at `/api/v1/docs`, and the generated OpenAPI document is served at `/api/v1/docs/openapi.json`. OpenAPI contains only routes that exist in the running application.

Global request handling applies:

- Helmet response headers and one configured credentialed CORS origin;
- JSON/cookie parsing with request and correlation identifiers;
- DTO transformation, property allowlisting, rejection of unknown properties, and complete field validation;
- a stable safe error envelope;
- a bounded cursor-pagination query primitive with a default page size of 20 and maximum of 100.

Errors use this shape:

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Dados inválidos.",
  "details": [],
  "requestId": "request-identifier"
}
```

Validation details contain field names and safe constraints. Authentication failures intentionally use the same `INVALID_CREDENTIALS` response for an unknown user, invalid password, blocked user, deleted user, inactive organization, or a user presented under another organization.

## Implemented routes

| Method | Route                  | Authentication | Permission             | Behavior                                   |
| ------ | ---------------------- | -------------- | ---------------------- | ------------------------------------------ |
| POST   | `/api/v1/auth/login`   | Public         | none                   | Creates an access token and refresh family |
| POST   | `/api/v1/auth/refresh` | Refresh cookie | none                   | Atomically rotates the refresh session     |
| POST   | `/api/v1/auth/logout`  | Bearer JWT     | authenticated identity | Revokes the complete refresh-token family  |

`GET /api/v1/users/assignable` requires `users.read` and returns only active tenant users as
`{ id, name }`, using opaque keyset pagination. It never exposes e-mail, status, roles, permissions,
or password/session data. The read is audited with only the number of rows returned.
| GET | `/api/v1/organizations/current` | Bearer JWT | `organizations.read` | Returns the tenant derived from the session |

Health, metrics, and OpenAPI routes are public operational endpoints. The table above remains the Delivery 4 authentication surface. Later implemented resources are documented in [People, cases, and participants API](./people-cases-participants.md), [Files and documents API](./files-documents.md), [Processing API](./processing.md), [Timeline, checklists, and tasks API](./timeline-checklists-tasks.md), [Search API](./search.md), and [Authorized audit API](./audit.md).

The login body is:

at both the DTO and the database constraint. It replaced the organization UUID in Delivery 12: the UUID is unusable by a person and leaked an internal identifier into the first screen of the product. The value is lowercased before lookup, so the caller does not have to match case.

An unknown slug and a wrong password are deliberately indistinguishable. The lookup joins organization and user in a single query, and a miss still verifies a dummy password hash, so neither the response nor the response time reveals whether the firm exists. Failed-attempt counting is keyed by the submitted slug rather than by a resolved identifier — keying by the resolved identifier would leave attempts against a non-existent firm unthrottled.

Public self-service organization discovery and signup remain deferred. The fictional seed password comes from `SEED_ADMIN_PASSWORD`; it must not be copied into source, documentation, logs, or committed fixtures.

## Session lifecycle

Successful login verifies the Argon2id hash, records `last_login_at`, creates a refresh family, appends a safe audit event, and returns a short-lived HS256 access JWT. The JWT contains only user, organization, session, and token-type identifiers and is restricted by issuer, audience, algorithm, and expiry.

Login and refresh responses also contain a sorted, deduplicated `permissions` array computed from
the same visible global and tenant-owned role assignments used by the access guard. The web client
uses this projection only to hide unavailable navigation and actions; every request is still
authorized again from current database state. Role names and role assignments are not exposed.

The refresh secret is a random 32-byte opaque value. It is sent only in the `lex_os_refresh` cookie with `HttpOnly`, `SameSite=Strict`, and path `/api/v1/auth`; production also requires the `Secure` attribute. PostgreSQL stores only its SHA-256 hash.

Each refresh rotates atomically inside a short database transaction. Reuse of a rotated or revoked token is treated as replay and revokes the entire family. Logout also revokes the family. Protected requests load authoritative session, user, and organization state from PostgreSQL, so logout, replay, blocking, soft deletion, expiry, or organization deactivation denies subsequent access.

## Tenant and authorization rules

After login, `organizationId` is derived only from the verified access token and its matching database session. Organization values in headers, query parameters, route parameters, or JSON bodies cannot replace the authenticated tenant.

The access-token guard builds an actor context containing `userId`, `organizationId`, `sessionId`, and a deduplicated permission-code set. Global roles and roles owned by that same organization may contribute permissions. Policy guards require permission codes such as `organizations.read`; they never branch on role names such as `ADMIN` or `LAWYER`.

Product services must still pass the actor's explicit organization ID to tenant-aware repositories and use tenant-consistent relations. Request context is propagation convenience, not the sole data-isolation control.

## Brute-force, audit, and log safety

Login has a process-level request throttle and a Redis-backed brute-force counter keyed by hashes of organization, normalized e-mail, and client address. Raw e-mail and passwords are not used as Redis keys. When Redis is unavailable, the brute-force check fails closed with a safe dependency error.

Authentication audits are append-only and contain allowlisted action, outcome, reason, actor/session identifiers, and request/correlation IDs. Passwords, authorization headers, access tokens, refresh tokens, cookies, and raw credential inputs are prohibited. Automated tests inspect stored audits and structured log output for issued and rejected secrets.

Before an internet-facing deployment, configure trusted reverse-proxy/client-IP handling and use a shared throttler storage if generic limits must span multiple API instances. The authentication-specific brute-force counter is already Redis-backed.
