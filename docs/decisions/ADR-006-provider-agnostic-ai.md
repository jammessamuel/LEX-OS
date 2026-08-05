# ADR-006: Keep AI capabilities provider-agnostic and source-grounded

- **Status:** Accepted
- **Date:** 2026-08-05
- **Deciders:** SAMUEL DEV LTDA / LEX OS architecture

## Context

OCR, transcription, classification, entity extraction, summarization, embeddings, and language generation have different providers, reliability profiles, data-governance constraints, costs, and model lifecycles. Direct SDK use in domain modules would create lock-in, inhibit deterministic tests, and scatter safety/provenance rules.

Uploaded documents are untrusted and may contain prompt-injection instructions. Legal output without a source is unacceptable.

## Decision

Define internal ports for:

- `OcrProvider`;
- `TranscriptionProvider`;
- `ClassificationProvider`;
- `EntityExtractionProvider`;
- `SummarizationProvider`;
- `EmbeddingProvider`;
- `LanguageModelProvider`.

Vendor SDKs exist only in infrastructure adapters. The initial executable pipeline uses deterministic mocks.

Provider output must pass a versioned structured schema before persistence. Every execution records provider, model, model version, prompt version, execution ID, duration, status, and confidence where meaningful. Reprocessing appends an extraction rather than overwriting history.

Prompts are versioned artifacts with purpose, input/output schemas, examples, and validation criteria. Retrieved document content is structurally separated and explicitly treated as untrusted data. Generated legal claims and events require authorized source locators; an unsupported query returns insufficient evidence.

## Consequences

### Positive

- vendor replacement and multi-provider routing remain possible;
- deterministic and offline tests cover the pipeline;
- provenance, schema validation, and safety policy are centralized;
- historical outputs remain reproducible/explainable at the recorded-version level.

### Negative

- internal contracts must represent provider capability differences carefully;
- lowest-common-denominator interfaces could hide useful provider features;
- exact reproduction may still be impossible when vendors retire models;
- storing provenance and immutable executions increases data volume.

## Rejected alternatives

- **One universal vendor client in domain code:** maximizes lock-in and inconsistent error handling.
- **Persist arbitrary model JSON:** allows malformed or adversarial output into domain records.
- **Overwrite the latest extraction:** destroys auditability and human-review context.
- **Let documents contribute instructions:** creates prompt-injection and data-exfiltration risk.
- **Answer without sources when retrieval is empty:** violates the core product promise.

## Compliance checks

- Domain packages have no vendor SDK imports.
- Contract tests run against every adapter and deterministic mock.
- Invalid structured output and missing provenance fail closed.
- Prompt-injection tests include attempts to reveal secrets, other tenants, and tools.
- Audit actor type distinguishes `AI` from `SYSTEM` and `USER`.
