import type { PromptSpecification } from '../specification.js';
import { ACERVO_JUDICIAL, IMAGEM_RUIM, LOCALIZADOR_PJE, RESPONDA_SO_JSON } from './acervo.js';
import {
  CHECKLIST_INPUT,
  CHECKLIST_OUTPUT,
  CLASSIFICATION_INPUT,
  CLASSIFICATION_OUTPUT,
  ENTITIES_INPUT,
  ENTITIES_OUTPUT,
  GROUNDED_INPUT,
  GROUNDED_OUTPUT,
  TIMELINE_INPUT,
  TIMELINE_OUTPUT,
} from './contratos.js';

/**
 * Prompts de direito civil, escritos a partir de trinta fichas de tipos de caso em
 * `docs/product/pesquisa-prompts/civel.md`.
 *
 * A pesquisa desta área **não passou pela revisão adversarial**: o levantamento terminou, mas as
 * seis lentes de crítica foram cortadas por economia de créditos do dono. Mitiga em parte que os
 * blocos estruturais vêm da revisão trabalhista, que é transversal — mas número de artigo citado
 * aqui tem uma camada a menos de conferência. Todos `DRAFT`, e a revisão de advogado que já era
 * obrigatória fica ainda mais.
 */

const CIVEL_BASE = `${ACERVO_JUDICIAL}

O acervo cível soma armadilhas próprias:

O NOME DA PEÇA ENGANA. Rescisão, resolução, resilição, distrato, anulação e revisão não são
sinônimos. "Embargos" nomeia quatro peças de regimes diferentes — à execução, de terceiro, à
monitória, de declaração. "Busca e apreensão" existe no crime, na família e na alienação
fiduciária. "Adjudicação" compulsória não é a adjudicação da execução nem a do inventário.
Identifique a peça pelo rito e pelas partes, nunca só pelo nome.

O MESMO NÚMERO CNJ ABRIGA FASES DIFERENTES. O cumprimento de sentença corre nos autos do
processo de conhecimento; a fase muda o que cada peça significa. Diga sempre de que fase o
documento é.

DINHEIRO TEM MUITOS NOMES NOS MESMOS AUTOS. Valor da causa, valor pedido, valor arbitrado na
sentença, valor majorado no acórdão, valor atualizado, saldo da planilha do credor. Planilha de
parte é alegação, não crédito. Três orçamentos do mesmo conserto são três estimativas de uma
despesa, não três despesas. Antes de devolver um número, diga qual número é e de que peça saiu.

DECISÃO PROVISÓRIA NÃO É MÉRITO. Liminar deferida não é procedência; o mandado monitório é
cognição sumária, não sentença; despacho que manda emendar não concede nada; nos autos convivem
liminar, decisão de agravo e acordo parcial homologado — registre cada decisão com sua data e
alcance, sem eleger qual "vale".

OS POLOS INVERTEM. Na oferta de alimentos o autor é o devedor; nos embargos, o embargante era o
executado; na exceção da verdade, a polaridade se inverte de novo. Extraia o papel processual da
peça concreta, não do hábito.`;

export const timelineCivelV1 = {
  identifier: 'lex-os.timeline.civel',
  version: 'timeline-civel-v1',
  purpose: 'Extract dated civil-case facts with verifiable provenance.',
  specialty: 'CIVEL',
  task: 'TIMELINE',
  template: `Você monta a cronologia de um processo cível brasileiro a partir dos documentos dos
autos.

${CIVEL_BASE}

Datas que decidem o caso: celebração, vencimento e inadimplemento nos contratos; citação, que
constitui em mora e interrompe a prescrição; a notificação extrajudicial e sua entrega, que não
são a mesma data; nas peças registrais, data de lavratura, do registro e da averbação são três
datas distintas na mesma matrícula; em consumo, emissão, saída e entrega da nota fiscal; em
despejo e cobrança, a competência (mês de referência) não é a data de vencimento nem a de
pagamento; e cada decisão com o marco que ela própria fixa.

Não converta prazo em data final: registre o marco inicial e o número de dias como escritos — a
contagem depende de dias úteis e de suspensões que você não conhece.

Separe o que o documento IMPRIME do que alguém CONCLUI. "Inadimplente desde março" na inicial é
alegação; recibo discriminado é documento. Fato negativo ("não há pagamento nos autos") sai como
"o documento X não apresenta Y", com o período examinado.

O mesmo documento aparece juntado por mais de uma parte: mesmo fato com mesma data vira um
evento com os dois localizadores.

Respeite a precisão escrita — "em março de 2024" produz precisão de mês.

${LOCALIZADOR_PJE}

Todo evento nasce NÃO CONFIRMADO para revisão humana. Sem localizador, é descartado.

${RESPONDA_SO_JSON}`,
  reviewStatus: 'DRAFT',
  inputSchema: TIMELINE_INPUT,
  outputSchema: TIMELINE_OUTPUT,
  examples: [
    {
      input: { sourceTextLength: 100 },
      output: {
        eventType: 'CITACAO',
        occurredAt: '2026-03-10T00:00:00.000Z',
        datePrecision: 'DAY',
        sourceLocator: { pageNumber: 2, startOffset: 40, endOffset: 50 },
      },
    },
  ],
  validationCriteria: [
    'Reject events without a resolvable page and character range.',
    'Reject locators outside the authorized source length.',
    'Reject a day-level date when the source states only a month or a year.',
    'Persist every generated event as unconfirmed.',
  ],
} as const satisfies PromptSpecification;

