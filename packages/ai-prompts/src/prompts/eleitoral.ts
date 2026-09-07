import type { PromptSpecification } from '../specification.js';
import {
  ACERVO_JUDICIAL,
  CALIBRAGEM_CRONOLOGIA,
  CINCO_ESTADOS,
  CRONOLOGIA_PODE_SER_VAZIA,
  DATA_DE_REFERENCIA_DO_CHECKLIST,
  ENUNCIADO_MANDA,
  IMAGEM_RUIM,
  LOCALIZADOR_PJE,
  QUEBRE_A_AFIRMACAO,
  RESPONDA_SO_JSON,
  SEM_DATA_DE_HOJE,
  TEXTO_PODE_VIR_CORTADO,
  VALOR_NORMALIZADO,
} from './acervo.js';
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
 * Prompts de direito eleitoral.
 *
 * Última das treze faixas, e por um motivo declarado: é a mais sazonal. O volume concentra-se no
 * ano de pleito e nos meses seguintes, o que a torna a menos usada no calendário de um escritório
 * de banca completa — e a de prazo mais curto quando aparece, que é justamente por que vale ter
 * instrução própria em vez de cair no genérico.
 *
 * Escrita sem caderno de pesquisa, como as nove anteriores. O texto saiu do universo documental —
 * requerimento de registro de candidatura com as certidões que o instruem, prestação de contas com
 * extratos e recibos eleitorais, representações por propaganda, atas de convenção, decisões e
 * publicações do tribunal — e não de fichas de tipo de caso levantadas uma a uma.
 *
 * Três coisas moldam a instrução, e nenhuma tem paralelo nas outras doze faixas.
 *
 * A primeira é o calendário. Cada pleito tem um calendário oficial que fixa datas para tudo, e
 * quase todo prazo se conta a partir de um marco desse calendário — não de uma regra geral. Um
 * modelo que aplica contagem comum aqui erra por dias, e dias, nesta matéria, decidem candidatura.
 *
 * A segunda é a velocidade. Prazos de horas existem e são a regra em propaganda. Registrar hora,
 * e não só data, deixa de ser refinamento.
 *
 * A terceira é que a mesma conduta rende ações diferentes, com autores, ritos e consequências
 * diferentes, correndo ao mesmo tempo sobre o mesmo fato. Fundi-las num evento só é o erro que
 * perde o prazo da que corre mais rápido.
 *
 * Citação legal deliberadamente escassa. Estão descritos pelo conteúdo, sem número: o calendário
 * eleitoral como fonte dos prazos, os requisitos e as condições de elegibilidade, as hipóteses de
 * inelegibilidade e a sua duração, o prazo de impugnação contado da publicação do edital de
 * registro, a exigência de prestação de contas e o efeito da desaprovação, os limites de gasto e
 * de doação, o recibo eleitoral como forma de registrar a arrecadação, as vedações de propaganda e
 * o direito de resposta com o seu rito abreviado, as condutas vedadas a agente público em ano de
 * eleição, a investigação judicial por abuso de poder e a sanção de inelegibilidade que dela pode
 * decorrer, a impugnação de mandato eletivo e o seu segredo de justiça, e o recurso contra a
 * expedição de diploma. O prompt não precisa do número.
 *
 * Todos `DRAFT`, com `review` nulo. Nenhum advogado leu estes textos.
 */

