# ADR-001: Start with a modular monolith

- **Status:** Accepted
- **Date:** 2026-08-05
- **Deciders:** SAMUEL DEV LTDA / LEX OS architecture

## Context

LEX OS spans identity, cases, files, asynchronous processing, AI extractions, chronology, checklists, search, and audit. These domains need clear ownership, but the first team and workload do not justify independent services, distributed transactions, multiple deployment pipelines, or duplicated operational tooling.

Heavy processing must not execute in HTTP requests, and the web client has an independent runtime. This separation does not require turning domain modules into microservices.

## Decision

Build one modular backend codebase in a pnpm/Turborepo monorepo. Run it through two composition roots:

- `apps/api` for NestJS HTTP transport;
- `apps/worker` for BullMQ processors.

Both use the same domain/application modules, contracts, Prisma database, and observability conventions. `apps/web` is a separate Vue client.

Modules expose application services or explicit ports and keep repositories internal. Asynchronous queue messages reference persisted job IDs and do not become a second source of domain truth.

Extract a service only after measured scaling, security isolation, reliability, ownership, or independent release requirements demonstrate the need. Extraction requires a new ADR.

## Consequences

### Positive

- simpler transactions and tenant consistency;
- one schema and one coherent audit trail;
- lower local/CI/production operational cost;
- fast refactoring while module boundaries are still being learned;
- API and worker can scale independently at the process level.

### Negative

- poor module discipline could create tight coupling;
- all backend modules share a deployment artifact and database failure domain;
- resource-heavy worker libraries must not leak into API startup/runtime;
- later extraction still requires deliberate contract and data ownership work.

## Rejected alternatives

- **Microservices from the start:** adds distributed consistency, tracing, deployment, and testing cost without evidence.
- **Single HTTP process including heavy jobs:** violates latency and reliability requirements.
- **Serverless function per operation:** complicates streaming, long-running processing, shared transactions, and local parity at this stage.

## Compliance checks

- Module tests must not import another module's private repository.
- API smoke tests prove worker-only providers do not initialize in the API process.
- Architecture review is required before adding a separately owned datastore or deployable backend service.