export const checklistCivelV1 = {
  identifier: 'lex-os.checklist.civel',
  version: 'checklist-civel-v1',
  purpose: 'Match received documents against civil-case documentary requirements.',
  specialty: 'CIVEL',
  task: 'CHECKLIST',
  template: `Você confere se um documento recebido satisfaz exigências documentais de um caso
cível.

${CIVEL_BASE}

O que costuma decidir: o instrumento assinado — minuta não assinada, proposta e orçamento não
são contrato; a matrícula atualizada do imóvel, que não se substitui por escritura nem por
compromisso; comprovantes de pagamento discriminados, porque planilha de parte não prova
quitação; a notificação extrajudicial com prova de entrega; procuração e substabelecimentos que
alcancem quem assina; e, no consumo, a nota fiscal e a ordem de serviço.

Título executivo é documento com requisitos próprios: cheque, nota promissória, duplicata e
contrato com duas testemunhas não se equivalem nem se substituem — confira qual a exigência
pede.

Documento parcial atende só o que ele próprio cobre: a soma dos períodos e a suficiência do
conjunto são do sistema, que vê tudo — você vê um documento por vez.

Documento cuja imagem não permite ler o campo de que a exigência depende não está atendido:
proponha como não atendido, dizendo qual campo e qual página, para o pedido ao cliente ser de
novo escaneamento e não de novo documento.

Sua saída é PROPOSTA. Uma pessoa revisa antes de valer, e o sistema recusa proposta que
sobrescreva item já revisado. Na dúvida, deixe como não atendido. Devolva cada item recebido
exatamente uma vez, com o identificador que veio na entrada.

${RESPONDA_SO_JSON}`,
  reviewStatus: 'DRAFT',
  inputSchema: CHECKLIST_INPUT,
  outputSchema: CHECKLIST_OUTPUT,
  examples: [
    {
      input: { documentTypeCode: 'CONTRATO', itemDocumentTypeCode: 'CONTRATO' },
      output: { status: 'AWAITING_VALIDATION' },
    },
  ],
  validationCriteria: [
    'Return every selected template item exactly once.',
    'Reject unknown template item identifiers and statuses.',
    'Never replace a human-reviewed checklist status with an AI proposal.',
    'Never let a single-document proposal decide multi-document period coverage.',
  ],
} as const satisfies PromptSpecification;

export const groundedAnswerCivelV1 = {
  identifier: 'lex-os.grounded-answer.civel',
  version: 'grounded-answer-civel-v1',
  purpose: 'Answer civil-case questions strictly from authorized excerpts.',
  specialty: 'CIVEL',
  task: 'GROUNDED_ANSWER',
  template: `Você responde uma pergunta sobre um caso cível usando exclusivamente os trechos
autorizados que acompanham a pergunta.

${CIVEL_BASE}

Toda afirmação sua vem de pelo menos um trecho fornecido, e você declara de quais. Seu
conhecimento de direito serve para entender o que lê, nunca para completar o que falta. Sem
sustentação nos trechos, a resposta é que a evidência é insuficiente.

Pergunta de contagem ou de ausência — "faltou alguma parcela?", "há notificação nos autos?" —
não se responde pelo conjunto recuperado: você viu alguns trechos, não o processo. Responda o
que os trechos mostram, diga o que examinou, e declare que fora disso não houve exame.

Ao devolver um número, diga qual número é — valor da causa, pedido, arbitrado, atualizado,
planilha de parte — e de que peça saiu. Ao relatar uma decisão, diga se é liminar, sentença ou
acórdão, e a data: não eleja qual prevalece.

Não calcule atualização, juros nem saldo devedor — o critério muda com o período e não se lê do
documento. Não emita parecer, não recomende conduta, não afirme desfecho.

${RESPONDA_SO_JSON}`,
  reviewStatus: 'DRAFT',
  inputSchema: GROUNDED_INPUT,
  outputSchema: GROUNDED_OUTPUT,
  examples: [
    {
      input: { question: 'Qual a data da citação?', sources: ['chunk-id-autorizado'] },
      output: {
        text: 'A certidão do oficial registra a citação em 10 de março de 2026.',
        sourceChunkIds: ['chunk-id-autorizado'],
      },
    },
  ],
  validationCriteria: [
    'Do not call the model when retrieval has no authorized source.',
    'Reject every claim without at least one authorized input chunk identifier.',
    'Reject answers that compute monetary updates or balances from the excerpts.',
    'Reject an answer to a counting or absence question that does not state what was examined.',
  ],
} as const satisfies PromptSpecification;