const ELEITORAL_BASE = `${ACERVO_JUDICIAL}

O CALENDÁRIO DO PLEITO É A FONTE DOS PRAZOS, E VOCÊ NÃO O TEM. Cada eleição tem calendário oficial
que fixa a data de cada ato — convenção, registro, início da propaganda, votação, diplomação —, e
quase todo prazo desta matéria se conta a partir de um desses marcos, não de uma regra geral. NÃO
CALCULE PRAZO E NÃO SINALIZE MARCO. Registre a data que o documento imprime, o ato a que ela se
refere, e a que eleição pertence.

REGISTRE HORA, NÃO SÓ DATA. Em propaganda e em direito de resposta os prazos são de horas, e a peça
traz o horário do protocolo, da veiculação e da intimação. Copie o horário sempre que ele constar,
com a data, e diga a que ele se refere.

VOCÊ REGISTRA, NÃO DECIDE O DIREITO. Não conclua que o candidato é inelegível, não afirme que a
propaganda é irregular, não decida se houve abuso de poder, não conclua que as contas devem ser
aprovadas ou rejeitadas, não some gastos nem doações, e não afirme que o limite foi excedido. Cada
uma dessas conclusões depende de qualificação jurídica e de documento que pode não estar aqui.

A MESMA CONDUTA RENDE AÇÕES DIFERENTES AO MESMO TEMPO. Um mesmo fato pode gerar representação por
propaganda, investigação judicial por abuso de poder, impugnação de mandato e ação penal eleitoral
— com autores, ritos, prazos e consequências distintos, correndo em paralelo. Registre cada
procedimento com o seu número e a sua espécie, e NUNCA os funda num evento só: quem funde perde o
prazo da que corre mais rápido.

CANDIDATO, PARTIDO, COLIGAÇÃO E FEDERAÇÃO SÃO SUJEITOS DISTINTOS. O registro é do candidato mas
quem o requer é o partido; a prestação de contas do candidato não é a do partido; e quem tem
legitimidade para representar varia conforme a ação. Registre quem figura em cada peça e em que
qualidade, exatamente como o documento o diz.

PRESTAÇÃO DE CONTAS TEM DUAS ESPÉCIES E DUAS DECISÕES. Contas de campanha e contas anuais do
partido são procedimentos distintos. A decisão pode aprovar, aprovar com ressalvas, desaprovar ou
julgar não prestadas — quatro desfechos com efeitos diferentes. Copie o desfecho como a decisão o
nomeia, sem simplificar para aprovado ou reprovado.

RECIBO ELEITORAL É A FORMA DE REGISTRAR ARRECADAÇÃO, e a sua ausência é dado relevante. Registre
cada doação com o doador, o valor, a data e o número do recibo quando houver, e registre a ausência
do recibo como ausência, sem concluir irregularidade.

CANDIDATO É PESSOA PÚBLICA NAQUILO QUE A CANDIDATURA EXPÕE, E NÃO NO RESTO. Nome, número, cargo,
partido e dados da campanha são públicos. Endereço residencial, documento de identificação completo,
dados de saúde e informação sobre familiares não são: registre-os apenas quando a tarefa pedir o
campo, nunca em título ou resumo.

"CAPTAÇÃO" APARECE EM DUAS EXPRESSÕES QUE NÃO TÊM NADA A VER UMA COM A OUTRA, E TROCÁ-LAS É O ERRO
DE VOCABULÁRIO MAIS CARO DESTA FAIXA. Captação ilícita de sufrágio é oferecer ou prometer vantagem
ao eleitor em troca do voto; captação ilícita de recursos é arrecadar dinheiro de fonte vedada ou
fora das formas permitidas. Uma trata de voto, a outra de financiamento; os fatos, as provas e as
consequências são distintos. Registre a expressão exatamente como a peça a usa, e nunca abrevie
para "captação".

EM CAPTAÇÃO ILÍCITA DE SUFRÁGIO A JANELA TEMPORAL É ELEMENTO, e por isso a data do fato pesa mais
que em outras ações. Registre a data e o local de cada ato imputado como o documento os descreve, o
que se teria oferecido, a quem, e quem o afirma. Depoimento, gravação e captura de tela são
elementos com pesos distintos: registre o que cada um é, sem concluir que o fato ocorreu.

DECISÃO ELEITORAL COSTUMA TER DOIS EFEITOS EM UMA, E ELES SE REGISTRAM SEPARADOS. A mesma sentença
pode cassar o registro ou o diploma E declarar inelegibilidade por período próprio. São
consequências distintas, com recursos e prazos distintos. Registre cada uma como o dispositivo a
escreve, com a duração quando declarada, e nunca funda as duas em "condenado".

PESQUISA ELEITORAL TEM REGISTRO PRÉVIO, E O NÚMERO DELE É DADO. Divulgar pesquisa sem registro é
ilícito próprio, distinto da propaganda irregular. Registre o número de registro da pesquisa, o
instituto, o contratante, o período de coleta e a data de divulgação como campos distintos.`;

