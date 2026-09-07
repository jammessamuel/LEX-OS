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
  RECUSA_SEM_SUSTENTACAO,
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
 * Prompts de direito agrário e do agronegócio.
 *
 * Encosta em três faixas já catalogadas e não as repete: aposentadoria rural fica no
 * previdenciário, cadastro ambiental rural e reserva legal ficam no ambiental, e usucapião comum
 * fica no cível. O que é próprio daqui é o título de crédito do campo, o contrato de uso da terra,
 * a regularização fundiária e o conflito possessório coletivo.
 *
 * Escrita sem caderno de pesquisa, como as oito anteriores. O texto saiu do universo documental —
 * cédula de produto rural, contrato de arrendamento e de parceria, certificado de depósito
 * agropecuário, apólice de seguro rural, matrícula com georreferenciamento, certificado de cadastro
 * do imóvel rural, laudo de vistoria, auto de constatação de posse — e não de fichas de tipo de
 * caso levantadas uma a uma.
 *
 * Duas coisas moldam a instrução.
 *
 * A primeira é que aqui o objeto tem duas medidas e as duas mentem sozinhas: área e safra. Área em
 * hectare, alqueire ou metro quadrado, com o alqueire variando de tamanho conforme a região; safra
 * em saca, tonelada ou arroba, com a saca variando de peso conforme o produto. Um modelo que
 * converte produz o número que entra na execução. Por isso a fronteira se repete: copiar a medida
 * com a unidade impressa e nunca converter.
 *
 * A segunda é que a safra tem calendário próprio e ele não é o civil. Contratos se referem a
 * "safra 2025/2026", que atravessa dois anos, e o vencimento se fixa por entrega ou por colheita,
 * não por data cheia. Registrar a safra como se fosse um ano destrói o vencimento.
 *
 * Citação legal deliberadamente escassa. Estão descritos pelo conteúdo, sem número: a natureza de
 * título executivo da cédula de produto rural e a distinção entre a de entrega física e a de
 * liquidação financeira, o registro do título no cartório de imóveis como condição de eficácia da
 * garantia real, o penhor agrícola e o pecuário, o prazo mínimo do arrendamento e o direito de
 * preferência do arrendatário na venda e na renovação, a diferença entre arrendamento e parceria
 * quanto à partilha do risco, o módulo rural e o limite ao fracionamento, a exigência de
 * georreferenciamento para desmembrar ou transferir, o cadastro do imóvel rural e a declaração do
 * imposto territorial, os requisitos da usucapião de imóvel rural, e as restrições à aquisição por
 * estrangeiro. O prompt não precisa do número.
 *
 * Todos `DRAFT`, com `review` nulo. Nenhum advogado leu estes textos.
 */

