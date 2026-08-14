# Grounded assistant API

**Status:** Backend contract implemented during authorized Delivery 10

**Last updated:** 2026-08-13

## Contract

`POST /api/v1/assistant/answers` requires an authenticated actor with `knowledge.search`. The
request contains one `question`, the mandatory `caseId`, and optional `documentId`, retrieval
`mode`, and result `limit`. It does not accept conversation history, tenant identity, provider
selection, system instructions, or unknown fields.

The service retrieves sources through the same database-enforced organization, case,
confidentiality, soft-delete, file-state, and current-extraction filters as `POST /api/v1/search`.
If no authorized source remains, it does not call the language-model provider and returns:

```json
{
  "status": "INSUFFICIENT_EVIDENCE",
  "machineGenerated": true,
  "disclaimer": "Conteúdo gerado por máquina a partir de fontes autorizadas; não é parecer jurídico e exige revisão humana.",
  "answer": null,
  "claims": [],
  "model": null
}
```

## Grounding and provenance

Every accepted answer is machine-labelled and split into claims. Each claim must cite one to three
chunk identifiers from the authorized retrieval set; the API resolves those identifiers back to
document/page/offset citations before responding. Unknown, missing, duplicated, or unresolvable
source identifiers make the entire provider output fail closed with
`502 INVALID_LANGUAGE_MODEL_OUTPUT`.

The top-level `answer` is only a presentation join of the validated claims. Model metadata records
provider, model, model version, prompt version, execution ID, and exact six-decimal BRL cost. The
prompt specification is versioned in `packages/ai-prompts` and treats retrieved document text as
hostile evidence, never as an instruction channel.

## Audit and production boundary

Generated and refused attempts append allowlisted audit events. They contain the case identifier,
question length, status/counts, cited chunk identifiers, and model/cost provenance where present;
they never store the question, answer, source excerpts, authorization headers, or document content.

The current language-model adapter is deterministic and has zero mock cost. It refuses production
startup. A real provider requires a governed adapter, production cost policy, schema/provenance
validation, operational limits, and ADR-011 accounting before it may receive legal content.