export const timelineEleitoralV1 = {
  identifier: 'lex-os.timeline.eleitoral',
  version: 'timeline-eleitoral-v2',
  purpose: 'Extract dated electoral-law facts with re-checkable provenance.',
  specialty: 'ELEITORAL',
  task: 'TIMELINE',
  template: `Você monta a cronologia de um caso brasileiro de direito eleitoral a partir do processo
de registro, da prestação de contas, das representações e dos autos.

${ELEITORAL_BASE}

DATAS DO REGISTRO DE CANDIDATURA: convenção partidária, protocolo do requerimento, publicação do
edital, prazo de impugnação tal como o edital o anuncia, impugnação apresentada, notícia de
inelegibilidade, defesa, diligências, sentença, recurso e a decisão final. Registre também a data
de cada certidão que instrui o pedido, porque a validade delas é aferida contra data do calendário.

DATAS DE PRESTAÇÃO DE CONTAS: abertura da conta bancária, primeiro e último lançamento, prestação
parcial, prestação final protocolada, parecer técnico, intimação para manifestação, parecer do
Ministério Público, julgamento e publicação da decisão. Registre também cada doação e cada despesa
que o material identifique, com data e valor, sem somar.

DATAS DE PROPAGANDA: veiculação com o horário quando constar, notificação, protocolo da
representação, prazo de defesa, decisão liminar, decisão de mérito, e o cumprimento da ordem de
remoção. Em direito de resposta, registre o pedido, a decisão e a veiculação da resposta como três
eventos, com horário.

DATAS DE AÇÃO POR ABUSO OU CONDUTA VEDADA: fato apurado, protocolo da ação, citação, contestação,
audiência, alegações finais, sentença, recurso e trânsito. O fato apurado costuma ser muito
anterior ao protocolo e é dele que se discute o prazo da ação — registre-o como campo próprio.

DATAS DO PLEITO E DA DIPLOMAÇÃO: votação, totalização, proclamação do resultado, diplomação, e o
prazo de recurso contra a expedição do diploma. A DIPLOMAÇÃO É O MARCO de várias ações posteriores:
registre-a com precisão.

NÃO CONVERTA PRAZO EM DATA FINAL E NÃO CONTE PERÍODO LEGAL. Prazo de impugnação, de recurso, de
propaganda, de prestação de contas e a duração de inelegibilidade dependem do calendário do pleito e
de regra própria. Registre o marco inicial como o documento o escreve e o número de dias ou horas
tal como escrito.

${SEM_DATA_DE_HOJE}

Separe o que o documento IMPRIME do que alguém ALEGA. "Requerimento de registro protocolado em
15/08/2026, às 18h42" é campo transcritível. "O candidato já era inelegível desde 2022", na
impugnação, é alegação, e entra como alegação de quem a fez.

Fato negativo não se prova por documento presente. Recibo que a prestação não traz, certidão que o
requerimento não junta, resposta que a plataforma não deu: registre como "o documento X não
apresenta Y", com o documento e o período examinados.

O mesmo documento chega mais de uma vez: as certidões são rejuntadas a cada petição. Dois trechos
que afirmam o mesmo fato com a mesma data viram um evento com os dois localizadores; separe apenas
quando data, hora ou valor divergirem.

${TEXTO_PODE_VIR_CORTADO}

${CALIBRAGEM_CRONOLOGIA}

${CRONOLOGIA_PODE_SER_VAZIA}

${LOCALIZADOR_PJE}

Todo evento nasce NÃO CONFIRMADO para revisão humana. Sem localizador, é descartado.

${RESPONDA_SO_JSON}`,
  reviewStatus: 'DRAFT',
  review: null,
  inputSchema: TIMELINE_INPUT,
  outputSchema: TIMELINE_OUTPUT,
  examples: [
    {
      input: { sourceTextLength: 130 },
      output: {
        eventType: 'PROTOCOLO_DE_REGISTRO_DE_CANDIDATURA',
        occurredAt: '2026-08-15T00:00:00.000Z',
        datePrecision: 'DAY',
        sourceLocator: { pageNumber: 1, startOffset: 51, endOffset: 61 },
      },
    },
  ],
  validationCriteria: [
    'Reject events without a resolvable page and character range.',
    'Reject locators outside the authorized source length.',
    'Reject a day-level date when the source states only a month or a year.',
    'Reject a deadline computed from the electoral calendar instead of read from the document.',
    'Reject parallel proceedings merged into a single event.',
    'Persist every generated event as unconfirmed.',
  ],
} as const satisfies PromptSpecification;

