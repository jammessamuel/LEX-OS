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

## Invitations

| Method | Path                              | Auth       | Permission     | Purpose                                     |
| ------ | --------------------------------- | ---------- | -------------- | ------------------------------------------- |
| POST   | `/api/v1/users/invitations`       | Bearer JWT | `users.manage` | Invites a person and returns the token once |
| GET    | `/api/v1/users/invitations`       | Bearer JWT | `users.manage` | Lists invitations still open                |
| DELETE | `/api/v1/users/invitations/:id`   | Bearer JWT | `users.manage` | Revokes an invitation not yet accepted      |
| POST   | `/api/v1/auth/invitations/accept` | Public     | —              | Sets the password and activates the access  |

Inviting creates the user with status `INVITED` and a password hash of an unreachable value, so
an attempt to sign in before accepting fails in the normal verification path rather than in a
special case. The invitation stores only a SHA-256 hash of a 256-bit opaque token; the clear-text
token is returned **once**, in the creation response, and never again — not in a later read, not
in a log, not in the audit trail. Until the ADR-013 e-mail adapter exists, the administrator
delivers it out of band; see [ADR-014](../decisions/ADR-014-fronteira-de-identidade-e-acesso.md),
item 2.

Roles supplied at invitation must be global or owned by the acting tenant **and already held by
the inviter**. Without that second condition, inviting would be an privilege-escalation path: any
account with `users.manage` could mint an administrator. The check is a database query, not a
list held in memory.

Accepting is public because the person has no session yet and the token is the only proof
presented. Every refusal returns the same `INVITATION_INVALID` — unknown, expired, already used,
and revoked are indistinguishable. Single use is enforced by the database: the acceptance updates
the row with the expected state in the `WHERE` clause, so two concurrent requests carrying the
same token contend on that clause and only one changes a row. The password minimum is 12
characters here rather than the 8 accepted at sign-in, because this is the only moment a password
is created and raising the floor cannot lock out anyone who already has access.

An invitation from another tenant returns 404 on revocation, the same as one that does not exist:
the response never confirms that an identifier is real somewhere else.

## User administration

| Method | Path                       | Auth       | Permission     | Purpose                                      |
| ------ | -------------------------- | ---------- | -------------- | -------------------------------------------- |
| GET    | `/api/v1/users`            | Bearer JWT | `users.read`   | Lists tenant people with status and roles    |
| GET    | `/api/v1/roles`            | Bearer JWT | `users.manage` | Lists assignable roles with what each allows |
| PATCH  | `/api/v1/users/:id/roles`  | Bearer JWT | `users.manage` | Replaces the whole role set                  |
| PATCH  | `/api/v1/users/:id/status` | Bearer JWT | `users.manage` | Blocks or reactivates access                 |

Role assignment shares one rule with invitation: a role is grantable only when every permission
it carries is already held by the person assigning it. Requiring the same _role_ would stop an
administrator from creating an intern, which is the ordinary case; requiring the same
_permissions_ is what actually prevents `users.manage` from becoming a path to everything.

`GET /roles` requires `users.manage` rather than `roles.read`: the catalogue exists for whoever assigns a role to a person, and `roles.read` stays reserved for administering the roles themselves. Each role carries its permissions as the human-readable pt-BR descriptions already in the seed catalogue, plus `grantable`. A role the caller cannot grant is **returned anyway**, marked false — the interface can then explain the absence instead of hiding the option, which is what turns into a support call.

The role set is replaced, not merged. Deleting and recreating inside the transaction avoids the
set-difference arithmetic where an extra role survives by accident.

Blocking revokes every open refresh session in the same transaction, with reason `USER_BLOCKED`.
The access token is not invalidated by construction, but it stops working on the next request
anyway: the access-token guard re-reads status, roles, and permissions from the database on every
call rather than trusting the token. Reactivation applies only to someone `BLOCKED` — a person
still `INVITED` has no usable password and must go through acceptance.

Nobody changes their own roles or their own status. Without that rule the last administrator can
lock the firm out of its own account; see
[ADR-014](../decisions/ADR-014-fronteira-de-identidade-e-acesso.md), item 8, for the case that
remains open — the sole administrator blocked by another route.

A person from another tenant returns 404 on every one of these routes, identical to a person who
does not exist.

## Password recovery

| Method | Path                                   | Auth   | Purpose                                       |
| ------ | -------------------------------------- | ------ | --------------------------------------------- |
| POST   | `/api/v1/auth/password-reset`          | Public | Requests a reset without revealing anything   |
| POST   | `/api/v1/auth/password-reset/complete` | Public | Sets the new password and drops open sessions |

The request **always answers 204**. An unknown address, a blocked person, someone still
`INVITED`, and an unknown firm slug all receive the same silence as a real active account.
Differentiating would turn the route into an oracle for who works at a firm, and the slug
already makes the firm itself guessable.

The token lives one hour rather than the invitation's seven days: the person is at the screen
now, and a reset link alive for a week is an open window with no purpose. Issuing a new request
invalidates any previous open one — two live links for one account double the surface without
doubling the usefulness.

Completing the reset revokes every open refresh session with reason `PASSWORD_RESET`, in the
same transaction as the password change. People reset passwords precisely when they suspect
someone else got in; leaving the sessions alive would hand the account back. The password
minimum is 12 characters, the same floor as invitation acceptance, because both create a
password.

Refusals are indistinguishable: unknown, expired, already used, and belonging to another tenant
all return `PASSWORD_RESET_INVALID` with one message.

## E-mail delivery

Messages are never sent from an HTTP handler. The API writes the intent into `email_outbox` in
the **same transaction** as the fact that causes it — there is no invitation without a queued
message, and no message without an invitation — and the worker drains the table on its periodic
loop. An SMTP connection is a network call that can hang a request.

The outbox stores the template identifier and the named data that feeds it, never the rendered
body. Reconstructing what was sent is possible; leaking document or client content through the
table is not. The worker claims each row with the expected state in the `WHERE` clause, so two
workers cannot deliver the same invitation twice. A row that exhausts its attempts becomes
`FAILED` and stays: the record is the evidence that someone did not receive what they should.

Templates are a closed catalogue in `@lex-os/shared`, rendered as plain text. Plain text is the
choice, not a limitation — a legal-operations e-mail needs no layout, and HTML would open the
door to interpolating content without escaping. The development and test adapter records
instead of delivering and refuses production startup; the production relay is still an open
item in [ADR-014](../decisions/ADR-014-fronteira-de-identidade-e-acesso.md).

## Staying signed in

`POST /auth/login` accepts `keepSignedIn`. It defaults to false, and false means the refresh
cookie is set **without `Expires`** — the browser drops it when the window closes, and the
server session stays valid but unreachable from that machine. That is the right default for a
shared office computer, where the next person to open the browser must not find the previous
one's session.

When true, the cookie carries the configured refresh TTL, and a companion `lex_os_persistir`
cookie is set alongside it. The marker carries no secret; it exists so rotation knows to keep
persisting. Without it, the first refresh would silently downgrade a persistent session back to
a window session, and the person who asked to stay signed in would be signed out anyway.

Signing out clears both.

**The web client never stores a password.** It remembers the firm slug, the e-mail and the
"stay signed in" choice in `localStorage`, so only the password has to be typed, and the
password itself is left to the browser's own manager — the login form declares `name` and
`autocomplete` on all three fields so the manager offers to save and fill. Keeping a password
in `localStorage` would put it in clear text on disk, where any future script flaw reads it
along with access to the whole firm's dossier.

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
