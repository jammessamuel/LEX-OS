import { Injectable } from '@nestjs/common';
import { Prisma } from '@lex-os/database';

import { DatabaseService } from '../database/database.service.js';

export interface SearchScope {
  organizationId: string;
  allowConfidential: boolean;
  caseId?: string;
  documentId?: string;
  documentTypeId?: string;
  legalArea?: string;
}

export interface SearchDatabaseRow {
  chunkId: string;
  caseId: string;
  documentId: string;
  sourceId: string;
  chunkIndex: number;
  content: string;
  contentHash: string;
  metadata: Prisma.JsonValue;
  confidentialityLevel: string;
  score: number;
}

function authorizedScopeSql(scope: SearchScope): Prisma.Sql {
  const clauses: Prisma.Sql[] = [
    Prisma.sql`kc."organization_id" = ${scope.organizationId}::uuid`,
    Prisma.sql`kc."source_type" = 'DOCUMENT_EXTRACTION'`,
    Prisma.sql`c."deleted_at" IS NULL`,
    Prisma.sql`d."deleted_at" IS NULL`,
    Prisma.sql`f."deleted_at" IS NULL`,
    Prisma.sql`f."status" = 'AVAILABLE'`,
    Prisma.sql`f."virus_scan_status" = 'CLEAN'`,
    Prisma.sql`de."extraction_type" = 'OCR'`,
    Prisma.sql`de."status" = 'COMPLETED'`,
    Prisma.sql`NOT EXISTS (
      SELECT 1
      FROM "document_extractions" newer
      WHERE newer."organization_id" = de."organization_id"
        AND newer."document_id" = de."document_id"
        AND newer."extraction_type" = 'OCR'
        AND newer."status" = 'COMPLETED'
        AND (
          newer."created_at" > de."created_at"
          OR (newer."created_at" = de."created_at" AND newer."id" > de."id")
        )
    )`,
  ];

  if (!scope.allowConfidential) {
    clauses.push(Prisma.sql`c."confidentiality_level" = 'STANDARD'`);
  }
  if (scope.caseId !== undefined) {
    clauses.push(Prisma.sql`kc."case_id" = ${scope.caseId}::uuid`);
  }
  if (scope.documentId !== undefined) {
    clauses.push(Prisma.sql`kc."document_id" = ${scope.documentId}::uuid`);
  }
  if (scope.documentTypeId !== undefined) {
    clauses.push(Prisma.sql`d."document_type_id" = ${scope.documentTypeId}::uuid`);
  }
  if (scope.legalArea !== undefined) {
    clauses.push(Prisma.sql`c."legal_area" = ${scope.legalArea}`);
  }

  return Prisma.join(clauses, ' AND ');
}

const sourceJoins = Prisma.sql`
  JOIN "documents" d
    ON d."organization_id" = kc."organization_id"
   AND d."id" = kc."document_id"
  JOIN "cases" c
    ON c."organization_id" = kc."organization_id"
   AND c."id" = kc."case_id"
   AND d."case_id" = c."id"
  JOIN "files" f
    ON f."organization_id" = d."organization_id"
   AND f."id" = d."file_id"
  JOIN "document_extractions" de
    ON de."organization_id" = kc."organization_id"
   AND de."document_id" = kc."document_id"
   AND de."id" = kc."source_id"
`;

const resultColumns = Prisma.sql`
  kc."id" AS "chunkId",
  kc."case_id" AS "caseId",
  kc."document_id" AS "documentId",
  kc."source_id" AS "sourceId",
  kc."chunk_index" AS "chunkIndex",
  kc."content",
  kc."content_hash" AS "contentHash",
  kc."metadata",
  c."confidentiality_level"::text AS "confidentialityLevel"
`;

@Injectable()
export class SearchRepository {
  constructor(private readonly database: DatabaseService) {}

