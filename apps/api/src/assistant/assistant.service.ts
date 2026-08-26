import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { promptFor } from '@lex-os/ai-prompts';
import type { RuntimeConfig } from '@lex-os/config';

import { AuditService, type RequestAuditMetadata } from '../audit/audit.service.js';
import type { ActorContext } from '../auth/actor-context.js';
import { CasesService } from '../cases/cases.service.js';
import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';
import { ApiException } from '../http/api-exception.js';
import type { SearchCitationDto, SearchResultDto } from '../search/dto/search-response.dto.js';
import { SearchService } from '../search/search.service.js';
import type { GroundedAnswerRequestDto } from './dto/grounded-answer-request.dto.js';
import type {
  GroundedAnswerModelDto,
  GroundedAnswerResponseDto,
  GroundedClaimDto,
} from './dto/grounded-answer-response.dto.js';
import {
  GROUNDED_LANGUAGE_MODEL_PROVIDER,
  type GroundedLanguageModelProvider,
} from './grounded-language-model.provider.js';

const disclaimer =
  'Conteúdo gerado por máquina a partir de fontes autorizadas; não é parecer jurídico e exige revisão humana.';

interface ParsedProviderOutput {
  model: GroundedAnswerModelDto;
  claims: readonly { text: string; sourceChunkIds: readonly string[] }[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const orderedExpected = [...expected].sort();
  return (
    actual.length === orderedExpected.length &&
    actual.every((key, index) => key === orderedExpected[index])
  );
}

function boundedText(value: unknown, maximum: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maximum;
}

function fixedCostAmount(value: string): string {
  const [whole, fraction = ''] = value.split('.');
  return `${whole}.${fraction.padEnd(6, '0')}`;
}

function parseProviderOutput(
  value: unknown,
  authorizedChunkIds: Set<string>,
): ParsedProviderOutput {
  const topLevelKeys = [
    'schemaVersion',
    'provider',
    'modelName',
    'modelVersion',
    'promptVersion',
    'executionId',
    'costAmount',
    'costCurrency',
    'claims',
  ] as const;
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, topLevelKeys) ||
    value.schemaVersion !== 1 ||
    !boundedText(value.provider, 120) ||
    !boundedText(value.modelName, 160) ||
    !boundedText(value.modelVersion, 120) ||
    !boundedText(value.promptVersion, 80) ||
    !boundedText(value.executionId, 160) ||
    typeof value.costAmount !== 'string' ||
    !/^(0|[1-9]\d{0,11})(\.\d{1,6})?$/u.test(value.costAmount) ||
    value.costCurrency !== 'BRL' ||
    !Array.isArray(value.claims) ||
    value.claims.length === 0 ||
    value.claims.length > 5
  ) {
    throw invalidOutput();
  }

  const claims = value.claims.map((claim) => {
    if (
      !isRecord(claim) ||
      !hasOnlyKeys(claim, ['text', 'sourceChunkIds']) ||
      !boundedText(claim.text, 2000) ||
      !Array.isArray(claim.sourceChunkIds) ||
      claim.sourceChunkIds.length === 0 ||
      claim.sourceChunkIds.length > 5 ||
      claim.sourceChunkIds.some(
        (chunkId) => typeof chunkId !== 'string' || !authorizedChunkIds.has(chunkId),
      ) ||
      new Set(claim.sourceChunkIds).size !== claim.sourceChunkIds.length
    ) {
      throw invalidOutput();
    }
    return { text: claim.text.trim(), sourceChunkIds: claim.sourceChunkIds as string[] };
  });

  return {
    model: {
      provider: value.provider,
      modelName: value.modelName,
      modelVersion: value.modelVersion,
      promptVersion: value.promptVersion,
      executionId: value.executionId,
      costAmount: fixedCostAmount(value.costAmount),
      costCurrency: 'BRL',
    },
    claims,
  };
}

function invalidOutput(): ApiException {
  return new ApiException(
    HttpStatus.BAD_GATEWAY,
    'INVALID_LANGUAGE_MODEL_OUTPUT',
    'O provedor retornou uma resposta sem ancoragem válida.',
  );
}

function mapClaim(
  claim: ParsedProviderOutput['claims'][number],
  sources: ReadonlyMap<string, SearchResultDto>,
): GroundedClaimDto {
  const citations = claim.sourceChunkIds
    .map((chunkId) => sources.get(chunkId)?.citation)
    .filter((citation): citation is SearchCitationDto => citation !== undefined);
  if (citations.length !== claim.sourceChunkIds.length) {
    throw invalidOutput();
  }
  return { text: claim.text, citations };
}

@Injectable()
export class AssistantService {
  constructor(
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
    private readonly search: SearchService,
    private readonly cases: CasesService,
    private readonly audit: AuditService,
    @Inject(GROUNDED_LANGUAGE_MODEL_PROVIDER)
    private readonly languageModel: GroundedLanguageModelProvider,
  ) {}

  async answer(
    actor: ActorContext,
    input: GroundedAnswerRequestDto,
    metadata: RequestAuditMetadata,
  ): Promise<GroundedAnswerResponseDto> {
    const retrieval = await this.search.search(
      actor,
      {
        query: input.question,
        mode: input.mode ?? 'HYBRID',
        caseId: input.caseId,
        ...(input.documentId === undefined ? {} : { documentId: input.documentId }),
        limit: input.limit,
      },
      metadata,
    );
    if (retrieval.status === 'INSUFFICIENT_EVIDENCE') {
      await this.audit.recordDomain({
        organizationId: actor.organizationId,
        userId: actor.userId,
        entityId: null,
        entityType: 'assistant_answer',
        action: 'assistant.answer.refused',
        newData: {
          caseId: input.caseId,
          questionLength: input.question.length,
          status: 'INSUFFICIENT_EVIDENCE',
        },
        ...metadata,
      });
      return {
        status: 'INSUFFICIENT_EVIDENCE',
        machineGenerated: true,
        disclaimer,
        answer: null,
        claims: [],
        model: null,
      };
    }

    const sources = new Map(retrieval.results.map((result) => [result.chunkId, result]));
    // A instrução muda com a área do caso: o que importa numa reclamação trabalhista não é o
    // que importa numa ação de cobrança. Área não catalogada cai no prompt genérico.
    const legalArea = await this.cases.legalAreaFor(actor, input.caseId);
    const prompt = promptFor('GROUNDED_ANSWER', legalArea, {
      environment: this.config.environment,
    });
    const rawOutput = await this.languageModel.generate({
      prompt,
      question: input.question,
      sources: retrieval.results.map((result) => ({
        chunkId: result.chunkId,
        content: result.excerpt,
      })),
    });
    const parsed = parseProviderOutput(rawOutput, new Set(sources.keys()));
    const claims = parsed.claims.map((claim) => mapClaim(claim, sources));
    const sourceChunkIds = [...new Set(parsed.claims.flatMap((claim) => claim.sourceChunkIds))];

    await this.audit.recordDomain({
      organizationId: actor.organizationId,
      userId: actor.userId,
      entityId: null,
      entityType: 'assistant_answer',
      action: 'assistant.answer.generated',
      newData: {
        caseId: input.caseId,
        questionLength: input.question.length,
        claimCount: claims.length,
        sourceChunkIds,
        ...parsed.model,
      },
      ...metadata,
    });

    return {
      status: 'ANSWER',
      machineGenerated: true,
      disclaimer,
      answer: claims.map((claim) => claim.text).join('\n\n'),
      claims,
      model: parsed.model,
    };
  }
}
