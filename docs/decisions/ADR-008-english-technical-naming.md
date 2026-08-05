# ADR-008: Use English technical names and Brazilian Portuguese product language

- **Status:** Accepted
- **Date:** 2026-08-05
- **Deciders:** SAMUEL DEV LTDA / LEX OS architecture

## Context

LEX OS serves Brazilian legal professionals, while its code, APIs, libraries, vendor integrations, and engineering documentation need a consistent technical vocabulary. Mixing translated table/class names with Portuguese UI copy would make contracts and maintenance unpredictable.

Some Brazilian legal concepts are domain codes without a clearer or safer translation.

## Decision

- Use English for database tables/columns, classes, properties, API fields/paths, events, queue names, technical errors, and engineering documentation.
- Use Brazilian Portuguese (`pt-BR`) for interface labels, user messages, and the lawyer's product vocabulary.
- Stable Brazilian legal-domain values may remain unaccented Portuguese, such as `reclamante`, `polo_ativo`, and `direito_trabalhista`.
- Database identifiers use unaccented `snake_case`; TypeScript uses `PascalCase`/`camelCase`.
- API JSON uses `camelCase`; mapping to `snake_case` occurs in Prisma/database definitions.
- User-visible mappings hide technical persistence names—for example, `knowledge_chunks` becomes **Memória do escritório**.

## Consequences

### Positive

- consistent code and vendor/library terminology;
- natural language for Brazilian users;
- less ambiguity in APIs and schemas;
- domain-specific Portuguese concepts remain recognizable.

### Negative

- developers must maintain explicit UI/domain label mappings;
- enum codes may combine English platform states and Portuguese legal values;
- translation/i18n boundaries need discipline from the start;
- direct database terms must never leak into the UI.

## Rejected alternatives

- **Portuguese technical identifiers throughout:** increases inconsistency with ecosystem and external contracts.
- **English-only user interface:** reduces usability for the initial market.
- **Translate every Brazilian legal concept:** can distort established meaning.
- **Mix languages ad hoc:** produces unstable contracts and duplicate concepts.

## Compliance checks

- Lint/review rejects accented technical identifiers and inconsistent casing.
- API/OpenAPI reviews use English field names.
- UI tests assert required pt-BR labels for critical workflows.
- New legal codes document their intended meaning and remain stable after persistence.