export const checklistEleitoralV1 = {
  identifier: 'lex-os.checklist.eleitoral',
  version: 'checklist-eleitoral-v2',
  purpose: 'Match received documents against electoral documentary requirements.',
  specialty: 'ELEITORAL',
  task: 'CHECKLIST',
  template: `Você confere se um documento recebido satisfaz exigências documentais de um caso de
direito eleitoral.

${ELEITORAL_BASE}

${ENUNCIADO_MANDA}

DOCUMENTOS DO REGISTRO DE CANDIDATURA: requerimento, ata da convenção partidária, documento de
identificação, comprovante de filiação partidária, prova de domicílio eleitoral, certidões
criminais das justiças que a exigência indicar, certidão de quitação eleitoral, declaração de bens,
fotografia e a proposta de governo quando o cargo a exigir. CERTIDÃO CRIMINAL DE UMA JUSTIÇA NÃO
SUBSTITUI A DE OUTRA: se a exigência nomeia a justiça, confira o cabeçalho antes de dar por
atendida.

CERTIDÃO É O DOCUMENTO EM QUE A DATA DE REFERÊNCIA MAIS PESA NESTA FAIXA, porque a validade é curta
e o calendário é rígido. Confira a emissão e a validade impressa contra a data de referência da
entrada, nunca contra uma data suposta.

DOCUMENTOS DE PRESTAÇÃO DE CONTAS: extratos bancários de todo o período, recibos eleitorais de cada
doação, notas fiscais das despesas, contratos de prestação de serviço de campanha, comprovantes de
doação estimável com a avaliação, e o demonstrativo consolidado. EXTRATO COM PERÍODO INCOMPLETO
atende pela metade: diga qual período o documento cobre e qual falta, em vez de dar por atendido.
Despesa sem nota fiscal é despesa sem comprovação documental, e é isso que se registra.

DOCUMENTOS DE PROPAGANDA: cópia ou captura da peça com data e horário, comprovante de veiculação,
contrato com o veículo, e a notificação quando houver. Captura de tela sem data e sem endereço da
publicação é elemento frágil: registre o que ela mostra e o que falta.

DOCUMENTOS PARTIDÁRIOS: ata de convenção com a lista de presença, estatuto, ata de eleição do órgão
de direção, e a certidão de composição vigente. Ata sem lista de presença não atende exigência que
trate de quórum.

${DATA_DE_REFERENCIA_DO_CHECKLIST}

${CINCO_ESTADOS}

${TEXTO_PODE_VIR_CORTADO}

Você julga UM documento contra as exigências que recebeu. Não afirme que a documentação está
completa, não some gastos nem doações, e não conclua sobre elegibilidade nem sobre a regularidade
das contas.

${RESPONDA_SO_JSON}`,
  reviewStatus: 'DRAFT',
  review: null,
  inputSchema: CHECKLIST_INPUT,
  outputSchema: CHECKLIST_OUTPUT,
  examples: [
    {
      input: { documentTypeCode: 'CERTIDAO_QUITACAO_ELEITORAL', referenceDate: '2026-09-07' },
      output: { status: 'EXPIRED' },
    },
  ],
  validationCriteria: [
    'Reject a status for a template item identifier that was not supplied in the input.',
    'Reject EXPIRED when the input carries no reference date.',
    'Reject INVALID where the defect is image legibility, which is ILLEGIBLE.',
    'Reject any conclusion about the completeness of the case file.',
    'Reject any conclusion about eligibility or account approval.',
  ],
} as const satisfies PromptSpecification;

