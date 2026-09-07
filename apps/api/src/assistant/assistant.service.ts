import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  MAX_AFIRMACOES_POR_RESPOSTA,
  MAX_CITACOES_POR_AFIRMACAO,
  promptFor,
} from '@lex-os/ai-prompts';
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

/**
 * Quanto uma única resposta pode custar, no pior caso, com os preços configurados.
 *
 * O custo real só existe depois de a resposta existir, e a restrição do banco exige o gasto
 * dentro do teto: com folga menor que uma resposta, a despesa acontece e não pode ser gravada.
 * Exigir esta folga antes de chamar o modelo transforma o teto em teto de verdade.
 *
 * O teto de saída é conhecido — o próprio adaptador o envia. A entrada é limitada pelo prompt
 * mais os trechos recuperados, hoje no máximo oito pelo ADR-017; o valor abaixo é uma cota
 * generosa dela, porque errar para mais aqui recusa uma pergunta a mais, e errar para menos
 * deixa o gasto furar o teto. Oito trechos medem cerca de seis mil caracteres na avaliação de
 * 2026-09-06, bem dentro da cota — que existe para não precisar ser recalculada a cada ajuste
 * do teto, e não para ser exata.
 */
const TETO_TOKENS_DE_SAIDA = 4096;
const COTA_TOKENS_DE_ENTRADA = 32_000;

function custoMaximoDeUmaResposta(config: RuntimeConfig): string {
  const entrada =
    (COTA_TOKENS_DE_ENTRADA * Number(config.languageModel.inputCostPerMillionTokens)) / 1_000_000;
  const saida =
    (TETO_TOKENS_DE_SAIDA * Number(config.languageModel.outputCostPerMillionTokens)) / 1_000_000;
  return (entrada + saida).toFixed(6);
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
    // Não há piso: lista vazia é recusa, não saída inválida. Este parser já recusou exatamente o
    // que a instrução mandava fazer, e o modelo que obedecia derrubava a chamada enquanto o que
    // desobedecia "funcionava", embrulhando a recusa numa afirmação que a tela exibia como
    // resposta fundamentada.
    //
    // E o teto vem do contrato, não de um número escrito aqui — foi assim que ele divergiu:
    // parser em cinco, contrato sem teto declarado, prompt mandando quebrar a afirmação. O
    // modelo obedecia, produzia seis e levava 502.
    value.claims.length > MAX_AFIRMACOES_POR_RESPOSTA
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
      claim.sourceChunkIds.length > MAX_CITACOES_POR_AFIRMACAO ||
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
        refusalReason: 'NO_AUTHORIZED_SOURCE',
      };
    }

    const sources = new Map(retrieval.results.map((result) => [result.chunkId, result]));
    // A instrução muda com a área do caso: o que importa numa reclamação trabalhista não é o
    // que importa numa ação de cobrança. Área não catalogada cai no prompt genérico.
    const legalArea = await this.cases.legalAreaFor(actor, input.caseId);

    // O teto do caso passa a valer para a pergunta manual. Aqui é o último ponto em que
    // recusar ainda evita a despesa: logo abaixo o modelo é chamado. Exigir folga para uma
    // resposta inteira, e não folga qualquer, é o que impede o teto de ser ultrapassado
    // justamente na última pergunta — o custo só se conhece depois de a resposta existir.
    await this.cases.assertAssistantBudgetAvailable(
      actor.organizationId,
      input.caseId,
      custoMaximoDeUmaResposta(this.config),
    );
    const prompt = promptFor('GROUNDED_ANSWER', legalArea, {
      caseArchive: this.config.caseArchive,
    });
    // A falha do provedor é esperada e precisa ter tratamento próprio. Sem este `catch`, o
    // adaptador real lançava `Error` puro quando o modelo não devolvia o objeto JSON pedido, e
    // a falha escapava como 500 `http_request_failed_unexpectedly` — "erro interno" na tela do
    // escritório, sem nada que diga o que houve nem o que fazer. Medido em 2026-09-07 numa
    // avaliação por faixa: acontecia em pergunta difícil, de forma intermitente, e sempre na
    // mesma pergunta que o assistente deveria recusar.
    //
    // Vira o mesmo 502 do contrato de saída inválido, porque para quem chama é a mesma coisa: o
    // provedor não entregou resposta utilizável. O motivo real fica no log e na trilha, que é
    // onde se diagnostica.
    let rawOutput: unknown;
    try {
      rawOutput = await this.languageModel.generate({
        prompt,
        question: input.question,
        sources: retrieval.results.map((result) => ({
          chunkId: result.chunkId,
          content: result.excerpt,
        })),
      });
    } catch (erro) {
      await this.audit.recordDomain({
        organizationId: actor.organizationId,
        userId: actor.userId,
        entityId: null,
        entityType: 'assistant_answer',
        action: 'assistant.answer.failed',
        newData: {
          caseId: input.caseId,
          questionLength: input.question.length,
          promptVersion: prompt.version,
          // A mensagem do adaptador é metadado da chamada e nunca carrega texto de documento —
          // o próprio adaptador cuida disso ao montá-la.
          reason: erro instanceof Error ? erro.message : 'unknown provider failure',
        },
        ...metadata,
      });
      // O custo desta chamada existe no provedor e não é debitado do teto do caso: o adaptador
      // falha antes de informar quanto custou, e gravar um número inventado seria pior do que
      // não gravar. Limitação conhecida, registrada aqui e não escondida.
      throw invalidOutput();
    }
    const parsed = parseProviderOutput(rawOutput, new Set(sources.keys()));
    const claims = parsed.claims.map((claim) => mapClaim(claim, sources));
    const sourceChunkIds = [...new Set(parsed.claims.flatMap((claim) => claim.sourceChunkIds))];

    // O modelo leu os trechos e nenhum sustenta a resposta. Até aqui a recusa só existia quando
    // a recuperação não trazia nada — e ela quase sempre traz alguma coisa, porque a busca casa
    // por proximidade. Sem este caminho, "os trechos não dizem" chegava ao escritório como
    // resposta fundamentada. O custo é debitado do mesmo jeito: o modelo rodou.
    if (claims.length === 0) {
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
          ...parsed.model,
        },
        ...metadata,
      });
      await this.cases.chargeAssistantCost(
        actor.organizationId,
        input.caseId,
        parsed.model.costAmount,
      );
      return {
        status: 'INSUFFICIENT_EVIDENCE',
        machineGenerated: true,
        disclaimer,
        answer: null,
        claims: [],
        model: parsed.model,
        refusalReason: 'SOURCES_DO_NOT_SUPPORT',
      };
    }

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

    // A resposta ja foi gerada e o custo ja existe. Debitar depois nao evita esta despesa —
    // evita a proxima, que e onde o teto ainda consegue agir.
    await this.cases.chargeAssistantCost(
      actor.organizationId,
      input.caseId,
      parsed.model.costAmount,
    );

    return {
      status: 'ANSWER',
      machineGenerated: true,
      disclaimer,
      answer: claims.map((claim) => claim.text).join('\n\n'),
      claims,
      model: parsed.model,
      refusalReason: null,
    };
  }
}
