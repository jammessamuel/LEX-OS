# Search API

**Status:** Implemented in Delivery 9

**Last updated:** 2026-08-12

## Route and authorization

`POST /api/v1/search` requires an authenticated actor with `knowledge.search`. The request body is used instead of a query string so search text does not enter URLs, proxy access logs, or browser history.

Tenant identity always comes from the verified session. `organizationId` is not accepted. Every lexical and vector database query constrains the organization and joins the source case, document, file, and OCR extraction before ranking.

```json
{
  "query": "contrato celebrado em agosto de 2026",
  "mode": "HYBRID",
  "caseId": "optional-uuid",
  "documentId": "optional-uuid",
  "documentTypeId": "optional-uuid",
  "legalArea": "TRABALHISTA",
  "limit": 10
}
```

`mode` defaults to `HYBRID` and also accepts `LEXICAL` or `SEMANTIC`. The limit defaults to 10 and is bounded from 1 to 25. Search text is trimmed and bounded from 2 to 500 characters.

## Ranking and authorized source set

Lexical retrieval uses the Portuguese PostgreSQL configuration, a stored generated `tsvector`, and a GIN index. Semantic retrieval embeds the query through the same versioned `EmbeddingProvider` descriptor used during indexing and performs exact pgvector cosine-distance ranking. The deterministic mock has 16 dimensions and a minimum semantic similarity of `0.65`; it refuses production startup.

Hybrid mode retrieves a bounded authorized candidate set from each database path and combines ranks through reciprocal-rank fusion with constant 60. This avoids treating lexical and cosine scores as if they shared a numeric scale. Stable chunk-ID ordering breaks ties.

Both database paths exclude:

- other organizations;
- confidential/restricted cases unless the actor has `confidential_cases.read`;
- soft-deleted cases, documents, or files;
- files outside `AVAILABLE/CLEAN` state;
- non-completed or non-OCR extraction sources;
- a superseded OCR extraction when a newer completed extraction exists;
- embeddings whose provider, model, version, or dimensions differ from the query provider.

Optional case, document, document-type, and legal-area filters are added to the same database predicate. A foreign or inaccessible direct ID therefore yields zero authorized results rather than revealing that the resource exists.

## Response and evidence contract

Every result carries only the source excerpt, rank metadata, and a resolvable citation:

```json
{
  "status": "RESULTS",
  "mode": "HYBRID",
  "resultCount": 1,
  "results": [
    {
      "chunkId": "uuid",
      "excerpt": "Trecho fictício autorizado.",
      "matchedBy": "HYBRID",
      "score": 0.03278689,
      "citation": {
        "caseId": "uuid",
        "documentId": "uuid",
        "extractionId": "uuid",
        "pageNumber": 1,
        "startOffset": 0,
        "endOffset": 29,
        "contentHash": "64-lowercase-hex-characters"
      }
    }
  ]
}
```

A chunk with invalid or mismatched locator metadata is not returned. When no authorized supported source remains, the contract is explicit and contains no generated answer:

```json
{
  "status": "INSUFFICIENT_EVIDENCE",
  "mode": "LEXICAL",
  "resultCount": 0,
  "results": []
}
```

Delivery 9 is retrieval only. A later source-grounded assistant may consume this contract under ADR-009, but it cannot treat conversation history or model knowledge as evidence.

## Audit and content safety

Every successful search writes `knowledge.search.executed` with mode, query length, result count, status, and allowlisted filter IDs. It never stores the query or excerpts. Returning confidential results additionally writes `case.confidential.read` with access type `SEARCH` and count.

Indexed text remains untrusted evidence. Prompt-like text is returned only as source content; it cannot alter SQL filters, request authorization, provider instructions, or tenant selection.