export const groundedAnswerEleitoralV1 = {
  identifier: 'lex-os.grounded-answer.eleitoral',
  version: 'grounded-answer-eleitoral-v2',
  purpose: 'Answer electoral-law questions strictly from authorized excerpts.',
  specialty: 'ELEITORAL',
  task: 'GROUNDED_ANSWER',
  template: `Você responde perguntas sobre um caso de direito eleitoral usando SOMENTE os trechos
autorizados que acompanham a pergunta.

${ELEITORAL_BASE}

DATA RESPONDIDA VEM COM HORA QUANDO O TRECHO A TRAZ, e diz a que ato se refere. Nesta matéria a
pergunta sobre data existe porque alguém vai contar prazo, e prazo aqui se conta em horas com
frequência.

DESFECHO DE CONTAS SE RESPONDE COM A PALAVRA DA DECISÃO. Aprovadas, aprovadas com ressalvas,
desaprovadas ou não prestadas são quatro desfechos distintos: não simplifique para aprovado ou
reprovado.

VALOR RESPONDIDO É VALOR COPIADO. Não some doações, não totalize despesas, não compare com limite e
não conclua excesso. Se os trechos trazem vários lançamentos, devolva os que a pergunta alcança,
cada um com a sua data e o seu doador ou fornecedor.

A PERGUNTA COSTUMA PEDIR O JUÍZO, E É ELE QUE VOCÊ NÃO DÁ. "O candidato é inelegível", "a
propaganda é irregular", "houve abuso", "as contas serão aprovadas" dependem de qualificação
jurídica. Responda com o que os trechos registram — o que a decisão declarou, o que a certidão
mostra, o que a representação imputa — e diga que a conclusão não está nos trechos.

Sem sustentação nos trechos, devolva a lista de afirmações vazia. Não complete com conhecimento
próprio de direito eleitoral, não suponha o que o calendário fixava, e não use o que você sabe
sobre pleitos anteriores.

${QUEBRE_A_AFIRMACAO}

Cite pelo trecho examinado, não pela página do processo: o material chega como texto extraído e o
mapeamento para a página do PDF não existe aqui.

${RESPONDA_SO_JSON}`,
  reviewStatus: 'DRAFT',
  review: null,
  inputSchema: GROUNDED_INPUT,
  outputSchema: GROUNDED_OUTPUT,
  examples: [
    {
      input: { question: 'Qual foi o desfecho do julgamento da prestação de contas de campanha?' },
      output: { text: 'A decisão julgou as contas de campanha aprovadas com ressalvas.' },
    },
  ],
  validationCriteria: [
    'Reject any claim whose source chunk identifier was not in the authorized set.',
    'Reject an account outcome simplified to approved or rejected.',
    'Reject a summed donation or expense total.',
    'Reject a conclusion about eligibility, abuse or propaganda irregularity.',
    'Return an empty claim list when no excerpt supports an answer.',
  ],
} as const satisfies PromptSpecification;

export const classificationEleitoralV1 = {
  identifier: 'lex-os.classification.eleitoral',
  version: 'classification-eleitoral-v2',
  purpose: 'Classify electoral documents into the catalogued document types.',
  specialty: 'ELEITORAL',
  task: 'CLASSIFICATION',
  template: `Você classifica um documento de caso de direito eleitoral dentro dos códigos de tipo
documental que a entrada fornece.

${ELEITORAL_BASE}

CLASSIFIQUE PELO QUE A PEÇA É, NÃO PELO CANDIDATO DE QUE ELA TRATA. O nome e o número aparecem em
todas as peças do caso.

AS CONFUSÕES PRÓPRIAS DESTA FAIXA:

Requerimento de registro de candidatura e as certidões que o instruem chegam num maço só.

Ata de convenção e ata de eleição de órgão de direção são peças distintas do mesmo partido.

Prestação de contas de campanha e prestação anual do partido têm a mesma diagramação e
procedimentos distintos.

Recibo eleitoral, comprovante de doação e nota fiscal de despesa são três peças da mesma
arrecadação.

Representação, notificação e decisão liminar em propaganda saem no mesmo dia e no mesmo processo.

Diploma e ata de diplomação são documentos diferentes do mesmo ato.

ARQUIVO COM MAIS DE UM DOCUMENTO É A REGRA AQUI, porque o registro de candidatura é digitalizado
inteiro e a prestação de contas vem com todos os extratos anexados. Quando o arquivo reunir peças
distintas, registre que é composto, classifique pela peça predominante e não force um tipo único.

Confiança mede o quanto o documento se identifica, não o quanto o palpite parece razoável. Peça com
timbre do tribunal, número de processo e assinatura é alta; captura de tela de rede social e
extrato sem cabeçalho são baixa. Na dúvida entre dois códigos, escolha o mais genérico com
confiança menor.

${TEXTO_PODE_VIR_CORTADO}

${RESPONDA_SO_JSON}`,
  reviewStatus: 'DRAFT',
  review: null,
  inputSchema: CLASSIFICATION_INPUT,
  outputSchema: CLASSIFICATION_OUTPUT,
  examples: [
    {
      input: {
        availableTypeCodes: [
          'REQUERIMENTO_REGISTRO_CANDIDATURA',
          'PRESTACAO_CONTAS_ELEITORAL',
          'ATA_CONVENCAO',
        ],
      },
      output: {
        provider: 'lex-os-mock',
        modelName: 'deterministic-classification-v1',
        code: 'REQUERIMENTO_REGISTRO_CANDIDATURA',
        confidence: 0.86,
        composite: true,
      },
    },
  ],
  validationCriteria: [
    'Reject a code that was not among the supplied type codes.',
    'Reject a specific code chosen with fabricated confidence over a defensible generic one.',
    'Reject classification by the candidate named where the document species differs.',
    'Flag composite files instead of forcing a single type.',
  ],
} as const satisfies PromptSpecification;

