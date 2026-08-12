# People, cases, and participants API

**Status:** Implemented in Delivery 5; case responsibility response extended in Delivery 10
**Last updated:** 2026-08-12

File and document resources nested under an authorized case are documented separately in [Files and documents API](./files-documents.md).

## Contract summary

All routes require a valid bearer access token. Tenant identity always comes from the verified session; `organizationId` is not accepted in resource payloads. List routes use opaque keyset cursors, default to 20 records, accept at most 100, and return:

```json
{
  "data": [],
  "pageInfo": {
    "nextCursor": null,
    "hasNextPage": false
  }
}
```

Unknown, foreign-tenant, inaccessible confidential, and soft-deleted direct resources return the same safe `404 NOT_FOUND` envelope. Unknown body/query properties are rejected.

## Routes and permissions

| Method | Route                                | Permission       | Behavior                                |
| ------ | ------------------------------------ | ---------------- | --------------------------------------- |
| GET    | `/api/v1/persons`                    | `persons.read`   | Lists active people                     |
| POST   | `/api/v1/persons`                    | `persons.manage` | Creates a person                        |
| GET    | `/api/v1/persons/:id`                | `persons.read`   | Reads an active person                  |
| PATCH  | `/api/v1/persons/:id`                | `persons.manage` | Updates an active person                |
| DELETE | `/api/v1/persons/:id`                | `persons.manage` | Soft-deletes a person                   |
| GET    | `/api/v1/cases`                      | `cases.read`     | Lists accessible active cases           |
| POST   | `/api/v1/cases`                      | `cases.create`   | Creates a case                          |
| GET    | `/api/v1/cases/:id`                  | `cases.read`     | Reads an accessible active case         |
| PATCH  | `/api/v1/cases/:id`                  | `cases.update`   | Updates an accessible active case       |
| DELETE | `/api/v1/cases/:id`                  | `cases.delete`   | Soft-deletes an accessible case         |
| GET    | `/api/v1/cases/:caseId/participants` | `cases.read`     | Lists validated participant summaries   |
| POST   | `/api/v1/cases/:caseId/participants` | `cases.update`   | Associates an active same-tenant person |

## People and identifiers

`personType` accepts `INDIVIDUAL`, `COMPANY`, or `GOVERNMENT_ENTITY`. CPF and CNPJ punctuation is removed before persistence, repeated digits and invalid check digits are rejected, and CPF is accepted only for an individual. CNPJ may identify a company or government entity.

The database keeps the normalized value for authorized future workflows. Current API responses never expose complete CPF, CNPJ, or RG values; they return masked representations. Request bodies and query strings are not logged, and resource audits store no name, identity document, contact data, metadata, or other free legal text.

## Cases and confidentiality

Internal codes normalize to uppercase and are unique per organization. Legal area and case type are stable uppercase technical codes. A responsible user must be active, not soft-deleted, and belong to the current organization. `closedAt` cannot precede `openedAt`.

Case responses preserve `responsibleUserId` for filtering and future assignment forms and also embed `responsible: { id, name } | null`. The relation is selected with the case under the same tenant-consistent database relationship, avoiding client-side N+1 requests. E-mail, status, roles, and other user fields are not exposed by this summary.

Status values are `INTAKE`, `DOCUMENT_COLLECTION`, `UNDER_ANALYSIS`, `READY_TO_FILE`, `FILED`, `ACTIVE`, `SUSPENDED`, `SETTLED`, `CLOSED`, and `ARCHIVED`. Priorities are `LOW`, `NORMAL`, `HIGH`, and `URGENT`. Confidentiality is `STANDARD`, `CONFIDENTIAL`, or `RESTRICTED`.

Actors without `confidential_cases.read` see only standard cases in lists and receive opaque not-found responses for confidential direct/nested resources. Authorized confidential detail, list, and participant reads append allowlisted audit events.

## Participants and isolation

Participant roles are restricted to `autor`, `reu`, `reclamante`, `reclamado`, `testemunha`, `perito`, `juiz`, `advogado`, `terceiro_interessado`, and `representante_legal`. Sides are optional and restricted to `polo_ativo`, `polo_passivo`, `terceiro`, or `neutro`.

The service verifies the case and person under the authenticated organization before creating the association. PostgreSQL composite foreign keys repeat the tenant check, so a race or alternate application path cannot link resources from different organizations. Participant lists load their person summaries in the same database query and exclude soft-deleted people.

## Audit allowlists

Create, update, delete, participant association, and confidential-read actions append audit records in the same short transaction as their mutation where applicable. Audits contain only identifiers, policy/status fields, changed-field names, participant vocabulary, boolean flags, outcome, and request/correlation IDs. Names, titles, descriptions, CPF/CNPJ/RG, contacts, passwords, tokens, and raw payloads are prohibited and covered by integration assertions.