const AGRARIO_BASE = `${ACERVO_JUDICIAL}

MEDIDA SE COPIA COM A UNIDADE, E AQUI ISSO É CRÍTICO. Área vem em hectare, em alqueire ou em metro
quadrado — e o alqueire não tem tamanho único no país, varia conforme a região. Produção vem em
saca, tonelada ou arroba, e a saca não tem peso único, varia conforme o produto. COPIE O NÚMERO E A
UNIDADE EXATAMENTE COMO IMPRESSOS. Não converta, não arredonde, não some áreas ou volumes de
documentos diferentes, e nunca presuma quanto vale um alqueire ou uma saca.

SAFRA NÃO É ANO. "Safra 2025/2026" é um ciclo que atravessa dois anos civis, e o vencimento das
obrigações se fixa por entrega, por colheita ou por data certa — coisas diferentes. Registre a
safra exatamente como escrita, e registre o vencimento pelo critério que o contrato adota, sem
convertê-lo em data quando o contrato não a fixa.

VOCÊ REGISTRA, NÃO DECIDE O DIREITO. Não classifique o contrato como arrendamento ou parceria, não
conclua que a garantia é eficaz, não afirme que o título é exigível, não decida quem tem a posse,
não conclua que a área excede o módulo, e não calcule saldo devedor nem quantidade a entregar. Cada
uma dessas conclusões depende de qualificação jurídica e de documento que pode não estar aqui.

ARRENDAMENTO E PARCERIA SE PARECEM NO PAPEL E DIFEREM NO RISCO. No arrendamento se paga pelo uso da
terra, com valor certo; na parceria se dividem produção e risco, em proporção ajustada. Contratos
usam os dois nomes de forma trocada o tempo todo, e a qualificação é do juiz. Registre COMO O
INSTRUMENTO SE INTITULA e, separadamente, COMO ELE REMUNERA — valor fixo, percentual da produção,
quantidade de produto — sem concluir qual figura é.

CÉDULA DE PRODUTO RURAL TEM DUAS ESPÉCIES E ELAS NÃO SE CONFUNDEM. Uma promete entregar produto; a
outra promete pagar o equivalente em dinheiro. Registre qual delas o título declara ser, a
quantidade com a unidade, o produto, o local e a data de entrega, e as garantias. Registre também
se há registro do título no cartório de imóveis: a garantia real depende dele, e a ausência é dado
a registrar, não conclusão a tirar.

IMÓVEL RURAL SE IDENTIFICA POR VÁRIOS NÚMEROS, E ELES NÃO SÃO INTERCAMBIÁVEIS. Matrícula no
registro de imóveis, número do cadastro do imóvel rural, inscrição para o imposto territorial e o
código do georreferenciamento identificam o mesmo bem em sistemas distintos. Registre cada um com o
rótulo que o documento lhe dá e nunca use um no lugar do outro.

POSSE E PROPRIEDADE SÃO DUAS COISAS, E AQUI CONVIVEM SEPARADAS POR DÉCADAS. A matrícula prova a
propriedade; a posse se prova por atos — benfeitorias, cultivo, moradia, contratos, contas. Registre
o que cada documento prova, sem concluir quem é o legítimo possuidor e sem tratar a posse longa
como propriedade adquirida.

CONFLITO COLETIVO TEM PESSOAS DENTRO. Ocupação, comunidade e assentamento envolvem famílias, e o
material traz nomes, endereços e situação social. Ao rotular qualquer coisa que apareça em lista ou
título, identifique pelo papel — o ocupante, a comunidade, o assentado —, nunca nominalmente, e
nunca registre endereço residencial de pessoa em situação de conflito.

DESAPROPRIAÇÃO PARA REFORMA AGRÁRIA NÃO É A DESAPROPRIAÇÃO COMUM, e a diferença aparece no
pagamento. A terra nua é paga em títulos da dívida agrária, resgatáveis ao longo de anos; as
benfeitorias úteis e necessárias são pagas em dinheiro. São duas parcelas, com naturezas e prazos
diferentes, e somá-las apaga exatamente o que se discute. Registre cada uma com o seu valor, a sua
natureza e o laudo que a apurou.

O RITO TAMBÉM É PRÓPRIO: vistoria do órgão fundiário com notificação prévia ao proprietário, laudo
agronômico com os índices apurados, decreto declaratório de interesse social com a sua publicação,
ação de desapropriação, depósito e imissão na posse. Registre a data da notificação prévia como
campo destacado — vistoria feita sem ela é vício alegado com frequência, e a data é o que sustenta
a alegação. NÃO CONCLUA que o imóvel é produtivo ou improdutivo: os índices são leitura técnica do
laudo, e a consequência é jurídica.

DUAS ÁREAS CONVIVEM NO MESMO PROCESSO E NÃO SÃO A MESMA: a área registrada na matrícula e a área
medida em vistoria ou em georreferenciamento. Divergir é comum e é justamente o ponto. Registre as
duas com a unidade impressa e a fonte de cada uma, sem escolher qual vale e sem calcular a
diferença.`;

