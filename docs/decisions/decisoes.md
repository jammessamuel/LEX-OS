# Decisões de arquitetura — registro consolidado

- **Documento único.** As quinze decisões que antes viviam em `docs/decisions/ADR-NNN-*.md`
  estão aqui, com o texto preservado. Os arquivos separados foram removidos em 2026-08-26 a
  pedido do dono; o histórico do Git guarda cada um deles.
- **Como referenciar.** Continue citando pelo número — `ADR-011` — e, quando precisar do
  caminho, use `docs/decisions/decisoes.md` com a âncora que o índice abaixo dá.
- **Como acrescentar.** ADR novo entra como seção `##` no fim, na numeração seguinte, e ganha
  uma linha no índice. Nunca reescreva uma decisão aceita: registre a reversão como decisão nova
  e marque a antiga como superada, dizendo por qual.
- **Idioma.** As oito primeiras são em inglês, por serem anteriores à convenção de escrever
  decisão de sociedade em pt-BR. Ficaram como estavam: reescrevê-las trocaria o texto acordado.

## Índice

| #                                                                                            | Decisão                                                                  | Status   | Data       |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------- | ---------- |
| [ADR-001](#adr-001-start-with-a-modular-monolith)                                            | Start with a modular monolith                                            | Accepted | 2026-08-05 |
| [ADR-002](#adr-002-use-postgresql-with-prisma-as-the-primary-data-layer)                     | Use PostgreSQL with Prisma as the primary data layer                     | Accepted | 2026-08-05 |
| [ADR-003](#adr-003-store-original-files-in-private-s3-compatible-object-storage)             | Store original files in private S3-compatible object storage             | Accepted | 2026-08-05 |
| [ADR-004](#adr-004-use-shared-schema-application-enforced-multi-tenancy)                     | Use shared-schema application-enforced multi-tenancy                     | Accepted | 2026-08-05 |
| [ADR-005](#adr-005-start-semantic-search-with-pgvector)                                      | Start semantic search with pgvector                                      | Accepted | 2026-08-05 |
| [ADR-006](#adr-006-keep-ai-capabilities-provider-agnostic-and-source-grounded)               | Keep AI capabilities provider-agnostic and source-grounded               | Accepted | 2026-08-05 |
| [ADR-007](#adr-007-use-persistent-processing-jobs-with-bullmq-workers)                       | Use persistent processing jobs with BullMQ workers                       | Accepted | 2026-08-05 |
| [ADR-008](#adr-008-use-english-technical-names-and-brazilian-portuguese-product-language)    | Use English technical names and Brazilian Portuguese product language    | Accepted | 2026-08-05 |
| [ADR-009](#adr-009-definir-o-escopo-do-assistente-interno)                                   | Definir o escopo do Assistente Interno                                   | Aceito   | 2026-08-05 |
| [ADR-010](#adr-010-decidir-os-canais-de-ingestão-do-mvp)                                     | Decidir os canais de ingestão do MVP                                     | Superado | 2026-08-05 |
| [ADR-011](#adr-011-estabelecer-o-modelo-de-custo-de-processamento-e-a-escolha-de-provedores) | Estabelecer o modelo de custo de processamento e a escolha de provedores | Aceito   | 2026-08-05 |
| [ADR-012](#adr-012-estabelecer-retenção-legal-hold-e-a-postura-de-lgpd)                      | Estabelecer retenção, legal hold e a postura de LGPD                     | Aceito   | 2026-08-05 |
| [ADR-013](#adr-013-notificações-internas-por-e-mail)                                         | Notificações internas por e-mail                                         | Aceito   | 2026-08-07 |
| [ADR-014](#adr-014-fronteira-de-identidade-e-acesso)                                         | Fronteira de identidade e acesso                                         | Aceito   | 2026-08-20 |
| [ADR-015](#adr-015-biblioteca-de-prompts-e-pesquisa-por-agentes)                             | Biblioteca de prompts e pesquisa por agentes                             | Aceito   | 2026-08-26 |
| [ADR-016](#adr-016-encerrar-o-mvp-sem-fabricar-as-condições-externas)                        | Encerrar o MVP sem fabricar as condições externas                        | Aceito   | 2026-08-28 |

## Estado de execução

O que cada decisão virou código, e o que continua aberto, está em
[`docs/product/ordem-de-execucao.md`](../product/ordem-de-execucao.md) — verificado no código,
não deduzido daqui. Este documento registra o que foi **decidido**; aquele, o que foi **feito**.

---

## ADR-001: Start with a modular monolith

- **Status:** Accepted
- **Date:** 2026-08-05
- **Deciders:** SAMUEL DEV LTDA / LEX OS architecture

### Context

LEX OS spans identity, cases, files, asynchronous processing, AI extractions, chronology, checklists, search, and audit. These domains need clear ownership, but the first team and workload do not justify independent services, distributed transactions, multiple deployment pipelines, or duplicated operational tooling.

Heavy processing must not execute in HTTP requests, and the web client has an independent runtime. This separation does not require turning domain modules into microservices.

### Decision

Build one modular backend codebase in a pnpm/Turborepo monorepo. Run it through two composition roots:

- `apps/api` for NestJS HTTP transport;
- `apps/worker` for BullMQ processors.

Both use the same domain/application modules, contracts, Prisma database, and observability conventions. `apps/web` is a separate Vue client.

Modules expose application services or explicit ports and keep repositories internal. Asynchronous queue messages reference persisted job IDs and do not become a second source of domain truth.

Extract a service only after measured scaling, security isolation, reliability, ownership, or independent release requirements demonstrate the need. Extraction requires a new ADR.

### Consequences

#### Positive

- simpler transactions and tenant consistency;
- one schema and one coherent audit trail;
- lower local/CI/production operational cost;
- fast refactoring while module boundaries are still being learned;
- API and worker can scale independently at the process level.

#### Negative

- poor module discipline could create tight coupling;
- all backend modules share a deployment artifact and database failure domain;
- resource-heavy worker libraries must not leak into API startup/runtime;
- later extraction still requires deliberate contract and data ownership work.

### Rejected alternatives

- **Microservices from the start:** adds distributed consistency, tracing, deployment, and testing cost without evidence.
- **Single HTTP process including heavy jobs:** violates latency and reliability requirements.
- **Serverless function per operation:** complicates streaming, long-running processing, shared transactions, and local parity at this stage.

### Compliance checks

- Module tests must not import another module's private repository.
- API smoke tests prove worker-only providers do not initialize in the API process.
- Architecture review is required before adding a separately owned datastore or deployable backend service.

---

## ADR-002: Use PostgreSQL with Prisma as the primary data layer

- **Status:** Accepted
- **Date:** 2026-08-05
- **Deciders:** SAMUEL DEV LTDA / LEX OS architecture

### Context

The product needs relational integrity across tenants, users, cases, documents, jobs, and audit records; transactional changes; JSON metadata; full-text search; and vector storage. Type-safe application access is valuable, but PostgreSQL-specific constraints and extensions remain necessary.

### Decision

Use PostgreSQL as the system of record and Prisma as the primary ORM/migration workflow.

- UUIDs use PostgreSQL `gen_random_uuid()`.
- Times use `timestamptz`; date-only legal values use `date`.
- Tenant-consistent composite foreign keys are created wherever possible.
- JSONB is reserved for genuinely variable metadata, not as a substitute for modeled fields.
- Prisma migrations remain canonical, with reviewed SQL additions for pgvector, partial indexes, generated full-text structures, checks, and other unsupported PostgreSQL features.
- Production migrations run as a controlled release step. `prisma db push` is not used for shared or production databases.

### Consequences

#### Positive

- transactional consistency for core workflow and audit;
- strong relational constraints against cross-tenant linkage;
- typed query client and reproducible migrations;
- one database supports structured, full-text, JSON, and initial vector needs;
- lower operational complexity for the MVP.

#### Negative

- Prisma does not model every PostgreSQL feature; migrations need manual review;
- careless direct Prisma usage can omit tenant filters;
- high-volume vector or text workloads may eventually require specialization;
- schema changes to large tables will need production-safe rollout patterns.

### Rejected alternatives

- **MongoDB/document database:** weaker fit for the relationship and transaction-heavy model.
- **Separate databases for relational and search data immediately:** adds synchronization and tenancy failure paths prematurely.
- **SQL query builder only:** offers control but less standardized schema/client workflow for the initial team; targeted raw SQL remains available.

### Compliance checks

- CI runs Prisma format/validate and migration checks on a clean PostgreSQL instance.
- Generated SQL is reviewed for destructive changes, locks, constraints, and indexes.
- Integration tests attempt representative forbidden cross-tenant inserts.
- Repositories/application services, not controllers, own Prisma access.

---

## ADR-003: Store original files in private S3-compatible object storage

- **Status:** Accepted
- **Date:** 2026-08-05
- **Deciders:** SAMUEL DEV LTDA / LEX OS architecture

### Context

LEX OS receives potentially large, sensitive, malicious, and legally important files. PostgreSQL is not appropriate for primary binary storage. Development needs local parity, while production must support managed durable storage without binding the domain to one vendor.

### Decision

Use an internal object-storage port with:

- MinIO for local development;
- a private S3-compatible service in production;
- generated, non-predictable storage keys without customer or file PII;
- streamed upload/download paths;
- quarantine until validation and required malware scanning complete;
- immutable original objects;
- separate keys for derived artifacts;
- short-lived download URLs issued only after tenant, permission, confidentiality, and file-state checks;
- SHA-256 and metadata persisted in PostgreSQL, never the primary binary.

Database/object-store reconciliation is mandatory because the two systems cannot commit atomically.

### Consequences

#### Positive

- efficient handling of large binaries;
- private access policies and lifecycle features;
- local development parity through MinIO;
- provider portability through one small adapter;
- original evidence remains distinct from derived content.

#### Negative

- upload/database operations are a distributed consistency boundary;
- signed URLs can leak if logged or given excessive lifetime;
- lifecycle, backups, object lock, region, retention, and legal hold need explicit production policy;
- S3-compatible providers may differ on edge semantics.

### Rejected alternatives

- **PostgreSQL bytea/large objects:** increases database size, backup cost, and serving complexity.
- **Local filesystem:** unsuitable for horizontally scaled or durable production workloads.
- **Public bucket with obscure URLs:** fails confidentiality and authorization requirements.
- **Direct vendor SDK calls in domain modules:** creates lock-in and makes security policy inconsistent.

### Compliance checks

- Bucket/object policy tests prove anonymous access is denied.
- Download URL tests cover tenant, permission, confidentiality, deletion, quarantine, and expiry.
- Upload tests verify streaming, actual MIME inspection, path-safe keys, size limits, and redacted logs.
- Reconciliation reports orphaned database rows and objects without deleting automatically in the first iteration.

---

## ADR-004: Use shared-schema application-enforced multi-tenancy

- **Status:** Accepted
- **Date:** 2026-08-05
- **Deciders:** SAMUEL DEV LTDA / LEX OS architecture

### Context

`Organization` is the SaaS tenant. LEX OS processes confidential legal, personal, financial, and medical data, so a cross-organization disclosure is a critical failure. The MVP should not incur database-per-tenant operational cost, but application-only filtering without structural guardrails is too fragile.

### Decision

Use one PostgreSQL database and shared schema for the MVP.

- Every tenant-owned table carries `organization_id`.
- Tenant identity is derived from the authenticated user/session, never trusted from client payloads.
- Application and repository methods receive tenant context explicitly and constrain every read/write/search/aggregate.
- Authorization additionally evaluates granular permission and resource confidentiality.
- Composite `(organization_id, id)` candidate keys and foreign keys enforce same-tenant relationships where possible.
- Global-or-tenant definitions use explicit visibility policies and negative tests.
- Cross-tenant “not found” behavior avoids resource enumeration.
- PostgreSQL RLS is a possible later defense-in-depth layer, not the MVP's only or initial enforcement.

### Consequences

#### Positive

- efficient SaaS operations and migrations;
- strong database protection against many cross-tenant relations;
- straightforward transactions and shared reference catalogs;
- a clear path to RLS or higher-isolation tiers later.

#### Negative

- every query path remains security-sensitive;
- nullable global ownership cannot be protected entirely with ordinary composite foreign keys;
- shared resource contention and backup/restore are not tenant-isolated;
- tenant-specific data export/deletion requires careful tooling.

### Rejected alternatives

- **Database per tenant:** strongest physical separation but excessive provisioning, migration, pooling, and analytics overhead for the MVP.
- **Schema per tenant:** still creates migration/connection complexity and weak ecosystem support.
- **Trusting an `organization_id` request field:** directly enables tenant spoofing.
- **RLS only from day one:** valuable later, but session context/pooling mistakes can create false confidence and it does not replace authorization.

### Compliance checks

Each tenant-owned feature tests:

- list exclusion;
- direct ID access;
- relation/link attempts;
- mutation and deletion;
- counts/search/export/download;
- confidentiality denial;
- audit/log non-disclosure.

Code review rejects unscoped `findUnique`, raw SQL, vector search, or object-key access for tenant resources.

---

## ADR-005: Start semantic search with pgvector

- **Status:** Accepted
- **Date:** 2026-08-05
- **Deciders:** SAMUEL DEV LTDA / LEX OS architecture

### Context

The office memory engine needs semantic retrieval together with tenant, case, document, legal-area, and confidentiality filters. The MVP corpus and performance profile are unknown. Introducing a separate vector database would add synchronization, access-control, backup, and observability paths before evidence justifies them.

Embedding providers may use different dimensions, so the domain cannot assume one vendor/model dimension forever.

### Decision

Use the PostgreSQL `pgvector` extension for the initial semantic-search foundation.

- `knowledge_chunks` remains the source-aware search unit.
- Store provider, model, model version, dimensions, content hash, and source locator with each embedding.
- The domain depends on `EmbeddingProvider`, not pgvector or a vendor.
- All vector queries filter by organization and authorized scope inside the database query path.
- Start with an unbounded vector proposal and exact search at small MVP scale.
- Do not add HNSW/IVFFlat until a compatible configured dimension, corpus size, recall target, and query plan are measured.
- Combine semantic scores with PostgreSQL full-text and structured filters through a search adapter.

### Consequences

#### Positive

- one transactional, backed-up data plane for metadata, text, and vectors;
- tenant/security filters can be applied with ordinary relational predicates;
- minimal local and operational complexity;
- provider/model metadata supports controlled re-embedding.

#### Negative

- unbounded/mixed-dimension vectors cannot share a practical ANN index;
- exact search will not scale indefinitely;
- Prisma requires an unsupported field plus raw SQL;
- model changes require version-aware re-indexing and ranking tests.

### Rejected alternatives

- **Dedicated vector database immediately:** adds consistency and tenant-policy duplication without measured need.
- **Hard-code one vector dimension in domain code:** couples the model to a provider choice.
- **Semantic-only search:** performs poorly for exact names, process numbers, and legal identifiers.
- **Store embeddings without source/model metadata:** prevents explainable retrieval and safe regeneration.

### Compliance checks

- Search tests prove organization/confidentiality filters at the database boundary.
- Every returned chunk includes a resolvable source citation.
- Re-indexing is idempotent by source/chunk/content hash.
- ANN index creation requires benchmark evidence and an ADR update.

---

## ADR-006: Keep AI capabilities provider-agnostic and source-grounded

- **Status:** Accepted
- **Date:** 2026-08-05
- **Deciders:** SAMUEL DEV LTDA / LEX OS architecture

### Context

OCR, transcription, classification, entity extraction, summarization, embeddings, and language generation have different providers, reliability profiles, data-governance constraints, costs, and model lifecycles. Direct SDK use in domain modules would create lock-in, inhibit deterministic tests, and scatter safety/provenance rules.

Uploaded documents are untrusted and may contain prompt-injection instructions. Legal output without a source is unacceptable.

### Decision

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

### Consequences

#### Positive

- vendor replacement and multi-provider routing remain possible;
- deterministic and offline tests cover the pipeline;
- provenance, schema validation, and safety policy are centralized;
- historical outputs remain reproducible/explainable at the recorded-version level.

#### Negative

- internal contracts must represent provider capability differences carefully;
- lowest-common-denominator interfaces could hide useful provider features;
- exact reproduction may still be impossible when vendors retire models;
- storing provenance and immutable executions increases data volume.

### Rejected alternatives

- **One universal vendor client in domain code:** maximizes lock-in and inconsistent error handling.
- **Persist arbitrary model JSON:** allows malformed or adversarial output into domain records.
- **Overwrite the latest extraction:** destroys auditability and human-review context.
- **Let documents contribute instructions:** creates prompt-injection and data-exfiltration risk.
- **Answer without sources when retrieval is empty:** violates the core product promise.

### Compliance checks

- Domain packages have no vendor SDK imports.
- Contract tests run against every adapter and deterministic mock.
- Invalid structured output and missing provenance fail closed.
- Prompt-injection tests include attempts to reveal secrets, other tenants, and tools.
- Audit actor type distinguishes `AI` from `SYSTEM` and `USER`.

---

## ADR-007: Use persistent processing jobs with BullMQ workers

- **Status:** Accepted
- **Date:** 2026-08-05
- **Deciders:** SAMUEL DEV LTDA / LEX OS architecture

### Context

File validation, malware scanning, OCR, transcription, classification, extraction, embedding, timeline, and checklist work can be slow, expensive, rate-limited, and retryable. Performing it within HTTP requests causes timeouts, duplicated work, poor progress visibility, and unreliable recovery.

Redis queue state alone is not sufficient as long-term product history or audit evidence.

### Decision

Use BullMQ on Redis for delivery/retry mechanics and a separate `apps/worker` process for execution. Persist a `processing_jobs` record in PostgreSQL as the product-visible source of truth.

- HTTP intake creates resource records and a queued job, then enqueues a small versioned message containing the job ID, tenant ID, and correlation ID.
- The worker reloads authoritative data, validates tenant consistency, and uses a centralized state-transition service.
- Delivery is treated as at least once; processors and result persistence are idempotent.
- Safe errors, attempt count, provider/model, timings, and progress metadata are persisted.
- Stale queued jobs are reconciled/re-enqueued when database commit succeeds but queue publication fails.
- Audits use `SYSTEM` or `AI` according to who produced the effect.

An outbox may replace/enhance reconciliation if measured failure modes require it.

### Consequences

#### Positive

- bounded HTTP latency and visible progress;
- independent API/worker process scaling;
- controlled retries and provider rate management;
- PostgreSQL preserves processing history if Redis data expires;
- deterministic mock processors support end-to-end tests.

#### Negative

- database/queue publication is a dual write;
- at-least-once delivery requires careful idempotency;
- stuck-job detection, retry policy, and dead-letter operations need ownership;
- Redis and worker health become runtime dependencies.

### Rejected alternatives

- **Synchronous processing in controllers:** violates explicit latency/reliability requirements.
- **BullMQ state only:** insufficient for durable UI, audit, and tenant queries.
- **Exactly-once assumption:** not guaranteed by the queue and unsafe under crashes.
- **Kafka/event platform for the MVP:** disproportionate operational complexity for command-like document jobs.

### Compliance checks

- Integration tests cover every allowed/forbidden state transition.
- Duplicate message delivery does not duplicate one logical result.
- Worker restart and enqueue-gap reconciliation are tested.
- Queue payloads contain references, not document content or secrets.
- API tests prove heavy providers are never called in the request path.

---

## ADR-008: Use English technical names and Brazilian Portuguese product language

- **Status:** Accepted
- **Date:** 2026-08-05
- **Deciders:** SAMUEL DEV LTDA / LEX OS architecture

### Context

LEX OS serves Brazilian legal professionals, while its code, APIs, libraries, vendor integrations, and engineering documentation need a consistent technical vocabulary. Mixing translated table/class names with Portuguese UI copy would make contracts and maintenance unpredictable.

Some Brazilian legal concepts are domain codes without a clearer or safer translation.

### Decision

- Use English for database tables/columns, classes, properties, API fields/paths, events, queue names, technical errors, and engineering documentation.
- Use Brazilian Portuguese (`pt-BR`) for interface labels, user messages, and the lawyer's product vocabulary.
- Stable Brazilian legal-domain values may remain unaccented Portuguese, such as `reclamante`, `polo_ativo`, and `direito_trabalhista`.
- Database identifiers use unaccented `snake_case`; TypeScript uses `PascalCase`/`camelCase`.
- API JSON uses `camelCase`; mapping to `snake_case` occurs in Prisma/database definitions.
- User-visible mappings hide technical persistence names—for example, `knowledge_chunks` becomes **Memória do escritório**.

### Consequences

#### Positive

- consistent code and vendor/library terminology;
- natural language for Brazilian users;
- less ambiguity in APIs and schemas;
- domain-specific Portuguese concepts remain recognizable.

#### Negative

- developers must maintain explicit UI/domain label mappings;
- enum codes may combine English platform states and Portuguese legal values;
- translation/i18n boundaries need discipline from the start;
- direct database terms must never leak into the UI.

### Rejected alternatives

- **Portuguese technical identifiers throughout:** increases inconsistency with ecosystem and external contracts.
- **English-only user interface:** reduces usability for the initial market.
- **Translate every Brazilian legal concept:** can distort established meaning.
- **Mix languages ad hoc:** produces unstable contracts and duplicate concepts.

### Compliance checks

- Lint/review rejects accented technical identifiers and inconsistent casing.
- API/OpenAPI reviews use English field names.
- UI tests assert required pt-BR labels for critical workflows.
- New legal codes document their intended meaning and remain stable after persistence.

---

## ADR-009: Definir o escopo do Assistente Interno

- **Status:** Superado pelo ADR-016 em 2026-08-28 — decisão original preservada abaixo
- **Data:** 2026-08-05
- **Decisores:** sócios da SAMUEL DEV LTDA
- **Trava:** componente conceitual #10, escopo da Fase 3, desdobramentos da Delivery 9
- **Idioma:** pt-BR, por ser documento de decisão para a sociedade e não documentação técnica

### Decisão (2026-08-07)

Aceita a **Opção B — resposta ancorada em fontes autorizadas**. O assistente responde perguntas sobre a base do escritório com toda afirmação carregando localizador de origem resolvível, e recusa responder quando a recuperação não devolve fonte autorizada. Não é chat aberto; histórico de conversa não é fonte.

### Contexto

A proposta conceitual lista um **Assistente Interno** como componente de arquitetura #10 e o coloca na Fase 3, descrevendo-o como a capacidade de "conversar com toda a base de conhecimento do escritório".

O `docs/product/vision.md` afirma que o LEX OS **não é** "um chatbot jurídico genérico", e o `docs/product/mvp-scope.md` prevê apenas uma fundação de busca e memória: recuperação lexical e semântica filtrada por cliente, resultados com referência de origem, e um contrato explícito de evidência insuficiente em vez de resposta sem apoio.

São produtos diferentes. Os dois documentos discordam, e nenhuma entrega do plano constrói uma superfície conversacional. A Delivery 9 constrói o substrato de recuperação sobre o qual qualquer assistente se apoiaria, então a decisão é necessária antes de a Delivery 9 ser desenhada, não depois.

A distinção que importa não é "com chat ou sem chat". É se o sistema pode produzir texto que não seja diretamente atribuível a uma fonte autorizada. É essa propriedade, e não a interface, que define o perfil de responsabilidade num contexto jurídico.

### Opções

#### A. Sem assistente — apenas recuperação

A busca devolve trechos ranqueados com citação. O advogado lê as fontes. Nenhum texto gerado.

#### B. Resposta ancorada em fontes autorizadas — _recomendada_

Uma superfície de pergunta e resposta restrita de modo que:

- a recuperação seja escopada por cliente e filtrada por permissão **antes** da geração;
- toda afirmação carregue um localizador de origem resolvível (documento, página, offset);
- a resposta seja recusada quando a recuperação não devolver nenhuma fonte autorizada de apoio;
- o modelo possa resumir e conectar trechos recuperados, mas não possa introduzir fatos ausentes deles;
- o conteúdo do documento fique estruturalmente separado das instruções, conforme o ADR-006;
- nenhuma resposta seja apresentada como parecer jurídico ou fato confirmado, e toda resposta seja marcada como gerada por máquina.

Histórico de conversa pode existir por usabilidade, mas cada resposta é reancorada; o histórico não é fonte.

#### C. Assistente conversacional pleno

Diálogo aberto com memória persistente sobre o acervo do escritório, capaz de discussão jurídica geral além do material recuperado.

### Recomendação

**Opção B.**

A opção A entrega menos do que foi apresentado aos sócios. "Conversar com a base de conhecimento" é um diferencial de destaque na proposta, e busca pura não satisfaz isso.

A opção C é exatamente a commodity que o posicionamento rejeita — a própria proposta argumenta que chat com LLM está virando commodity e que o LEX OS deve competir em outro lugar. É também a de maior exposição: geração sem ancoragem em contexto jurídico corre o risco de uma citação inventada chegar a uma peça protocolada.

A opção B preserva a promessa e o posicionamento. É também a consumidora natural do substrato da Delivery 9, em vez de um sistema à parte, e o comportamento de recusa já está especificado no `mvp-scope.md`.

### Consequências

#### Positivas

- o assistente vira uma camada de apresentação sobre recuperação que já é necessária, não arquitetura nova;
- comportamento de recusa e exigência de citação são testáveis e já estão contratados;
- o produto mantém intacto o seu argumento de diferenciação.

#### Negativas

- usuários acostumados a chatbots genéricos vão sentir as recusas como limitação, e isso precisa ser tratado no texto da interface;
- resposta ancorada ainda consome tokens de modelo de linguagem por pergunta, o que alimenta o modelo de custo do ADR-011;
- resumir vários trechos ainda pode distorcer sentido mesmo com toda frase tendo fonte, então a revisão humana continua necessária.

### Alternativas rejeitadas

- **Responder com conhecimento do modelo quando a recuperação vier vazia:** viola a promessa central do produto e é o modo de falha de maior responsabilidade.
- **Tratar o histórico de conversa como fonte:** permite que uma afirmação anterior da máquina vire evidência de uma posterior.
- **Entregar o assistente antes da Delivery 9:** não há nada autorizado onde ancorar as respostas.

### Verificações de conformidade

- Uma resposta sem localizador de origem quebra um teste em vez de chegar ao usuário.
- Fontes de outro cliente ou confidenciais nunca entram no conjunto de recuperação, inclusive em contagens e ranqueamento.
- Testes de prompt injection cobrem documentos que tentem alterar o comportamento do assistente ou revelar outros clientes.
- Toda resposta é auditável até as fontes e a versão de modelo que a produziram.
- O texto da interface nunca apresenta uma resposta como parecer jurídico.

### Necessário antes de

Iniciar o desenho da Delivery 9.

---

## ADR-010: Decidir os canais de ingestão do MVP

- **Status:** Aceito — decidido pela sociedade em 2026-08-07
- **Data:** 2026-08-05
- **Decisores:** sócios da SAMUEL DEV LTDA
- **Trava:** componente conceitual #1, e se a Fase 1 é viável como está escrita
- **Idioma:** pt-BR, por ser documento de decisão para a sociedade e não documentação técnica

### Decisão (2026-08-07)

Aceita a **Opção B — upload mais ingestão por e-mail no MVP**. WhatsApp fica registrado como conector futuro com ADR próprio quando for priorizado; pastas monitoradas são iniciativa separada. A ingestão por e-mail reusa o pipeline de entrada existente e segue as verificações de conformidade deste registro.

### Contexto

A proposta conceitual descreve uma **Central de Ingestão** recebendo documentos de WhatsApp, e-mail, upload, scanner, APIs e pastas monitoradas. É o componente #1 e o primeiro item da Fase 1.

O `docs/product/mvp-scope.md` lista "integrações de WhatsApp ou mensageria ao vivo" como explicitamente fora de escopo. O que existe hoje é apenas upload HTTP multipart, entregue na Delivery 6.

WhatsApp é o diferencial mais citado na proposta e o que tem menos análise por trás. Fatos que pesam na decisão:

- A WhatsApp Business Platform cobra por conversa, exige verificação de conta Meta Business, exige aprovação de template para mensagens iniciadas pela empresa e restringe contato iniciado pela empresa fora da janela de atendimento.
- Documentos que o cliente envia por WhatsApp transitam pela infraestrutura da Meta antes de chegar ao LEX OS. Para um escritório recebendo material privilegiado de cliente, isso é uma questão de proteção de dados, não apenas de integração. Interage com o ADR-012.
- Mídia recebida por WhatsApp chega sem o nome de arquivo, sem confiabilidade de MIME e sem as garantias de proveniência sobre as quais o pipeline de entrada atual foi construído.

"Pastas monitoradas" implica um agente instalado nas máquinas dentro do escritório: distribuição, atualização automática, assinatura de código, permissões de endpoint e suporte próprio. Isso é um segundo produto, não uma funcionalidade deste.

E-mail é diferente dos dois. Escritórios já recebem documentos por e-mail, o Mailpit já está no stack local, e o adaptador é contido: buscar, verificar o remetente contra o cliente, tratar todo anexo como entrada hostil e entregar ao pipeline de entrada que já existe.

### Opções

#### A. Somente upload no MVP

Todos os demais canais viram conectores pós-MVP. É a posição atual do `mvp-scope.md`.

#### B. Upload mais ingestão por e-mail — _recomendada_

Adicionar um adaptador autenticado de entrada por e-mail dentro do MVP. WhatsApp e pastas monitoradas viram conectores explicitamente agendados, cada um com seu próprio ADR. Entrada por scanner já é coberta pelo upload.

#### C. WhatsApp dentro do MVP como porta de entrada

Tratar mensageria como canal primário de aquisição e construí-la primeiro.

### Recomendação

**Opção B.**

A opção A deixa o componente #1 da proposta em cerca de um quinto do que foi descrito, e deixa a Fase 1 inviável como está escrita.

A opção C antecipa o canal de maior custo e maior incerteza — termos comerciais, verificação junto à Meta, economia por conversa e uma questão de proteção de dados que o ADR-012 ainda não respondeu — antes de o produto ter interface funcionando. Também constrói um canal de aquisição antes de existir algo demonstrável para onde adquirir.

A opção B fecha a maior parte da lacuna real com custo baixo, reaproveita a entrada em streaming, a quarentena, a verificação de MIME e o caminho do scanner já construídos na Delivery 6, e deixa o WhatsApp _decidido_ em vez de ambíguo. A ambiguidade é o problema atual: dois documentos discordam e nenhum é autoritativo.

Seja qual for a escolha, pastas monitoradas devem ser registradas como iniciativa de produto separada, não como um item dentro do componente #1.

### Consequências

#### Positivas

- e-mail reaproveita o caminho de entrada existente: chaves geradas, SHA-256, inspeção de assinatura MIME, quarentena e a interface de scanner que falha fechada;
- a proposta e o documento de escopo param de se contradizer;
- a análise de economia e de proteção de dados do WhatsApp acontece antes do compromisso, não durante a implementação.

#### Negativas

- entrada por e-mail traz preocupações de autenticação e falsificação de remetente que o upload não tem; um remetente não verificado nunca pode vincular documento a caso;
- polling de caixa ou entrega por webhook adiciona dependência de disponibilidade e um novo modo de falha a reconciliar;
- adiar o WhatsApp pode enfraquecer o discurso comercial se a venda estiver sendo feita em cima dele.

### Alternativas rejeitadas

- **Aceitar qualquer anexo de qualquer remetente:** transforma o pipeline de entrada em relay aberto para arquivos hostis.
- **Confiar no nome do arquivo ou no MIME declarado no e-mail:** o pipeline atual já rejeita isso para uploads; e-mail não é exceção.
- **Vincular uma mensagem a um caso lendo o assunto sem autorização:** permite que alguém de fora escreva dentro de um cliente.

### Verificações de conformidade

- Um e-mail de remetente não reconhecido não pode criar nem alterar dado de cliente algum.
- Anexos seguem o mesmo caminho de tamanho, quantidade, tipo, assinatura, quarentena e scanner que os uploads.
- A mensagem de origem é retida como proveniência de cada documento que ela gerou.
- Nenhum conteúdo de corpo de mensagem é registrado em log.
- Entrega cruzada entre clientes é impossível: o vínculo caixa-postal/cliente é do lado do servidor e nunca derivado do conteúdo da mensagem.

### Necessário antes de

Qualquer trabalho no componente conceitual #1 além de upload, e antes de a Fase 1 da proposta ser declarada iniciada.

---

## ADR-011: Estabelecer o modelo de custo de processamento e a escolha de provedores

- **Status:** Aceito — decidido pela sociedade em 2026-08-07
- **Data:** 2026-08-05
- **Decisores:** sócios da SAMUEL DEV LTDA
- **Trava:** componentes conceituais #4 e #5 saírem do estado de mock; formação de preço
- **Idioma:** pt-BR, por ser documento de decisão para a sociedade e não documentação técnica

### Decisão (2026-08-07)

Aceita a **Opção C — assinatura por usuário com franquia de processamento inclusa e medição do excedente**, com **teto rígido de custo por caso aplicado no pipeline**: ao atingir o teto, o processamento para e o caso vai para revisão humana com estado visível. Nenhum provedor real entra antes de o registro de custo por execução e o teto existirem.

### Contexto

A proposta conceitual promete um agente que "recebe centenas de arquivos e devolve um dossiê jurídico organizado". Cada arquivo pode exigir OCR, às vezes transcrição, depois classificação, extração de entidades e geração de embeddings. Processamento é, portanto, o custo variável dominante do produto, e ele escala com o volume de documentos do cliente, não com o número de pessoas do escritório.

Nenhum número de custo aparece em lugar algum da proposta, e nenhuma unidade de cobrança foi escolhida.

O `docs/product/vision.md` já exige instrumentar "custo de processamento por provedor, modelo, caso e organização". A instrumentação está especificada; o modelo que ela deveria alimentar, não. O ADR-006 mantém todo provedor atrás de uma porta substituível, então esta é uma decisão comercial e não arquitetural — a arquitetura é deliberadamente indiferente a qual fornecedor vence.

Duas consequências tornam isso urgente em vez de adiável:

1. Substituir qualquer mock por um provedor real começa a gastar dinheiro por documento. Enquanto não existir um teto, um único cliente subindo um caso atípico produz uma conta ilimitada.
2. Enviar conteúdo de documento a um provedor terceiro torna esse provedor **suboperador** dos dados dos clientes do escritório. A escolha de provedor fica, portanto, acoplada ao ADR-012 e não pode ser feita apenas por preço.

### Decisões necessárias

1. **Unidade de cobrança.** Pelo que o cliente é faturado.
2. **Teto de custo por caso.** O máximo que o pipeline pode gastar antes de parar e chamar um humano.
3. **Provedor inicial por capacidade.** OCR, transcrição, classificação, extração de entidades, embeddings, modelo de linguagem.
4. **Comportamento no teto.** O que o produto faz quando um caso estoura o orçamento.
5. **Termos de tratamento de dados.** Se o provedor candidato permite contratualmente tratar dados pessoais e jurídicos brasileiros, e se ele treina com o conteúdo enviado.

### Opções de unidade de cobrança

#### A. Por usuário

Simples e com receita previsível. Desacopla preço de custo por completo: um escritório com volume alto de documentos e o mesmo número de usuários fica deficitário, e quem extrai mais valor paga menos.

#### B. Por caso preparado

Alinha receita a custo e à unidade de valor que o produto realmente entrega — "Preparar processo" é a experiência central. Mais difícil de projetar, e penaliza justamente o comportamento que o produto quer estimular.

#### C. Base por usuário mais medição acima de uma franquia inclusa — _recomendada_

Uma base previsível, no formato em que escritórios já compram software, com o componente variável ligado ao custo variável. A franquia é dimensionada para que o uso comum nunca chegue a ser medido.

### Recomendação

**Opção C para cobrança, mais um teto rígido de processamento por caso aplicado dentro do pipeline.**

O teto importa tanto quanto a unidade de cobrança. O `ProcessingJob` já registra provedor, modelo, duração e confiança por execução; estendê-lo para registrar custo e recusar continuar além de um limite configurado é uma mudança contida. Sem isso, o modo de falha é gasto silencioso descoberto na fatura.

Ao atingir o teto, o pipeline deve parar e levar o caso para revisão humana, em vez de continuar gastando ou falhar o caso inteiro. Um dossiê parcialmente preparado com um estado explícito de "orçamento atingido" é mais útil que qualquer das duas alternativas, e encaixa no estado `NEEDS_REVIEW` que já existe.

A escolha de provedor deve ser feita por capacidade, não por fornecedor. Qualidade de OCR em documento jurídico digitalizado brasileiro, qualidade de transcrição em português do Brasil e custo de embedding são perguntas independentes, com vencedores diferentes.

### Consequências

#### Positivas

- custo vira propriedade mensurável e de primeira classe do processamento, em vez de surpresa na fatura;
- a escolha por capacidade preserva o benefício do ADR-006 em vez de colapsar em dependência de fornecedor único;
- um teto aplicado converte um risco financeiro ilimitado em um estado de produto delimitado.

#### Negativas

- cobrança medida exige contabilização de uso, faturamento e tratamento de contestação, que o MVP não tem e que o `mvp-scope.md` hoje exclui;
- um teto por caso pode interromper um caso legitimamente grande e precisa de um caminho de liberação autorizada;
- registrar custo por execução acrescenta mais um campo a uma tabela que já é append-only e de volume alto.

### Alternativas rejeitadas

- **Escolher o provedor mais barato por capacidade olhando só o preço:** ignora as questões de suboperador e de treinamento com o conteúdo, tratadas no ADR-012, que podem desqualificar um fornecedor independentemente do preço.
- **Adiar o teto até o primeiro provedor real entrar:** o teto é justamente o controle que torna seguro colocar um provedor real; não é tarefa posterior.
- **Estimar custo apenas pela quantidade de documentos:** número de páginas, qualidade da digitalização e duração de áudio dominam; um PDF nativo de dez páginas e uma gravação de duas horas não são unidades comparáveis.
- **Absorver o custo de processamento num preço fixo sem medição:** não é possível precificar o produto sem saber quanto custa um caso.

### Verificações de conformidade

- Toda execução de provedor registra provedor, modelo, versão do modelo e custo.
- Um caso não pode ultrapassar seu orçamento configurado sem liberação explícita e autorizada, e a liberação é auditada.
- Os valores de custo são consultáveis por organização, caso, provedor e modelo.
- Nenhum provedor entra em produção sem termos de tratamento de dados registrados.
- Casos interrompidos por orçamento chegam a um estado visível e recuperável, nunca a uma falha silenciosa.

### Necessário antes de

Substituir qualquer mock por provedor real, e antes de qualquer preço ser apresentado a um cliente.

---

## ADR-012: Estabelecer retenção, legal hold e a postura de LGPD

- **Status:** Aceito — decidido pela sociedade em 2026-08-07
- **Data:** 2026-08-05
- **Decisores:** sócios da SAMUEL DEV LTDA
- **Trava:** entrada de dado real em produção; todo contrato comercial com escritório
- **Idioma:** pt-BR, por ser documento de decisão para a sociedade e não documentação técnica

### Decisão (2026-08-07)

Aceito o **padrão conservador integral**: preservar por padrão, nenhum expurgo automático, legal hold em nível de caso falhando fechado, exclusão lógica como única exclusão do MVP, região única sem cópias fora dela, lista de suboperadores publicada antes do primeiro provedor real, e nenhum fornecedor que treine com conteúdo enviado, a qualquer preço. Nenhuma alegação de conformidade LGPD antes de os procedimentos existirem.

### Contexto

O `README.md` lista retenção de objetos em produção, legal hold, backup e restauração, e expurgo irreversível como bloqueadores de governança. O `docs/product/mvp-scope.md` se recusa a alegar conformidade com a LGPD antes de essas políticas existirem. A proposta conceitual não menciona proteção de dados em momento algum.

Esse silêncio é um problema comercial antes de ser técnico. O encarregado de dados de um escritório vai pedir contrato de tratamento de dados, base legal por categoria, lista de suboperadores, tabela de retenção e procedimento de exclusão antes de assinar. Nenhum desses documentos existe.

Três características tornam isso mais difícil que proteção de dados de SaaS comum:

1. **O escritório trata dados de pessoas que não são clientes dele.** Partes contrárias, testemunhas e terceiros aparecem nos documentos do caso e nunca consentiram com nada. Um pedido de exclusão vindo de uma parte contrária não pode ser simplesmente atendido — o escritório detém o material para exercer ou defender direito em processo —, mas o pedido ainda precisa ser respondido corretamente.
2. **Documentos são prova.** Apagar um arquivo pode destruir algo de que um processo depende. Retenção aqui não é questão de custo de armazenamento.
3. **Todo provedor de IA é suboperador.** No momento em que conteúdo de documento é enviado a um fornecedor de OCR, transcrição ou modelo de linguagem, esse fornecedor trata dados pessoais dos clientes do escritório. Isso precisa ser divulgado, coberto em contrato e mantido atualizado. Acopla diretamente ao ADR-011: um fornecedor que treina com o conteúdo enviado não é selecionável a preço nenhum.

O sistema já faz as coisas certas estruturalmente — exclusão lógica, auditoria append-only, originais imutáveis, reconciliação que reporta em vez de apagar. O que falta é a política que diz a esses mecanismos quando agir.

### Decisões necessárias

1. **Base legal** por categoria de dado — dados de cliente, de parte contrária, de terceiro e de usuário do escritório.
2. **Tabela de retenção**, e se alguma exclusão chega a ser automática.
3. **Mecanismo de legal hold** — como um caso é marcado de modo que nada dentro dele possa ser expurgado por ninguém, inclusive por administrador.
4. **Procedimento de atendimento a titular**, incluindo a resposta quando o titular é a parte contrária.
5. **Divulgação de suboperadores** — lista pública e versionada, e o processo de notificação quando ela mudar.
6. **Residência dos dados** — uma região documentada, e se cópias em outra região são permitidas em algum ponto, inclusive backups.
7. **Encerramento** — o que acontece com os dados de um escritório quando ele deixa de ser cliente, e como são exportados.

### Padrão conservador recomendado

Adotar a posição mais restritiva que ainda seja operável, e afrouxar depois com evidência:

- **Preservar por padrão. Nenhum expurgo automático, de espécie alguma.** Exclusão é sempre ação explícita, autorizada e auditada.
- **Legal hold é uma marca no caso que bloqueia todo caminho de exclusão**, inclusive administrativos e inclusive a ferramenta de reconciliação. Falha fechada: se o estado de hold não puder ser determinado, a exclusão é recusada.
- **Exclusão lógica é a única exclusão no MVP.** Expurgo irreversível é capacidade separada, posterior e deliberadamente construída, com revisão própria.
- **Uma região documentada. Nenhuma cópia em outra região, inclusive backups.**
- **A lista de suboperadores é publicada e versionada antes de o primeiro provedor real ser ligado**, não depois.
- **Nenhum fornecedor que treine com o conteúdo enviado é elegível**, independentemente do preço. Isso restringe o ADR-011.
- **Não fazer nenhuma alegação de conformidade com a LGPD em material de marketing ou comercial** enquanto não existirem tabela de retenção, procedimento de exclusão, registro de base legal e contrato de tratamento. O `mvp-scope.md` já proíbe isso; precisa valer também fora dos documentos de engenharia.

### Consequências

#### Positivas

- o padrão conservador não consegue destruir prova, que é a falha impossível de desfazer;
- legal hold que falha fechado é coerente com a postura já adotada para verificação de vírus e isolamento entre clientes;
- ter a lista de suboperadores e o contrato de tratamento prontos remove o bloqueio mais comum numa contratação por escritório.

#### Negativas

- preservar tudo faz o custo de armazenamento crescer sem limite e adia a conversa real de retenção em vez de resolvê-la;
- "nenhum expurgo automático" é, ele próprio, uma posição que um encarregado pode contestar, já que retenção indefinida exige justificativa sob a LGPD;
- excluir fornecedores que treinam com o conteúdo enviado estreita o campo e pode elevar o custo unitário;
- região única sem cópia de backup em outra região reduz opções de recuperação de desastre e exige aceite explícito de risco.

### Alternativas rejeitadas

- **Adiar tudo isso até um cliente perguntar:** a primeira conversa comercial é exatamente quando se pergunta, e chegar sem resposta custa o contrato.
- **Exclusão automática por tempo de retenção no MVP:** a operação irreversível de maior consequência, construída antes da política que a governa.
- **Tratar provedores de IA como ferramentas e não como suboperadores:** juridicamente errado, e é o tipo de erro que aparece em auditoria.
- **Atender automaticamente pedidos de exclusão de parte contrária:** destruiria material que o escritório detém para exercer ou defender direito em processo.
- **Alegar conformidade com a LGPD porque o sistema tem log de auditoria e criptografia:** conformidade é um conjunto documentado de procedimentos, não uma lista de funcionalidades.

### Verificações de conformidade

- Nenhum caminho de exclusão consegue remover dado de um caso sob legal hold, e a verificação falha fechada.
- Toda exclusão, exportação e mudança de hold é auditada com autor e horário.
- A lista de suboperadores é versionada no repositório e corresponde aos provedores efetivamente ligados.
- Backups não saem da região documentada.
- Nenhum documento comercial ou de marketing afirma conformidade com a LGPD sem os procedimentos por trás.
- O atendimento a titular é um procedimento documentado com responsável nomeado, não uma tarefa avulsa de engenharia.

### Necessário antes de

Qualquer dado real de cliente entrar no sistema, qualquer provedor de IA real ser ligado, e qualquer contrato comercial ser assinado.

---

## ADR-013: Notificações internas por e-mail

- **Status:** Aceito — decidido pela sociedade em 2026-08-07
- **Data:** 2026-08-07
- **Decisores:** sócios da SAMUEL DEV LTDA
- **Trava:** adapter de e-mail e qualquer aviso automático ao escritório
- **Idioma:** pt-BR, por ser documento de decisão para a sociedade e não documentação técnica

### Decisão (2026-08-07)

Aceita a **recomendação integral**: conteúdo mínimo sempre (código do caso, tipo do acontecimento, link — nada além), três gatilhos da primeira fase só para o responsável/atribuído, imediato para falha e tarefa com resumo diário para conclusões, opt-out por gatilho exceto falha, envio pelo worker com auditoria sem corpo, e provedor SMTP de produção somente com termos registrados.

### Contexto

O escritório só descobre que um preparo terminou, que um documento falhou ou que uma tarefa
foi atribuída se alguém abrir a tela. Para o advogado responsável, isso significa voltar ao
sistema "para ver se tem novidade" — exatamente o tipo de atrito operacional que o produto
promete eliminar.

A fundação já existe e foi verificada no código: o `AGENTS.md` previu adapter de e-mail
desde o início; o Mailpit já roda no Compose local; o worker é o lugar certo para enviar
(nenhum trabalho pesado em handler HTTP); `Task.assignedToId` e `User.email` já estão no
banco, então o destinatário se resolve no servidor **sem depender da rota de usuários que
ainda não existe**. Os três gatilhos têm ponto de encaixe exato: conclusão do preparo,
falha terminal de documento e criação de tarefa atribuída.

O que não existe é política. E o `mvp-scope.md` é silencioso sobre notificações, o que
pela regra da casa transforma a adição de escopo em decisão da sociedade.

Duas restrições não são negociáveis:

1. **E-mail é canal de saída.** O que sai do sistema deixa de estar protegido por ele.
2. **O provedor SMTP de produção vira suboperador** dos dados que transitarem no e-mail —
   acopla esta decisão ao ADR-012.

### Decisões necessárias

1. **Política de conteúdo.** O que um e-mail pode carregar.
2. **Gatilhos da primeira fase.** Quais eventos notificam, e quem.
3. **Cadência.** Imediato por evento, ou resumo agrupado.
4. **Opt-out.** Se o advogado pode silenciar, e o quê.
5. **Provedor SMTP de produção.** Com termos de tratamento de dados registrados.

### Recomendação

**Conteúdo mínimo, sempre.** O e-mail carrega apenas: código interno do caso, o tipo do
acontecimento em linguagem do usuário ("preparação concluída", "documento falhou",
"tarefa atribuída a você") e um link para a tela. **Nunca** título de documento, teor de
texto extraído, nome de parte, CPF/CNPJ ou mensagem de erro técnica. Quem clica no link
autentica e vê o resto dentro do sistema, onde tenant, permissão e confidencialidade
continuam valendo. Um e-mail interceptado revela que o caso X teve movimento — e nada mais.

**Primeira fase: os três gatilhos, só para o responsável.** Preparo concluído e documento
falhado vão ao responsável do caso; tarefa atribuída vai ao atribuído. Ninguém mais.
Caso confidencial não altera a regra porque o conteúdo mínimo já não revela nada — mas o
link exige a permissão de sempre.

**Imediato para falha e tarefa; resumo diário para conclusões.** Falha e atribuição pedem
ação; conclusão de preparo em lote viraria ruído se cada documento disparasse um e-mail.

**Opt-out por gatilho, exceto falha.** Falha de documento é o único aviso que não se
silencia: ignorá-la custa prazo processual.

**Envio pelo worker, com registro auditável.** O envio é um job como qualquer outro:
persistido, com retry limitado, e auditado (`SYSTEM` como ator) sem gravar o conteúdo —
apenas gatilho, destinatário e resultado.

### Consequências

#### Positivas

- o padrão de conteúdo mínimo elimina a maior parte do risco LGPD do canal;
- a infraestrutura reaproveita o que existe: adapter previsto, worker, Mailpit no local;
- auditoria de envio dá resposta à pergunta "por que ninguém foi avisado?".

#### Negativas

- e-mail de conteúdo mínimo obriga um clique a mais para ver o que houve;
- resumo diário atrasa a notícia boa (preparo pronto) em até um dia útil;
- provedor SMTP entra na lista de suboperadores e na diligência do ADR-012;
- caixa de entrada lotada é risco real: sem disciplina nos gatilhos, o escritório
  aprende a ignorar os avisos e o canal morre.

### Alternativas rejeitadas

- **Conteúdo rico no e-mail (título do documento, resumo do caso):** conveniente e
  indefensável no primeiro vazamento de caixa de entrada.
- **Notificar o cliente final:** fase futura explícita do pedido original; canal externo
  exige base legal própria e não entra antes do ADR-012 decidido.
- **WhatsApp como canal:** é o ADR-010, não este. Misturar as decisões atrasa as duas.
- **Enviar do handler HTTP:** viola a regra de nada pesado no request e perde retry.
- **Sem opt-out:** transforma o canal em spam institucional; a exceção única (falha) é
  deliberada e justificada por prazo.

### Verificações de conformidade

- Nenhum e-mail contém teor de documento, nome de parte, identificador pessoal ou stack
  técnico; um teste automatizado valida os templates contra a lista proibida.
- Todo envio gera registro de auditoria com ator `SYSTEM`, gatilho e destinatário — sem corpo.
- O adapter de e-mail vive em infraestrutura, atrás de contrato, como os demais.
- Falha de envio não derruba o job de negócio que a disparou.
- O provedor de produção só entra com termos de tratamento registrados (ADR-012).

### Necessário antes de

Qualquer código de envio de e-mail além do adapter local de desenvolvimento.

---

## ADR-014: Fronteira de identidade e acesso

- **Status:** Aceito — decidido pela sociedade em 2026-08-20
- **Data:** 2026-08-20
- **Decisores:** sócios da SAMUEL DEV LTDA
- **Trava:** o que um escritório consegue fazer sozinho com as próprias pessoas
- **Idioma:** pt-BR, por ser documento de decisão para a sociedade e não documentação técnica

### Decisão (2026-08-20)

Aceita a **recomendação integral**, com uma resolução para cada uma das oito pendências. A
ordem abaixo é a ordem de execução, e ela importa: os dois primeiros itens são os únicos que
hoje transferem risco para fora do sistema.

| #   | Decisão                                                           | Condição inegociável                                                           |
| --- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1   | Recuperação de senha pelo adapter de e-mail do ADR-013            | Mesmo mecanismo do convite: token de uso único, guardado em hash, com validade |
| 2   | Entrega do convite pelo mesmo adapter                             | Até existir, a tela declara que o link viaja fora do sistema                   |
| 3   | Segundo fator com TOTP próprio                                    | Opcional por pessoa, exigível por escritório; nunca dependente de fornecedor   |
| 4   | Entrada federada por OIDC, quando houver a primeira banca com IdP | O papel continua vindo do nosso `UserRole`, nunca de grupo do provedor         |
| 5   | Autocadastro de escritório recusado no horizonte atual            | Reavaliar apenas se houver teste gratuito ou autoatendimento                   |
| 6   | O nome curto muda, com o antigo redirecionando                    | O nome antigo **nunca** é reatribuído a outro escritório                       |
| 7   | Pessoa em dois escritórios recusada conscientemente               | São dois acessos distintos; reavaliar só com demanda real de cliente           |
| 8   | O sistema recusa remover o último acesso administrativo ativo     | Sem procedimento manual de socorro: desbloqueio por fora é onde vaza acesso    |

**Prioridade de execução.** O item 1 e o item 2 são o mesmo trabalho — o adapter de e-mail —
e vêm primeiro. O item 3 vem em seguida, por ser o primeiro que aparece em due diligence de
segurança. O item 4 espera a primeira banca grande no funil. Os itens 5, 6 e 7 não têm custo
em esperar. O item 8 **não precisou de código** — ver abaixo.

**Sobre o item 3.** Delegar o segundo fator ao provedor de identidade foi descartado como
alternativa, não adiado: nem todo escritório terá IdP, e um segundo fator que só existe para
parte dos clientes não é um controle de segurança, é uma exceção a explicar em cada venda.

**Sobre o item 6.** A opção de trocar o nome quebrando os links antigos foi recusada: um
link de convite morto vira chamado, e um endereço de entrada que deixou de funcionar parece
falha do produto. A opção de liberar o nome antigo depois de um prazo também foi recusada —
reatribuir a outro escritório um nome que já circulou é sequestro de identidade servido de
bandeja.

**Sobre o item 8.** A alternativa de exigir sempre dois administrativos ativos foi recusada
por ser incompatível com escritório pequeno, que é boa parte do funil. A alternativa de
socorro manual pelo suporte foi recusada por criar um caminho de concessão de acesso fora do
sistema, sem auditoria e sem permissão — exatamente o que o produto promete não ter.

Ao implementar a guarda, ela se revelou **inalcançável**, e a regra que já existe basta. A
prova é curta: para chamar as rotas que removem acesso é preciso `users.manage`, e o guard só
deixa passar quem está ativo — logo quem chama já é um administrador ativo. Alterar o próprio
acesso é recusado antes de tudo. Então, sempre que alguém remove o acesso de outra pessoa,
quem removeu continua administrando. O invariante se sustenta na regra de não mexer no
próprio acesso, não em uma contagem.

Escrever a contagem e descobrir que ela nunca dispara valeu mais que escrevê-la: código morto
com teste ao lado dá a impressão de proteção onde só há repetição.

**Condição para quem mexer nisto depois.** Duas mudanças quebrariam o invariante e precisam
recriá-lo explicitamente: exclusão lógica de pessoa, e qualquer processo automático que
bloqueie usuário sem um ator humano por trás. Nenhum dos dois existe hoje.

### Por que este registro existe

A Entrega 12 dá ao escritório o mínimo para operar as próprias pessoas: entrar por um nome
legível, convidar, atribuir papel, bloquear. Para caber num incremento revisável, ela deixa
**oito coisas na mesa**. Nenhuma é esquecimento; cada uma é uma escolha com consequência.

Este registro existe para que elas parem de ser invisíveis. Lacuna que ninguém escreveu vira
descoberta em reunião com cliente.

### O que a Entrega 12 resolve

Vale separar, porque duas dessas pareciam pendência e não são.

**Bloqueio e troca de papel valem na requisição seguinte.** O guard de acesso reconsulta
status, exclusão, papéis e permissões no banco a cada chamada — ele não confia no que está
escrito no token. Bloquear alguém não deixa uma janela aberta até o token expirar. A revogação
das sessões de atualização, feita na mesma transação do bloqueio, fecha também o caminho de
renovação.

**Escritório inexistente não se distingue de senha errada.** Trocar o UUID por um nome legível
tornou o identificador adivinhável, e as três defesas estão descritas no
[API de autenticação](../api/authentication.md).

### As oito pendências

Cada uma traz o que destrava — e o custo de deixar como está.

#### 1. Quem esquece a senha não tem caminho

Hoje só um administrador consegue resolver, refazendo o convite. Numa banca com quarenta
advogados isso vira chamado semanal para o sócio que tiver o acesso.

**Destrava com:** o adapter de e-mail do [ADR-013](#adr-013-notificações-internas-por-e-mail). A
recuperação é o mesmo mecanismo do convite — token de uso único, com validade, guardado em
hash — apontando para uma pessoa que já está ativa. O que falta é o canal, não a mecânica.

#### 2. O convite viaja fora do sistema

Sem adapter de e-mail, a rota de convite devolve o token **uma única vez**, na resposta, para
o administrador entregar à pessoa por um canal que ele escolhe. O token nunca é registrado em
log nem em auditoria, e não há segunda chance de lê-lo: quem perder, revoga e convida de novo.

É honesto e funciona, mas transfere a segurança do elo final para o hábito de quem opera. Um
token colado em grupo de mensagens é um acesso ao acervo do escritório.

**Destrava com:** o mesmo adapter do item 1. Enquanto isso, a tela precisa dizer isso com todas
as letras a quem copia o link.

#### 3. Não há segundo fator

Um acervo jurídico inteiro protegido por uma senha. Para o público que o produto persegue —
bancas estabelecidas, com dado sensível de cliente — isso aparece na primeira due diligence de
segurança.

**Destrava com:** decisão da sociedade sobre TOTP próprio ou delegar a um provedor de
identidade (item 4). São caminhos diferentes e escolher um descarta o outro por um bom tempo.

#### 4. Não há entrada federada

Bancas grandes usam Microsoft 365 ou Google Workspace e vão pedir para entrar com a conta
corporativa. É requisito de compra, não conforto.

**Destrava com:** decisão da sociedade. Tem peso comercial e arquitetural: uma pessoa passa a
existir no provedor de identidade, e o papel dela pode vir de um grupo de lá em vez do nosso
`UserRole`.

#### 5. O escritório não se cadastra sozinho

Criar uma organização é operação interna nossa. Para venda assistida está correto e evita o
tenant-lixo criado por curiosidade. Vira gargalo no dia em que houver autoatendimento ou teste
gratuito.

**Destrava com:** decisão comercial, não técnica.

#### 6. O nome curto do escritório não muda

O `slug` é imutável por escolha: ele circula em link de convite e entra no hábito de quem digita
todo dia. Um escritório que se renomeia — fusão, saída de sócio — fica com o nome antigo na
tela de entrada.

**Destrava com:** decidir entre nunca mudar, mudar com o antigo redirecionando por um prazo, ou
mudar quebrando os links. A intermediária exige guardar o histórico de nomes e é a única que não
machuca ninguém.

#### 7. Uma pessoa só existe em um escritório

O modelo permite o mesmo e-mail em organizações diferentes, mas seriam duas pessoas distintas,
com senhas distintas. O advogado que atua em duas bancas mantém dois acessos.

**Destrava com:** decisão de produto. É raro no público-alvo e o custo de suportar é alto:
atravessa sessão, auditoria e todo o isolamento por tenant. Registrado para ser recusado
conscientemente, não por omissão.

#### 8. O último administrador pode se trancar do lado de fora

Sem regra, alguém remove o próprio papel administrativo e o escritório fica sem ninguém que
possa convidar ou atribuir. A Entrega 12 impede isso: uma pessoa não remove o próprio último
acesso administrativo. Fica em aberto o caso mais feio — o **único** administrador que é
bloqueado ou desligado por outra via.

**Destrava com:** decisão sobre quem socorre. As opções são exigir sempre dois administrativos
ativos, ou aceitar que o desbloqueio seja procedimento nosso de suporte, com registro.

### O que sustentava a recomendação

Em ordem, e a ordem importa:

1. **Adapter de e-mail** ([ADR-013](#adr-013-notificações-internas-por-e-mail)) — resolve os itens 1 e
   2 de uma vez e é o único que hoje transfere risco para fora do sistema.
2. **Segundo fator** (item 3) — o primeiro que aparece em due diligence.
3. **Entrada federada** (item 4) — quando houver a primeira banca grande no funil.

Os itens 5, 6 e 7 podem esperar sem custo. O item 8 precisa de uma frase de decisão, não de
código.

### Consequências de não ter decidido, registradas para memória

Os itens 1 e 2 seguem operando: convite por link entregue à mão e senha esquecida resolvida por
administrador. Funciona em escritório pequeno e degrada com o tamanho do cliente — exatamente ao
contrário do que a estratégia comercial persegue.

Nenhum destes itens bloqueia dado real de cliente. Esse bloqueio continua sendo do
[ADR-012](#adr-012-estabelecer-retenção-legal-hold-e-a-postura-de-lgpd).

---

## ADR-015: Biblioteca de prompts e pesquisa por agentes

- **Status:** Aceito — decidido pela sociedade em 2026-08-26
- **Data:** 2026-08-26
- **Decisores:** sócios da SAMUEL DEV LTDA
- **Trava:** nenhum texto de processo sai; nenhum provedor real entra
- **Idioma:** pt-BR, por ser documento de decisão para a sociedade e não documentação técnica
- **Acopla:** ADR-001 (raízes de composição), ADR-006 (portas de provedor), ADR-009 (resposta
  fundamentada), ADR-011 (custo antes do provedor), ADR-012 (suboperadores)

### Decisão (2026-08-26)

Sete decisões. As duas primeiras são as que mudam como se trabalha daqui em diante; as cinco
seguintes existem porque três revisões adversariais mostraram que sem elas a primeira não vale.

| #   | Decisão                                                                | Condição inegociável                                                        |
| --- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1   | O prompt é artefato de código, versionado no monorepo                  | Nunca em tabela de banco, nunca em serviço próprio, nunca em SaaS de prompt |
| 2   | Agentes pesquisam; advogado revisa. O prompt nasce `DRAFT`             | Promoção a `REVIEWED` exige nome, OAB e data de quem revisou                |
| 3   | **O contrato de saída faz parte do prompt**                            | Prompt que não consegue dizer o que viu é prompt defeituoso                 |
| 4   | A guarda de rascunho depende do dado ser real, não do ambiente         | `NODE_ENV` é rótulo de processo, não medida de risco                        |
| 5   | O catálogo de especialidades normaliza apelidos sem fechar `legalArea` | Caso existente com área fora do catálogo continua funcionando               |
| 6   | Toda alteração de prompt passa por revisão adversarial por lentes      | Mínimo três lentes: parecer sênior, alucinação, prática                     |
| 7   | Nenhum provedor real antes dos portões do ADR-011 e do ADR-012         | Reafirmação, não decisão nova                                               |

**Prioridade de execução.** O item 3 vem primeiro e já foi parcialmente executado — é o único
que hoje limita todos os outros. O item 4 vem em seguida, por ser o que separa "rascunho não
encosta em caso real" de uma frase de efeito. O item 2 depende de existir um advogado revisor
nomeado, o que é decisão de pessoa, não de código. Os itens 1, 5, 6 e 7 já estão em vigor.

### Contexto

Até 2026-08-25 o repositório tinha três `PromptSpecification` com identificador, versão,
schemas e critérios — **e nenhum texto de prompt**. O único campo que o código de produção lia
era `.version`, usado para carimbar procedência. E `legalArea` era `VarChar(120)` livre, com
divergência já solta: o seed gravava `TRABALHISTA`, os testes do front usavam
`DIREITO_TRABALHISTA`, e nada impedia.

A Entrega 16 foi autorizada para resolver isso: escrever a biblioteca de verdade, organizada
por especialidade e tarefa, alimentando as portas de provedor que já existem.

O que produziu **este** registro não foi a escrita, foi o que veio depois dela. Três revisões
adversariais correram sobre os vinte prompts escritos, e o resultado inverteu a premissa de
trabalho: o texto estava melhor que a tubulação.

### Por que este registro existe

Um ADR se justifica quando a decisão é cara de reverter e não se deduz do código. Aqui há
quatro coisas assim, e nenhuma delas estava escrita em lugar nenhum.

#### 1. O contrato de saída faz parte do prompt

Esta é a decisão que a rodada arrancou, e ela contraria o instinto.

O prompt de checklist era o mais bem escrito dos cinco — e o que menos decidia. O banco tem
oito estados; a saída aceitava dois. Ilegível, inválido e vencido saíam todos como "não
atendido", que na tela do advogado se lê **"não recebemos"**. Ele pedia o documento ao cliente,
o cliente reenviava o mesmo scan ruim, e o ciclo repetia até a véspera do prazo. O próprio
texto do prompt declarava querer "o pedido ao cliente ser de novo escaneamento e não de novo
documento" — contra um canal que tornava a distinção impossível de transmitir.

O mesmo padrão apareceu três vezes mais: o validador exigia precisão de data em dia enquanto o
prompt mandava respeitar a precisão escrita, forçando data inventada; o catálogo tinha 21
códigos genéricos enquanto a classificação ensinava a distinguir pares cujos códigos não
existiam — o exemplo do próprio prompt usava `MATRICULA`, que não era semeado; e o teto de três
citações por afirmação obrigava a descartar fonte numa pergunta apoiada em 24 recibos.

**A regra que fica:** ao revisar um prompt, o revisor lê o contrato de saída junto. Um prompt
que instrui a observar o que a saída não comporta não é um prompt bom com uma limitação — é um
prompt defeituoso, e a correção é no contrato.

A alternativa — tratar contrato e texto como camadas separadas, cada uma com seu dono — foi
recusada porque foi exatamente ela que produziu os quatro defeitos: cada camada estava correta
sozinha.

#### 2. A guarda de rascunho protege o dado, não o ambiente

`assertUsableIn` recusa prompt `DRAFT` quando `NODE_ENV === 'production'`. Parece
fail-closed e não é: o risco nunca foi o nome do processo, foi o acervo ser de cliente. Uma
homologação com material real passa pela guarda inteira sem tocá-la.

A alternativa de manter o critério por ambiente e "cuidar para não subir dado real em
homologação" foi recusada: é procedimento humano onde cabe invariante de código, e o produto
inteiro se vende dizendo o contrário.

**Implementado em 2026-08-26** pela configuração `CASE_ARCHIVE`, que não tem valor padrão:
uma instalação que não a declara não sobe. Estado de execução em
[`docs/product/ordem-de-execucao.md`](../product/ordem-de-execucao.md).

#### 3. `REVIEWED` precisa significar uma coisa só

Hoje é um literal de união. Não registra quem revisou, com qual inscrição, em que data, nem
contra qual versão do texto. Qualquer pessoa promove qualquer prompt trocando uma palavra.

Isso não é higiene de processo: os cinco prompts genéricos estão marcados `REVIEWED` **por
decisão do dono**, e os quinze de especialidade nascem `DRAFT` porque vieram de pesquisa
automatizada. Se a marca não carrega quem assinou, as duas origens ficam indistinguíveis no
dia em que alguém precisar responder por uma delas.

A alternativa de confiar na revisão de código do Git foi recusada: o histórico diz quem
alterou o arquivo, não quem se responsabilizou pelo conteúdo jurídico.

#### 4. Revisão adversarial por lentes é o controle de qualidade, e ele se pagou

Não é preferência de método. Na faixa trabalhista, a lente de alucinação encontrou **três
citações fabricadas** — a pior delas tratando aborto como marco inicial de estabilidade da
gestante. A lente de prática encontrou três regressões em que a versão de especialidade tinha
perdido regras que os genéricos já tinham. O parecer sênior encontrou cinco erros de direito
que eu havia escrito com confiança.

Nenhum desses erros seria pego por teste automatizado, por revisão de código ou por leitura
casual. Todos foram pegos por alguém instruído a procurar aquele tipo específico de defeito.

**Mínimo de três lentes por faixa:** parecer sênior (o texto está juridicamente correto?),
alucinação (cada número de artigo, súmula e tema confere?) e prática (isto descreve o acervo
como ele chega, ou como ele deveria chegar?).

**Custo.** O dono sinalizou em 2026-08-25 que o consumo de agentes estava alto demais. A
resposta não é abandonar as lentes — é rodá-las sobre o texto final, uma vez, em vez de sobre
cada rascunho intermediário. Foi o que se fez nesta rodada.

### Alternativas recusadas

**Serviço próprio de IA na Railway.** O ADR-001 fixa duas raízes de composição de backend e
exige ADR novo para extrair uma terceira. Um `apps/ai-gateway` custaria esse ADR revertido,
nove arquivos novos, mudanças em Dockerfile, Compose e CI, e herdaria a exigência das cerca de
quarenta chaves de configuração — sem entregar nenhuma capacidade que a porta
`GROUNDED_LANGUAGE_MODEL_PROVIDER` já não ofereça. Recusado.

**Prompt em tabela de banco, editável pela interface.** Atraente para quem quer ajustar sem
deploy, e incompatível com o resto: procedência exige versão imutável carimbada em cada
extração, e prompt editável em produção sem revisão contradiz frontalmente a decisão 2.
Recusado.

**Fechar `legalArea` num enum.** Casos existentes usam valores que um catálogo fechado
invalidaria. O catálogo normaliza apelidos conhecidos — `DIREITO_TRABALHISTA` para
`TRABALHISTA` — e serve para selecionar prompt; o campo continua livre. Recusado fechar.

**Trocar os validadores escritos à mão por um validador de JSON Schema.** Os parsers do worker
são fail-closed e têm teste. Em vez de substituí-los em caminho de produção, um teste de
deriva compara cada `outputSchema` com o que o parser aceita. Foi esse teste que pegou o
`datePrecision` travado em dia. Recusado substituir.

### Consequências

**O que fica mais fácil.** Trocar de provedor não toca em prompt. Revisar juridicamente uma
faixa inteira é ler um arquivo. A procedência gravada em cada extração aponta para um texto
que existe — antes apontava para `deterministic-prompt-v1`, uma versão que não correspondia a
prompt nenhum.

**O que fica mais caro.** Toda mudança de prompt agora arrasta revisão adversarial e leitura
do contrato de saída. Mudar o contrato arrasta migração, validador, mapeamento de API e teste
de deriva. É caro de propósito: foi a separação entre essas camadas que produziu os defeitos.

**O que continua fechado.** Nenhum provedor real, nenhum texto de processo saindo. Os portões
do ADR-011 (custo consultável, termos registrados) e do ADR-012 (lista de suboperadores,
legal hold) continuam valendo integralmente, e nenhum deles existe hoje.

### Condição para quem mexer nisto depois

Três mudanças exigem voltar aqui antes:

1. **Primeiro provedor real de modelo.** Reabre ADR-006, ADR-011 e ADR-012 juntos.
2. **Prompt editável fora do repositório**, por qualquer mecanismo. Contradiz as decisões 1 e 2.
3. **Qualquer alteração de contrato de saída de tarefa de IA.** Passa pela decisão 3: o
   revisor jurídico lê o contrato junto com o texto.

---

## ADR-016: Encerrar o MVP sem fabricar as condições externas

- **Status:** Aceito — decidido pelo dono em 2026-08-28
- **Data:** 2026-08-28
- **Decisor:** Samuel James Sousa Barreto, em nome da SAMUEL DEV LTDA
- **Trava:** o que ainda é trabalho de produto depois da Entrega 16
- **Supera:** somente a decisão de incluir ingestão por e-mail no MVP do ADR-010; o restante do
  ADR-010 continua como histórico e como restrição para qualquer conector futuro

### Decisão (2026-08-28)

Cinco decisões encerram a fila sem transformar ausência de contrato, medição ou revisão em
software aparentemente pronto.

| #   | Decisão                                                        | Condição inegociável                                                         |
| --- | -------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1   | A recuperação do assistente permanece limitada a cinco trechos | Ampliar exige avaliação de qualidade, latência e custo sobre acervo fictício |
| 2   | Upload é o único canal de entrada do MVP                       | E-mail de entrada vira conector futuro com incremento e ameaça próprios      |
| 3   | O adaptador real continua restrito a `CASE_ARCHIVE=fictional`  | Acervo real não sai sem os portões jurídicos e comerciais do ADR-012         |
| 4   | Os quinze prompts de especialidade permanecem `DRAFT`          | Promoção exige nome, OAB, data e versão do texto revisado                    |
| 5   | A aplicação deixa de guardar senha em `localStorage`           | Credencial persistente fica exclusivamente com o gerenciador do navegador    |

### Por que cinco trechos continuam sendo o teto

Cinco é o limite que o contrato atual consegue citar e que o orçamento por caso consegue
atribuir sem esconder descarte. Aumentá-lo por intuição ampliaria custo, contexto e chance de
misturar fontes sem uma avaliação que prove ganho. Pergunta ampla deve ser refinada pelo usuário;
o sistema não compensa um recorte insuficiente com conhecimento próprio do modelo.

O teto pode ser reaberto quando existir uma avaliação versionada com perguntas amplas fictícias,
medindo cobertura, citações resolvíveis, latência e custo nas alternativas. Até lá, permanecer em
cinco é decisão, não pendência.

### Por que a ingestão por e-mail sai do MVP

O upload autenticado já prova a proposta central e passa pelo pipeline hostil completo. Ingestão
por e-mail acrescentaria uma porta não autenticada, falsificação de remetente, polling ou webhook,
reconciliação de mensagens e uma nova relação caixa/organização/caso sem existir demanda de
cliente que pague essa superfície.

O conector futuro precisa de incremento próprio. Antes de código, ele define provedor de caixa,
autenticação do servidor, remetentes verificados, regra de associação a caso, retenção da mensagem
de origem, tratamento de anexos e resposta a indisponibilidade. Remetente não verificado nunca
escreve em tenant algum, preservando a parte de segurança do ADR-010.

### O que não pode ser resolvido por engenharia

Três ausências continuam bloqueando acervo real: cláusula assinada de não treinamento com o
fornecedor, mecanismo jurídico de transferência internacional para a região hospedada e pessoa
nomeada para atendimento a titular. Nenhuma variável, teste ou documento interno substitui essas
decisões externas.

Da mesma forma, o mecanismo de atestação dos prompts está pronto, mas o sistema não inventa o
advogado revisor. Os prompts especializados podem ser exercitados em acervo fictício; continuam
recusados para acervo real enquanto não houver assinatura válida.

### Senha no dispositivo

A aplicação não oferece mais guardar senha. Ao ler um registro criado por versão anterior, remove
imediatamente `password` e `savePassword` e regrava somente escritório, e-mail, persistência da
sessão e última rota. `autocomplete` permanece no formulário para que o cofre do navegador possa
preencher a credencial sem expô-la ao JavaScript da aplicação.

### Consequências

**Positivas**

- a fila de código não finge depender de escolhas que pertencem ao jurídico ou ao fornecedor;
- o MVP fecha com uma única entrada autenticada e uma fronteira de ameaça menor;
- acervo real e promoção jurídica continuam falhando fechado;
- sai um bloqueio de produção que expunha a senha a qualquer script executado na origem.

**Negativas**

- anexos recebidos por e-mail continuam exigindo upload humano;
- perguntas amplas podem pedir refinamento em vez de uma resposta única;
- o demo especializado continua marcado como rascunho;
- quem rejeita o gerenciador do navegador digita a senha novamente.

### Verificações de conformidade

- nenhuma propriedade `password` ou `savePassword` permanece nas preferências do dispositivo;
- um registro legado é saneado na primeira leitura e nunca preenche o campo de senha;
- não existe worker, webhook, polling ou rota de ingestão por e-mail no MVP;
- `CASE_ARCHIVE` continua obrigatório e o valor `real` recusa prompt sem atestação válida;
- ampliar o teto de cinco fontes exige nova decisão apoiada pela avaliação descrita acima;
- documentação de escopo, execução e harness aponta para este registro sem apagar o histórico.

### Condição para quem mexer nisto depois

Reabrir qualquer uma das cinco decisões exige novo ADR. Implementar o conector de e-mail ou
permitir acervo real é um novo incremento vertical, não manutenção da Entrega 16.