  /**
   * Busca textual com abertura em dois tempos.
   *
   * `websearch_to_tsquery` exige **todos** os termos. Isso serve para quem digita palavra-chave
   * e quebra para quem digita pergunta: "Qual é o número do contrato e quando ele foi celebrado?"
   * vira `qual & número & contrato & celebrado`, e um documento que diz "Contrato fictício
   * LEX-2026-0001, celebrado em 05/08/2026" não casa — porque não contém "qual" nem "número".
   *
   * O assistente manda a pergunta inteira como consulta, então na prática ele só entendia
   * palavra-chave. E o modo híbrido não salvava: o provedor de embeddings ainda é o
   * determinístico de desenvolvimento, então o lado semântico é ruído.
   *
   * A abertura é sequencial e não simultânea de propósito. Quem escreve termos precisos merece a
   * precisão do `E`; só quando ela não devolve nada é que vale relaxar para `OU`, ordenado por
   * relevância. Trocar tudo por `OU` sempre encheria a resposta de trecho fraco quando havia
   * trecho forte, e o teto de cinco fontes do ADR-016 gastaria as vagas com o pior material.
   */
  async lexical(query: string, scope: SearchScope, take: number): Promise<SearchDatabaseRow[]> {
    const estrito = await this.#lexicalWith(
      Prisma.sql`websearch_to_tsquery('portuguese', ${query})`,
      scope,
      take,
    );
    if (estrito.length > 0) {
      return estrito;
    }
    return this.#lexicalWith(
      // `plainto_tsquery` normaliza e descarta as palavras vazias do português; trocar o `&`
      // pelo `|` no resultado transforma "todos os termos" em "qualquer termo", sem precisar
      // manter uma lista de palavras vazias nossa que envelheceria contra a do PostgreSQL.
      Prisma.sql`replace(plainto_tsquery('portuguese', ${query})::text, ' & ', ' | ')::tsquery`,
      scope,
      take,
    );
  }

  #lexicalWith(
    tsquery: Prisma.Sql,
    scope: SearchScope,
    take: number,
  ): Promise<SearchDatabaseRow[]> {
    const where = authorizedScopeSql(scope);
    return this.database.client.$queryRaw<SearchDatabaseRow[]>(Prisma.sql`
      SELECT
        ${resultColumns},
        ts_rank_cd(kc."search_vector", ${tsquery}, 32)::double precision AS "score"
      FROM "knowledge_chunks" kc
      ${sourceJoins}
      WHERE ${where}
        AND kc."search_vector" @@ ${tsquery}
      ORDER BY "score" DESC, kc."id" ASC
      LIMIT ${take}
    `);
  }

  semantic(
    queryVector: readonly number[],
    descriptor: { provider: string; model: string; version: string; dimensions: number },
    scope: SearchScope,
    take: number,
  ): Promise<SearchDatabaseRow[]> {
    const where = authorizedScopeSql(scope);
    const vector = `[${queryVector.join(',')}]`;
    return this.database.client.$queryRaw<SearchDatabaseRow[]>(Prisma.sql`
      WITH candidates AS MATERIALIZED (
        SELECT
          ${resultColumns},
          kc."embedding"
        FROM "knowledge_chunks" kc
        ${sourceJoins}
        WHERE ${where}
          AND kc."embedding" IS NOT NULL
          AND kc."embedding_provider" = ${descriptor.provider}
          AND kc."embedding_model" = ${descriptor.model}
          AND kc."embedding_version" = ${descriptor.version}
          AND kc."embedding_dimensions" = ${descriptor.dimensions}
      )
      SELECT
        "chunkId",
        "caseId",
        "documentId",
        "sourceId",
        "chunkIndex",
        "content",
        "contentHash",
        "metadata",
        "confidentialityLevel",
        (1 - ("embedding" <=> ${vector}::vector))::double precision AS "score"
      FROM candidates
      WHERE (1 - ("embedding" <=> ${vector}::vector)) >= 0.65
      ORDER BY "score" DESC, "chunkId" ASC
      LIMIT ${take}
    `);
  }
}