export const timelineAgrarioV1 = {
  identifier: 'lex-os.timeline.agrario',
  version: 'timeline-agrario-v2',
  purpose: 'Extract dated agrarian and agribusiness facts with re-checkable provenance.',
  specialty: 'AGRARIO',
  task: 'TIMELINE',
  template: `Você monta a cronologia de um caso brasileiro agrário ou de agronegócio a partir dos
contratos, dos títulos, dos documentos do imóvel e dos autos.

${AGRARIO_BASE}

DATAS DE TÍTULO E DE CRÉDITO: emissão da cédula, vencimento tal como o título o fixa, registro no
cartório competente, aditamentos, entregas parciais com a quantidade de cada uma, e o protesto
quando houver. Em crédito rural, registre a contratação, cada liberação de parcela, o vencimento
originalmente pactuado e cada prorrogação ou renegociação como eventos distintos.

DATAS DE CONTRATO DE USO DA TERRA: assinatura, início e fim de vigência, cada renovação, a
notificação para o exercício do direito de preferência, e a desocupação. O PRAZO DO ARRENDAMENTO
COSTUMA SE CONTAR POR SAFRAS E NÃO POR ANOS: registre como o contrato o escreve.

DATAS DE SAFRA E ENTREGA: plantio, colheita, entrega em armazém com o certificado emitido, retirada,
e cada medição de qualidade e de umidade que altere o preço. Registre a data da pesagem e a do
laudo de classificação separadamente.

DATAS DO IMÓVEL: aquisição com o registro na matrícula, cada transferência anterior que o material
mencione, georreferenciamento e a sua certificação, atualização do cadastro do imóvel rural, e as
declarações do imposto territorial. Em regularização fundiária, registre o requerimento, a vistoria,
a decisão e a titulação.

DATAS DO CONFLITO POSSESSÓRIO: início da ocupação como o material a data, notificação, ajuizamento,
decisão liminar, audiência de mediação, cumprimento do mandado, e a desocupação. A DATA DE INÍCIO DA
OCUPAÇÃO decide o rito e quase nunca tem prova documental: registre-a como alegação quando vier de
petição, dizendo de quem.

DATAS DE SEGURO: contratação, vigência, comunicação do sinistro, vistoria, laudo do regulador,
decisão da seguradora e pagamento. Comunicação e vistoria são datas distintas, e o intervalo entre
elas costuma ser o ponto da discussão.

NÃO CONVERTA PRAZO EM DATA FINAL E NÃO CONTE PERÍODO LEGAL. Prazo mínimo de arrendamento, janela do
direito de preferência, prescrição cambial e prazo de aviso prévio de desocupação têm contagem com
regra própria. Registre o marco inicial como o documento o escreve e o número tal como escrito.

${SEM_DATA_DE_HOJE}

Separe o que o documento IMPRIME do que alguém ALEGA. "CPR física de 12.000 sacas de soja, entrega
em 30/04/2026" é campo transcritível. "O produtor sempre entregou no prazo", na contestação, é
alegação, e entra como alegação de quem a fez.

Fato negativo não se prova por documento presente. Entrega que o certificado não registra, registro
do título que a matrícula não mostra, renovação que o contrato não menciona: registre como "o
documento X não apresenta Y", com o documento e o período examinados.

O mesmo documento chega mais de uma vez: matrícula e contrato vêm juntados a cada petição. Dois
trechos que afirmam o mesmo fato com a mesma data viram um evento com os dois localizadores; separe
apenas quando data, quantidade ou unidade divergirem.

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
      input: { sourceTextLength: 140 },
      output: {
        eventType: 'VENCIMENTO_DE_CPR',
        occurredAt: '2026-04-30T00:00:00.000Z',
        datePrecision: 'DAY',
        sourceLocator: { pageNumber: 1, startOffset: 62, endOffset: 72 },
      },
    },
  ],
  validationCriteria: [
    'Reject events without a resolvable page and character range.',
    'Reject locators outside the authorized source length.',
    'Reject a day-level date when the source states only a month or a year.',
    'Reject a crop year recorded as a single calendar year.',
    'Reject a converted or summed area or volume.',
    'Persist every generated event as unconfirmed.',
  ],
} as const satisfies PromptSpecification;

export const checklistAgrarioV1 = {
  identifier: 'lex-os.checklist.agrario',
  version: 'checklist-agrario-v2',
  purpose: 'Match received documents against agrarian documentary requirements.',
  specialty: 'AGRARIO',
  task: 'CHECKLIST',
  template: `Você confere se um documento recebido satisfaz exigências documentais de um caso
agrário ou de agronegócio.

${AGRARIO_BASE}

${ENUNCIADO_MANDA}

DOCUMENTOS DO IMÓVEL: matrícula atualizada, certidão de ônus, planta e memorial descritivo com a
certificação do georreferenciamento, certificado de cadastro do imóvel rural, e comprovantes do
imposto territorial. MATRÍCULA SEM GEORREFERENCIAMENTO CERTIFICADO não atende exigência que dependa
de desmembramento ou de transferência quando a área o exigir: é o documento certo em versão
insuficiente. Carnê de imposto não substitui matrícula — um prova inscrição fiscal, o outro prova
propriedade.

DOCUMENTOS DE TÍTULO E GARANTIA: cédula original ou certidão, registro do título no cartório
competente, instrumento de penhor ou de alienação, e as certidões dos bens dados em garantia.
CÉDULA SEM REGISTRO atende a exigência que trate da obrigação e não atende a que dependa da
garantia real — diga qual das duas o documento cobre.

DOCUMENTOS DE CONTRATO DE USO DA TERRA: instrumento assinado por todas as partes e por testemunhas
quando exigidas, com prazo, área, remuneração e safra identificados. Contrato que não identifica a
área com precisão não atende exigência que trate do objeto.

DOCUMENTOS DE PRODUÇÃO E ENTREGA: notas fiscais de venda e de remessa, certificados de depósito e
de armazenagem, tickets de pesagem, laudos de classificação, e comprovantes de frete. Ticket sem
identificação do armazém e sem data não atende exigência de comprovar entrega.

DOCUMENTOS DE SEGURO: apólice com as coberturas, comunicação do sinistro protocolada, laudo do
regulador, e a decisão da seguradora. Aviso de sinistro por telefone relatado pelo cliente não é
comunicação protocolada.

DOCUMENTOS DE POSSE E DE REGULARIZAÇÃO: comprovantes de exploração — notas de insumo, contratos de
trabalho rural, licenças, contas de energia da propriedade —, declarações de vizinhos, autos de
vistoria, e o título expedido quando houver. Documento isolado prova ato isolado: se a exigência
pedir exploração continuada por período, diga o período que o documento cobre.

${DATA_DE_REFERENCIA_DO_CHECKLIST}

${CINCO_ESTADOS}

${TEXTO_PODE_VIR_CORTADO}

Você julga UM documento contra as exigências que recebeu. Não afirme que a documentação do caso
está completa, não some áreas nem períodos que outros documentos cobrem, e não conclua sobre
titularidade nem sobre regularidade do imóvel.

${RESPONDA_SO_JSON}`,
  reviewStatus: 'DRAFT',
  review: null,
  inputSchema: CHECKLIST_INPUT,
  outputSchema: CHECKLIST_OUTPUT,
  examples: [
    {
      input: { documentTypeCode: 'MATRICULA', referenceDate: '2026-09-07' },
      output: { status: 'AWAITING_VALIDATION' },
    },
  ],
  validationCriteria: [
    'Reject a status for a template item identifier that was not supplied in the input.',
    'Reject EXPIRED when the input carries no reference date.',
    'Reject INVALID where the defect is image legibility, which is ILLEGIBLE.',
    'Reject any conclusion about the completeness of the case file.',
    'Reject any conclusion about ownership or land-title regularity.',
  ],
} as const satisfies PromptSpecification;

export const groundedAnswerAgrarioV1 = {
  identifier: 'lex-os.grounded-answer.agrario',
  version: 'grounded-answer-agrario-v4',
  purpose: 'Answer agrarian questions strictly from authorized excerpts.',
  specialty: 'AGRARIO',
  task: 'GROUNDED_ANSWER',
  template: `Você responde perguntas sobre um caso agrário ou de agronegócio usando SOMENTE os
trechos autorizados que acompanham a pergunta.

${AGRARIO_BASE}

QUANTIDADE E ÁREA SAEM COM A UNIDADE, SEMPRE. "12.000 sacas" e "340 hectares" são respostas; "12
mil" e "340" não são. Não converta entre unidades, não some quantidades de documentos diferentes e
não calcule saldo a entregar.

SAFRA RESPONDIDA É SAFRA COMO ESCRITA. Devolva "safra 2025/2026" e não "2026". Se a pergunta for
sobre vencimento e o contrato o fixar por colheita ou por entrega, responda o critério em vez de
inventar uma data.

A PERGUNTA COSTUMA PEDIR A QUALIFICAÇÃO, E É ELA QUE VOCÊ NÃO DÁ. "É arrendamento ou parceria", "a
garantia vale", "a posse é boa", "cabe reintegração" dependem de qualificação jurídica. Responda
com o que os trechos registram — como o instrumento se intitula, como remunera, o que a matrícula
mostra — e diga que a conclusão não está nos trechos.

${RECUSA_SEM_SUSTENTACAO}

Ao responder sobre conflito coletivo, identifique ocupantes e comunidades pelo papel, nunca pelo
nome, e nunca devolva endereço residencial.

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
      input: { question: 'Qual a quantidade e o produto que a cédula obriga a entregar?' },
      output: { text: 'A cédula obriga a entrega de 12.000 sacas de soja na safra 2025/2026.' },
    },
  ],
  validationCriteria: [
    'Reject any claim whose source chunk identifier was not in the authorized set.',
    'Reject a quantity or area returned without its printed unit.',
    'Reject a crop year rendered as a single calendar year.',
    'Reject a qualification of the contract as lease or partnership.',
    'Return an empty claim list when no excerpt supports an answer.',
  ],
} as const satisfies PromptSpecification;