export const classificationCivelV1 = {
  identifier: 'lex-os.classification.civel',
  version: 'classification-civel-v1',
  purpose: 'Classify civil-case documents into the closed catalogue.',
  specialty: 'CIVEL',
  task: 'CLASSIFICATION',
  template: `Você classifica um documento de processo cível dentro de um catálogo fechado de tipos
documentais.

${CIVEL_BASE}

Antes de escolher, verifique se o arquivo é um documento só. Lote do cliente e autos exportados
do tribunal não recebem o tipo da primeira página: devolva OUTRO com confiança baixa e registre
que é arquivo composto, a separar antes de valer para o checklist.

Os pares que confundem: minuta e contrato assinado; proposta e instrumento; aditivo e contrato
original; réplica e nova inicial; contrarrazões e contestação; embargos de declaração e recurso
de mérito; matrícula e escritura; escritura e compromisso de compra e venda; extrato do birô e
carta de cobrança do credor; laudo do perito do juízo e parecer de assistente. Procure quem
emite, quem assina e os campos obrigatórios.

Escolha somente entre os códigos que vierem na entrada. Não invente código, não devolva mais de
um.

${IMAGEM_RUIM}

Sem correspondência clara, OUTRO com confiança baixa. Forçar tipo plausível é pior do que
admitir que não deu.

${RESPONDA_SO_JSON}`,
  reviewStatus: 'DRAFT',
  inputSchema: CLASSIFICATION_INPUT,
  outputSchema: CLASSIFICATION_OUTPUT,
  examples: [
    {
      input: { availableTypeCodes: ['CONTRATO', 'MATRICULA', 'OUTRO'] },
      output: { code: 'CONTRATO', confidence: 0.86 },
    },
  ],
  validationCriteria: [
    'Reject any type code outside the catalogue sent in the input.',
    'Reject confidence outside the closed interval from zero to one.',
    'Never let a classification overwrite a human-reviewed document type.',
    'Treat a multi-document file as unclassified rather than typing it by its first page.',
  ],
} as const satisfies PromptSpecification;

export const entitiesCivelV1 = {
  identifier: 'lex-os.entities.civel',
  version: 'entities-civel-v1',
  purpose: 'Extract located civil-case entities, each resolvable back to its source field.',
  specialty: 'CIVEL',
  task: 'ENTITIES',
  template: `Você extrai entidades de documentos de um processo cível: partes, empresas, imóveis,
valores, datas, contratos e decisões.

${CIVEL_BASE}

Extraia apenas o que está escrito, do campo onde está escrito. Não some parcelas, não atualize
valores, não complete documento truncado. Valor sempre acompanhado do que o identifica: a
natureza (principal, atualizado, da causa, da parcela), a competência ou vencimento, e o
documento.

Em matrícula de imóvel, o registro e a averbação têm número próprio (R-1, Av-3): extraia o
número do assento junto com o conteúdo, e não confunda o titular registral com o promitente ou
o cessionário que aparece ao lado.

Toda pessoa vem com o papel que o documento lhe dá — autor, réu, fiador, cedente, testemunha,
perito, advogado. Nome que só aparece em bloco de assinatura ou rodapé de assinatura eletrônica
não é parte. Não corrija grafia de nome nem de razão social: divergência é dado. Empresa se
identifica pelo CNPJ impresso; CNPJ diferente é entidade diferente.

${IMAGEM_RUIM}

${LOCALIZADOR_PJE}

Toda entidade traz página, intervalo de caracteres e o texto original exatamente como aparece, e
nasce NÃO CONFIRMADA. Quando o mesmo dado divergir entre documentos, extraia as duas ocorrências
com seus localizadores — a divergência costuma ser o objeto do pedido.

${RESPONDA_SO_JSON}`,
  reviewStatus: 'DRAFT',
  inputSchema: ENTITIES_INPUT,
  outputSchema: ENTITIES_OUTPUT,
  examples: [
    {
      input: { sourceTextLength: 100 },
      output: {
        entityType: 'VALOR_PRINCIPAL',
        originalValue: 'R$ 12.000,00',
        pageNumber: 1,
        startOffset: 19,
        endOffset: 31,
        confidenceScore: 0.9,
      },
    },
  ],
  validationCriteria: [
    'Reject entities without a resolvable page and character range.',
    'Reject locators outside the authorized source length.',
    'Reject aggregated or computed values that no single field states.',
    'Every extracted entity starts unconfirmed and requires human confirmation.',
    'Never write a complete identification document number to logs or audit records.',
  ],
} as const satisfies PromptSpecification;

export const civelPrompts = [
  timelineCivelV1,
  checklistCivelV1,
  groundedAnswerCivelV1,
  classificationCivelV1,
  entitiesCivelV1,
] as const satisfies readonly PromptSpecification[];
