# Grounded assistant API

**Status:** Backend contract implemented during authorized Delivery 10

**Last updated:** 2026-09-08

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
  "model": null,
  "refusalReason": "NO_AUTHORIZED_SOURCE"
}
```

A second refusal exists and means something different. When authorized sources _are_ retrieved,
the model reads them and none supports an answer, the provider returns an empty claim list — which
the output contract instructs it to do — and the service answers `INSUFFICIENT_EVIDENCE` with
`"refusalReason": "SOURCES_DO_NOT_SUPPORT"` and full model provenance, because the model ran and
the case is charged for it.

The two reasons send a reader to different places: `NO_AUTHORIZED_SOURCE` says the archive holds
nothing on the subject, while `SOURCES_DO_NOT_SUPPORT` says it holds material on the case but not
on this question, so rephrasing usually helps. Reporting the first when it is the second sends a
lawyer looking elsewhere for a document that is already here. `refusalReason` is `null` on an
answer.

## Grounding and provenance

Every accepted answer is machine-labelled and split into claims. A response carries at most eight
claims, and each claim must cite one to five chunk identifiers from the authorized retrieval set;
the API resolves those identifiers back to document/page/offset citations before responding.
Unknown, missing, duplicated, or unresolvable source identifiers — or more claims than the
ceiling — make the entire provider output fail closed with `502 INVALID_LANGUAGE_MODEL_OUTPUT`.
Both ceilings come from the versioned output contract in `packages/ai-prompts`, which the parser
reads instead of keeping its own copy.

Since 2026-09-08 the output format is enforced at generation time, not merely requested: the
Anthropic adapter sends a structured-output schema derived from the same contract
(`output_config.format`), so a normally terminated response is grammar-constrained to valid JSON.
The two documented exceptions — a provider safety refusal and an output-token truncation — are
decided by `stop_reason` before any parsing and fail closed with named reasons. The service-side
parser still validates everything afterwards: a vendor guarantee does not replace our own.

The top-level `answer` is only a presentation join of the validated claims. Model metadata records
provider, model, model version, prompt version, the SHA-256 hash of the effective instruction,
execution ID, and exact six-decimal BRL cost. The hash covers the selected prompt text, the output
contract appended by the adapter, and the structured-output schema enforced at the provider
boundary — but never the question or document content. It is computed for mock runs too, as the
fingerprint of what would govern a real call. It is persisted in the append-only audit event for
generated, refused-after-model, failed, and invalid executions. The prompt specification is
versioned in `packages/ai-prompts` and treats retrieved document text as hostile evidence, never
as an instruction channel.

## Audit and production boundary

Generated and refused attempts append allowlisted audit events. They contain the case identifier,
question length, status/counts, cited chunk identifiers, and model/cost provenance where present;
they never store the question, answer, source excerpts, authorization headers, or document content.

The runtime supports the deterministic zero-cost mock and an Anthropic adapter. Production refuses
the mock, while the Anthropic adapter is restricted to `CASE_ARCHIVE=fictional` and requires an
API key plus explicit input/output cost configuration. No provider may receive a real client
archive until the ADR-012 and ADR-016 external governance gates are demonstrably complete and a
separately authorized delivery removes the fail-closed archive guard.