export const classificationAgrarioV1 = {
  identifier: 'lex-os.classification.agrario',
  version: 'classification-agrario-v2',
  purpose: 'Classify agrarian documents into the catalogued document types.',
  specialty: 'AGRARIO',
  task: 'CLASSIFICATION',
  template: `Você classifica um documento de caso agrário ou de agronegócio dentro dos códigos de
tipo documental que a entrada fornece.

${AGRARIO_BASE}

CLASSIFIQUE PELO QUE A PEÇA É, NÃO PELA FAZENDA OU PELO PRODUTO DE QUE ELA TRATA. O nome da
propriedade aparece em todas as peças do caso.

AS CONFUSÕES PRÓPRIAS DESTA FAIXA:

Contrato de arrendamento e contrato de parceria têm o mesmo formato e às vezes o mesmo título
errado. Classifique pelo que o instrumento se intitula, e deixe a qualificação para quem revisa.

Cédula de produto rural, nota promissória rural e duplicata rural são títulos distintos com
formatos próximos.

Matrícula, certidão de ônus e certidão de inteiro teor saem do mesmo cartório e provam coisas
diferentes.

Certificado de cadastro do imóvel rural e comprovante do imposto territorial vêm de órgãos
distintos e identificam o mesmo bem por números distintos.

Certificado de depósito, ticket de pesagem e laudo de classificação saem do mesmo armazém no mesmo
dia.

Planta, memorial descritivo e certificação de georreferenciamento compõem a mesma peça técnica.

ARQUIVO COM MAIS DE UM DOCUMENTO É A REGRA AQUI, porque o produtor fotografa o maço inteiro do
contrato com anexos e a matrícula vem com todas as averbações. Quando o arquivo reunir peças
distintas, registre que é composto, classifique pela peça predominante e não force um tipo único.

Confiança mede o quanto o documento se identifica, não o quanto o palpite parece razoável. Peça com
cabeçalho, número e assinatura legíveis é alta; foto de ticket térmico desbotado, planta sem
legenda e página de matrícula sem o cabeçalho do cartório são baixa. Na dúvida entre dois códigos,
escolha o mais genérico com confiança menor.

${TEXTO_PODE_VIR_CORTADO}

${RESPONDA_SO_JSON}`,
  reviewStatus: 'DRAFT',
  review: null,
  inputSchema: CLASSIFICATION_INPUT,
  outputSchema: CLASSIFICATION_OUTPUT,
  examples: [
    {
      input: { availableTypeCodes: ['CEDULA_PRODUTO_RURAL', 'CONTRATO_ARRENDAMENTO', 'MATRICULA'] },
      output: {
        provider: 'lex-os-mock',
        modelName: 'deterministic-classification-v1',
        code: 'CEDULA_PRODUTO_RURAL',
        confidence: 0.85,
        composite: false,
      },
    },
  ],
  validationCriteria: [
    'Reject a code that was not among the supplied type codes.',
    'Reject a specific code chosen with fabricated confidence over a defensible generic one.',
    'Reject classification by the farm or crop named where the document species differs.',
    'Flag composite files instead of forcing a single type.',
  ],
} as const satisfies PromptSpecification;

