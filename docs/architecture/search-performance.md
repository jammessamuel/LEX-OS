# Delivery 9 search query-plan baseline

**Status:** Verified synthetic local baseline

**Last updated:** 2026-08-12

## Purpose

This baseline verifies the selected PostgreSQL access paths before a real embedding model or production corpus exists. It is evidence for the Delivery 9 exact-search decision, not a production capacity claim.

The measurement ran inside one rolled-back transaction against local PostgreSQL 18 with pgvector. The synthetic tenant contained one standard case and 10,000 available/clean text documents, each with one completed OCR extraction and one 16-dimension knowledge chunk. Ten chunks contained the rare lexical phrase. All vector candidates used the deterministic mock descriptor.

The command used `EXPLAIN (ANALYZE, BUFFERS)` after `ANALYZE`; the transaction ended with `ROLLBACK`, leaving no synthetic rows.

## Observed plans

| Path                       |                Returned candidates | Execution time | Shared buffers | Relevant plan behavior                                                                         |
| -------------------------- | ---------------------------------: | -------------: | -------------: | ---------------------------------------------------------------------------------------------- |
| Portuguese lexical search  |                                 10 |       0.923 ms |       251 hits | `Bitmap Index Scan` on `knowledge_chunks_search_vector_gin_idx`, then same-tenant source joins |
| Exact cosine vector search | 10 of 10,000 authorized candidates |      21.346 ms |    81,088 hits | scans the filtered candidate set and uses top-N heapsort; no ANN index                         |

Selected lexical plan fragment:

```text
Bitmap Index Scan on knowledge_chunks_search_vector_gin_idx
  Index Cond: (search_vector @@ '''cláusul'' & ''rescisór'''::tsquery)
Bitmap Heap Scan on knowledge_chunks
  Filter: organization_id = <tenant> AND source_type = 'DOCUMENT_EXTRACTION'
Execution Time: 0.923 ms
```

Selected vector plan fragment:

```text
CTE candidates
  -> authorized tenant/source joins (10,000 rows)
CTE Scan on candidates
  Filter: 1 - cosine_distance >= 0.65
Sort Method: top-N heapsort  Memory: 25kB
Execution Time: 21.346 ms
```

## Interpretation and next trigger

The lexical GIN path avoids scanning the corpus for a rare term. Exact vector ranking is intentionally linear in the authorized candidate count; it keeps filter semantics simple and avoids committing to one dimension before a production model exists.

These warm-cache local numbers are not an SLA. Before adding HNSW/IVFFlat or a separate search service, repeat measurements with representative tenant distribution, chunk length, confidentiality mix, provider dimension, filtered recall targets, cold-cache behavior, concurrent searches, and corpus growth. An ANN change requires benchmark evidence and an ADR update because mixed dimensions and pre-filtering affect both correctness and index eligibility.