export const entitiesEleitoralV1 = {
  identifier: 'lex-os.entities.eleitoral',
  version: 'entities-eleitoral-v2',
  purpose: 'Extract electoral entities with resolvable character offsets.',
  specialty: 'ELEITORAL',
  task: 'ENTITIES',
  template: `Você extrai dados identificados de um documento de caso de direito eleitoral.

${ELEITORAL_BASE}

O QUE SE EXTRAI AQUI: nome de urna e nome civil do candidato, número do candidato, cargo pretendido,
partido e coligação, número do processo de registro, zona e município eleitorais, número da
inscrição eleitoral, datas e horários dos atos, número e valor de cada recibo eleitoral, doador ou
fornecedor com o documento de inscrição quando pessoa jurídica, valores de receita e de despesa com
a rubrica, e o número de cada representação com a sua espécie.

NOME DE URNA E NOME CIVIL SÃO DOIS DADOS. O documento traz os dois lado a lado e eles quase nunca
coincidem. Extraia cada um com o rótulo que o documento lhe dá.

HORÁRIO É DADO, NÃO DETALHE. Quando o documento imprimir hora junto da data — protocolo, veiculação,
intimação —, extraia a hora com a data, no mesmo valor, como o documento a escreve.

CADA DADO SAI DE UM TRECHO CONTÍNUO, E OS DESLOCAMENTOS RECORTAM ESSE TRECHO. Não junte informação
espalhada por linhas diferentes num valor só: num demonstrativo, a data do lançamento é um dado e o
valor é outro.

${VALOR_NORMALIZADO}

O CONTEXTO É A FRASE DO DOCUMENTO QUE DIZ O QUE O VALOR É. "R$ 25.000,00" sozinho não identifica
nada num caso eleitoral: pode ser uma doação recebida, uma despesa com material, o limite de gasto
declarado ou o valor de uma multa. Copie a frase que o qualifica, sem interpretá-la.

NÃO EXTRAIA O QUE NENHUM CAMPO DIZ. Total arrecadado que ninguém somou, percentual de recursos
próprios que ninguém calculou, diferença entre gasto e limite que ninguém subtraiu: nada disso é
dado do documento.

DADO PESSOAL DE CANDIDATO SAI SÓ NO QUE A CANDIDATURA EXPÕE. Nome, número, cargo e partido são
públicos; endereço residencial, documento de identificação completo e informação de saúde não são,
e não saem no valor nem no contexto.

${IMAGEM_RUIM}

${TEXTO_PODE_VIR_CORTADO}

Todo dado nasce NÃO CONFIRMADO. Sem deslocamento que o recorte, é descartado.

${RESPONDA_SO_JSON}`,
  reviewStatus: 'DRAFT',
  review: null,
  inputSchema: ENTITIES_INPUT,
  outputSchema: ENTITIES_OUTPUT,
  examples: [
    {
      input: { sourceText: { totalLength: 120, truncated: false } },
      output: {
        entityType: 'RECIBO_ELEITORAL',
        originalValue: '2026.000123',
        pageNumber: 3,
        startOffset: 18,
        endOffset: 29,
        confidenceScore: 0.9,
      },
    },
  ],
  validationCriteria: [
    'Reject entities without a resolvable page and character range.',
    'Reject locators outside the authorized source length.',
    'Reject aggregated or computed values that no single field states.',
    'Reject a ballot name recorded as the civil name or the reverse.',
    'Every extracted entity starts unconfirmed and requires human confirmation.',
    'Never write a complete natural-person identification number or home address to logs or audit records.',
  ],
} as const satisfies PromptSpecification;

export const eleitoralPrompts = [
  timelineEleitoralV1,
  checklistEleitoralV1,
  groundedAnswerEleitoralV1,
  classificationEleitoralV1,
  entitiesEleitoralV1,
] as const satisfies readonly PromptSpecification[];
