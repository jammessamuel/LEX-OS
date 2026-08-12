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

  lexical(query: string, scope: SearchScope, take: number): Promise<SearchDatabaseRow[]> {
    const where = authorizedScopeSql(scope);
    return this.database.client.$queryRaw<SearchDatabaseRow[]>(Prisma.sql`
      SELECT
        ${resultColumns},
        ts_rank_cd(
          kc."search_vector",
          websearch_to_tsquery('portuguese', ${query}),
          32
        )::double precision AS "score"
      FROM "knowledge_chunks" kc
      ${sourceJoins}
      WHERE ${where}
        AND kc."search_vector" @@ websearch_to_tsquery('portuguese', ${query})
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
