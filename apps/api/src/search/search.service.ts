import { Inject, Injectable } from '@nestjs/common';
import { assertEmbeddingBatch, type EmbeddingProvider } from '@lex-os/shared';

import { AuditService, type RequestAuditMetadata } from '../audit/audit.service.js';
import type { ActorContext } from '../auth/actor-context.js';
import type { SearchRequestDto, SearchMode } from './dto/search-request.dto.js';
import type { SearchResponseDto, SearchResultDto } from './dto/search-response.dto.js';
import { SEARCH_EMBEDDING_PROVIDER } from './mock-search-embedding.provider.js';
import { SearchRepository, type SearchDatabaseRow, type SearchScope } from './search.repository.js';

interface RankedCandidate {
  row: SearchDatabaseRow;
  lexicalRank?: number;
  semanticRank?: number;
  lexicalScore?: number;
  semanticScore?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function mapCitation(row: SearchDatabaseRow): SearchResultDto['citation'] | null {
  if (!isRecord(row.metadata) || !isRecord(row.metadata.locator)) {
    return null;
  }
  const { pageNumber, startOffset, endOffset } = row.metadata.locator;
  if (
    !Number.isInteger(pageNumber) ||
    !Number.isInteger(startOffset) ||
    !Number.isInteger(endOffset) ||
    Number(pageNumber) < 1 ||
    Number(startOffset) < 0 ||
    Number(endOffset) <= Number(startOffset) ||
    row.metadata.sourceExtractionId !== row.sourceId
  ) {
    return null;
  }
  return {
    caseId: row.caseId,
    documentId: row.documentId,
    extractionId: row.sourceId,
    pageNumber: Number(pageNumber),
    startOffset: Number(startOffset),
    endOffset: Number(endOffset),
    contentHash: row.contentHash,
  };
}

function mergeRankings(
  lexical: readonly SearchDatabaseRow[],
  semantic: readonly SearchDatabaseRow[],
): RankedCandidate[] {
  const candidates = new Map<string, RankedCandidate>();
  for (const [index, row] of lexical.entries()) {
    candidates.set(row.chunkId, {
      row,
      lexicalRank: index + 1,
      lexicalScore: row.score,
    });
  }
  for (const [index, row] of semantic.entries()) {
    const current = candidates.get(row.chunkId);
    candidates.set(row.chunkId, {
      row: current?.row ?? row,
      ...(current?.lexicalRank === undefined ? {} : { lexicalRank: current.lexicalRank }),
      ...(current?.lexicalScore === undefined ? {} : { lexicalScore: current.lexicalScore }),
      semanticRank: index + 1,
      semanticScore: row.score,
    });
  }
  return [...candidates.values()];
}

function reciprocalRank(candidate: RankedCandidate): number {
  return (
    (candidate.lexicalRank === undefined ? 0 : 1 / (60 + candidate.lexicalRank)) +
    (candidate.semanticRank === undefined ? 0 : 1 / (60 + candidate.semanticRank))
  );
}

function candidateResult(candidate: RankedCandidate, mode: SearchMode): SearchResultDto | null {
  const citation = mapCitation(candidate.row);
  if (citation === null) {
    return null;
  }
  const matchedBy =
    candidate.lexicalRank !== undefined && candidate.semanticRank !== undefined
      ? 'HYBRID'
      : candidate.lexicalRank !== undefined
        ? 'LEXICAL'
        : 'SEMANTIC';
  const score =
    mode === 'HYBRID'
      ? reciprocalRank(candidate)
      : mode === 'LEXICAL'
        ? (candidate.lexicalScore ?? 0)
        : (candidate.semanticScore ?? 0);
  return {
    chunkId: candidate.row.chunkId,
    excerpt: candidate.row.content,
    matchedBy,
    score: Number(score.toFixed(8)),
    citation,
  };
}

@Injectable()
export class SearchService {
  constructor(
    private readonly repository: SearchRepository,
    private readonly audit: AuditService,
    @Inject(SEARCH_EMBEDDING_PROVIDER) private readonly embeddingProvider: EmbeddingProvider,
  ) {}

  async search(
    actor: ActorContext,
    input: SearchRequestDto,
    metadata: RequestAuditMetadata,
  ): Promise<SearchResponseDto> {
    const mode = input.mode ?? 'HYBRID';
    const scope: SearchScope = {
      organizationId: actor.organizationId,
      allowConfidential: actor.permissions.has('confidential_cases.read'),
      ...(input.caseId === undefined ? {} : { caseId: input.caseId }),
      ...(input.documentId === undefined ? {} : { documentId: input.documentId }),
      ...(input.documentTypeId === undefined ? {} : { documentTypeId: input.documentTypeId }),
      ...(input.legalArea === undefined ? {} : { legalArea: input.legalArea }),
    };
    const candidateLimit = Math.min(input.limit * 4, 100);
    const lexicalPromise =
      mode === 'SEMANTIC'
        ? Promise.resolve([] as SearchDatabaseRow[])
        : this.repository.lexical(input.query, scope, candidateLimit);
    const semanticPromise =
      mode === 'LEXICAL'
        ? Promise.resolve([] as SearchDatabaseRow[])
        : this.#semantic(input.query, scope, candidateLimit);
    const [lexical, semantic] = await Promise.all([lexicalPromise, semanticPromise]);
    const ranked = mergeRankings(lexical, semantic)
      .sort((left, right) => {
        const difference = reciprocalRank(right) - reciprocalRank(left);
        return difference === 0 ? left.row.chunkId.localeCompare(right.row.chunkId) : difference;
      })
      .map((candidate) => candidateResult(candidate, mode))
      .filter((result): result is SearchResultDto => result !== null)
      .slice(0, input.limit);
    const status = ranked.length === 0 ? 'INSUFFICIENT_EVIDENCE' : 'RESULTS';
    const confidentialResultCount = ranked.filter((result) => {
      const source =
        lexical.find((row) => row.chunkId === result.chunkId) ??
        semantic.find((row) => row.chunkId === result.chunkId);
      return source?.confidentialityLevel !== 'STANDARD';
    }).length;

    await this.audit.recordDomain({
      organizationId: actor.organizationId,
      userId: actor.userId,
      entityId: null,
      entityType: 'knowledge_search',
      action: 'knowledge.search.executed',
      newData: {
        mode,
        queryLength: input.query.length,
        resultCount: ranked.length,
        status,
        filters: {
          caseId: input.caseId ?? null,
          documentId: input.documentId ?? null,
          documentTypeId: input.documentTypeId ?? null,
          legalArea: input.legalArea ?? null,
        },
      },
      ...metadata,
    });
    if (confidentialResultCount > 0) {
      await this.audit.recordDomain({
        organizationId: actor.organizationId,
        userId: actor.userId,
        entityId: null,
        entityType: 'case',
        action: 'case.confidential.read',
        newData: { access: 'SEARCH', count: confidentialResultCount },
        ...metadata,
      });
    }

    return { status, mode, resultCount: ranked.length, results: ranked };
  }

  async #semantic(query: string, scope: SearchScope, take: number): Promise<SearchDatabaseRow[]> {
    const embeddings = await this.embeddingProvider.embed([query]);
    assertEmbeddingBatch(embeddings, 1, this.embeddingProvider.descriptor.dimensions);
    return this.repository.semantic(
      embeddings[0] ?? [],
      this.embeddingProvider.descriptor,
      scope,
      take,
    );
  }
}