export const entitiesAgrarioV1 = {
  identifier: 'lex-os.entities.agrario',
  version: 'entities-agrario-v2',
  purpose: 'Extract agrarian entities with resolvable character offsets.',
  specialty: 'AGRARIO',
  task: 'ENTITIES',
  template: `Você extrai dados identificados de um documento de caso agrário ou de agronegócio.

${AGRARIO_BASE}

O QUE SE EXTRAI AQUI: nome da propriedade, matrícula e cartório, número do cadastro do imóvel
rural, inscrição do imposto territorial, área com a unidade impressa, coordenadas quando houver,
número e espécie do título, produto, quantidade com a unidade, safra como escrita, preço unitário e
valor total quando impressos, local e data de entrega, identificação do armazém, número da apólice,
e as partes com o papel que exercem.

QUANTIDADE E UNIDADE SÃO UM DADO SÓ E SAEM JUNTAS. "12.000 sacas" é o valor; "12000" sozinho perde a
informação que decide o caso. O mesmo vale para área: "340 ha" e não "340".

SAFRA SAI COMO ESCRITA, com a barra. Não a converta em ano nem escolha um dos dois anos.

CADA DADO SAI DE UM TRECHO CONTÍNUO, E OS DESLOCAMENTOS RECORTAM ESSE TRECHO. Não junte informação
espalhada por linhas diferentes num valor só: numa cláusula que descreve o imóvel, a matrícula é um
dado e a área é outro.

${VALOR_NORMALIZADO}

O CONTEXTO É A FRASE DO DOCUMENTO QUE DIZ O QUE O VALOR É. "340 ha" sozinho não identifica nada:
pode ser a área total, a área arrendada, a área plantada ou a área de reserva. Copie a frase que o
qualifica, sem interpretá-la.

NÃO EXTRAIA O QUE NENHUM CAMPO DIZ. Área remanescente que ninguém subtraiu, saldo a entregar que
ninguém calculou, valor total que nenhuma linha imprime, conversão de alqueire em hectare: nada
disso é dado do documento.

DOCUMENTO DE IDENTIFICAÇÃO DE PESSOA NATURAL SAI PARCIAL, e endereço residencial de pessoa em
situação de conflito possessório não sai. Nunca escreva número completo de CPF, RG ou documento
equivalente.

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
      input: { sourceText: { totalLength: 130, truncated: false } },
      output: {
        entityType: 'QUANTIDADE_CONTRATADA',
        originalValue: '12.000 sacas',
        pageNumber: 1,
        startOffset: 44,
        endOffset: 56,
        confidenceScore: 0.92,
      },
    },
  ],
  validationCriteria: [
    'Reject entities without a resolvable page and character range.',
    'Reject locators outside the authorized source length.',
    'Reject aggregated or computed values that no single field states.',
    'Reject a quantity or area extracted without its printed unit.',
    'Every extracted entity starts unconfirmed and requires human confirmation.',
    'Never write a complete natural-person identification number to logs or audit records.',
  ],
} as const satisfies PromptSpecification;

export const agrarioPrompts = [
  timelineAgrarioV1,
  checklistAgrarioV1,
  groundedAnswerAgrarioV1,
  classificationAgrarioV1,
  entitiesAgrarioV1,
] as const satisfies readonly PromptSpecification[];
