# ADR-005: Start semantic search with pgvector

- **Status:** Accepted
- **Date:** 2026-08-05
- **Deciders:** SAMUEL DEV LTDA / LEX OS architecture

## Context

The office memory engine needs semantic retrieval together with tenant, case, document, legal-area, and confidentiality filters. The MVP corpus and performance profile are unknown. Introducing a separate vector database would add synchronization, access-control, backup, and observability paths before evidence justifies them.

Embedding providers may use different dimensions, so the domain cannot assume one vendor/model dimension forever.

## Decision

Use the PostgreSQL `pgvector` extension for the initial semantic-search foundation.

- `knowledge_chunks` remains the source-aware search unit.
- Store provider, model, model version, dimensions, content hash, and source locator with each embedding.
- The domain depends on `EmbeddingProvider`, not pgvector or a vendor.
- All vector queries filter by organization and authorized scope inside the database query path.
- Start with an unbounded vector proposal and exact search at small MVP scale.
- Do not add HNSW/IVFFlat until a compatible configured dimension, corpus size, recall target, and query plan are measured.
- Combine semantic scores with PostgreSQL full-text and structured filters through a search adapter.

## Consequences

### Positive

- one transactional, backed-up data plane for metadata, text, and vectors;
- tenant/security filters can be applied with ordinary relational predicates;
- minimal local and operational complexity;
- provider/model metadata supports controlled re-embedding.

### Negative

- unbounded/mixed-dimension vectors cannot share a practical ANN index;
- exact search will not scale indefinitely;
- Prisma requires an unsupported field plus raw SQL;
- model changes require version-aware re-indexing and ranking tests.

## Rejected alternatives

- **Dedicated vector database immediately:** adds consistency and tenant-policy duplication without measured need.
- **Hard-code one vector dimension in domain code:** couples the model to a provider choice.
- **Semantic-only search:** performs poorly for exact names, process numbers, and legal identifiers.
- **Store embeddings without source/model metadata:** prevents explainable retrieval and safe regeneration.

## Compliance checks

- Search tests prove organization/confidentiality filters at the database boundary.
- Every returned chunk includes a resolvable source citation.
- Re-indexing is idempotent by source/chunk/content hash.
- ANN index creation requires benchmark evidence and an ADR update.
