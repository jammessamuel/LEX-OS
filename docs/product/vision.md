# LEX OS product vision

**Status:** Baseline proposal  
**Owner:** SAMUEL DEV LTDA  
**Last updated:** 2026-08-05

## Vision

LEX OS is an intelligent operating system for law firms. It receives the operational disorder that precedes legal analysis—files, scans, messages, media, and incomplete context—and produces a structured, searchable, traceable legal dossier ready for a lawyer's review.

The product exists to reduce non-strategic effort without taking legal judgment away from the professional.

## Problem

Before a lawyer can analyze a matter, the office frequently needs to:

- discover whether files are readable, duplicated, or missing;
- identify what each document represents;
- extract text and facts from heterogeneous formats;
- connect people, dates, events, evidence, and pending actions;
- reconstruct a chronology;
- locate the original source of a claim;
- preserve knowledge that otherwise remains in personal folders or individual memory.

This work is repetitive, expensive, error-prone, and difficult to audit. Existing legal ERPs primarily manage cases and deadlines; generic AI assistants do not provide sufficient tenancy, provenance, workflow, or institutional memory.

## Product promise

> Receive operational disorder and deliver a structured, searchable, traceable legal dossier ready for analysis.

The promise has four non-negotiable properties:

1. **Organization:** inputs become cases, documents, participants, events, evidence, checklists, and tasks.
2. **Traceability:** every machine-produced legal claim points to its authorized source and location.
3. **Human control:** AI suggestions remain reviewable, versioned, and distinguishable from human confirmation.
4. **Institutional memory:** knowledge remains available to the office subject to access and confidentiality rules.

## Primary users

- **Partners and administrators:** configure access, supervise confidential matters, and review audit activity.
- **Lawyers:** analyze cases, validate extracted facts, confirm chronology, and search office memory.
- **Assistants and interns:** organize intake, upload documents, resolve checklist gaps, and create operational tasks.
- **Read-only collaborators:** consult only explicitly authorized case material.

## Core experience

From a case, a user selects **Preparar processo** and uploads one or more files or a ZIP archive. LEX OS shows an understandable sequence in Portuguese:

1. Recebendo arquivos.
2. Validando arquivos.
3. Verificando duplicados.
4. Extraindo textos.
5. Classificando documentos.
6. Extraindo dados.
7. Gerando cronologia.
8. Montando checklist.
9. Indexando memória.
10. Preparação concluída.

The result reports accepted and rejected files, duplicates, classified and illegible documents, extracted entities, proposed events, pending items, and everything that needs human review.

## Product principles

- The lawyer should spend less time organizing information.
- A relevant AI statement without a source is not a product result.
- Human and machine actions are distinguishable and auditable.
- Original files are preserved.
- The system is independent from any legal ERP or AI vendor.
- Tenant isolation, privacy, and least privilege are product features.
- A modular monolith and asynchronous processing are the starting architecture.
- The initial interface uses Brazilian Portuguese; technical identifiers use English.
- Connectors extend the product but never define its core.

## Differentiation

LEX OS is not positioned as:

- a generic legal chatbot;
- an automatic petition filing service;
- only a petition generator;
- only a jurisprudence search engine;
- an obligatory companion to Astrea, ProJuris, ADVBOX, Legal One, or another ERP;
- a thin interface for one AI provider.

Its durable advantage is the combination of operational preparation, evidence-level provenance, human validation, and private institutional memory.

## Success outcomes

The MVP should demonstrate that a fictional law firm can securely ingest a case, process its documents asynchronously with deterministic mock intelligence, review a sourced preliminary chronology and checklist, and retrieve tenant-scoped information with a complete audit trail.

Initial product metrics to instrument, without setting unsupported targets yet, are:

- time from upload to a reviewable dossier;
- percentage of accepted, rejected, duplicate, and illegible files;
- percentage of classifications and events changed by a human;
- checklist completeness before and after preparation;
- processing failure and retry rates;
- search results opened and source citations followed;
- attempted or prevented cross-tenant access;
- processing cost by provider, model, case, and organization.

Targets require user research and representative, non-production test corpora before they become acceptance criteria.

## Product boundaries

The MVP prepares and retrieves information. It does not make autonomous legal decisions, file petitions, monitor every court, replace a legal ERP, or claim that an unconfirmed AI extraction is true.

Future integrations with courts, ERPs, communication channels, and public precedent sources are optional connectors governed by their own access, provenance, reliability, and compliance requirements.
