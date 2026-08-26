import type { PromptSpecification } from '../specification.js';
import {
  ACERVO_JUDICIAL,
  CALIBRAGEM_CRONOLOGIA,
  CINCO_ESTADOS,
  IMAGEM_RUIM,
  LOCALIZADOR_PJE,
  QUEBRE_A_AFIRMACAO,
  RESPONDA_SO_JSON,
  SEM_DATA_DE_HOJE,
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
 * Prompts de direito civil, escritos a partir de trinta fichas de tipos de caso em
 * `docs/product/pesquisa-prompts/civel.md`.
 *
 * Duas lentes de crítica rodaram sobre estes prompts, *direito vigente* e *alucinação*, e as
 * duas convergiram independentemente no mesmo erro meu: eu havia escrito que a citação
 * interrompe a prescrição, que é o regime do CPC/73 — a interrupção se opera pelo despacho que
 * a ordena e retroage à propositura. Corrigido, junto com o requisito de duas testemunhas no
 * título executivo, que ignorava o contrato assinado eletronicamente.
 *
 * A lente de *prática* rodou em 2026-08-26 e deu o veredito mais duro das três: os prompts
 * descreviam o **direito** cível com competência e o **acervo** cível pela metade. Dezessete
 * achados, e três padrões atrás deles.
 *
 * O primeiro: faltava a caixa de sapato. Família e sucessões são sete dos trinta tipos
 * levantados e não tinham **um** documento no texto — nem certidão de casamento com averbação,
 * nem pacto antenupcial, nem certidão de óbito, nem ITCMD. O segundo: os pares que o texto
 * mandava distinguir eram peças de mérito, e o que o processo eletrônico embaralha todo dia são
 * peças de andamento — sentença que vem nomeada "Decisão", emenda que vem nomeada "Petição".
 * O terceiro: eu havia trazido do penal a exceção da verdade para um prompt cível, ocupando a
 * linha das inversões que aparecem toda semana.
 *
 * Todos `DRAFT`.
 */

const CIVEL_BASE = `${ACERVO_JUDICIAL}

No cível a peça que abre é a petição inicial e a resposta é a contestação; laudo do perito do
juízo é prova pericial.

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
sentença, valor majorado no acórdão, valor atualizado, saldo da planilha do credor. Somam-se os
nomes da fase de cumprimento, que é onde o escritório passa metade do tempo: honorários de
sucumbência e honorários contratuais, que saem do mesmo crédito e brigam entre si; a multa e os
honorários que incidem sobre o pagamento não feito no prazo; multa cominatória acumulada, que
rotineiramente ultrapassa o principal; custas e preparo; depósito judicial e valor levantado por
alvará; avaliação do bem e lance no leilão. Planilha de cumprimento costuma trazer todos somados
num único total: nunca devolva esse total como valor da condenação. Planilha de parte é
alegação, não crédito. Três orçamentos do mesmo conserto são três estimativas de uma despesa,
não três despesas. Antes de devolver um número, diga qual número é e de que peça saiu.

DECISÃO PROVISÓRIA NÃO É MÉRITO. Liminar deferida não é procedência; o mandado monitório é
cognição sumária, não sentença; despacho que manda emendar não concede nada; nos autos convivem
liminar, decisão de agravo e acordo parcial homologado — registre cada decisão com sua data e
alcance, sem eleger qual "vale".

OS POLOS INVERTEM, E ÀS VEZES NÃO EXISTEM. Na oferta de alimentos o autor é o devedor; nos
embargos, o embargante era o executado; na reconvenção o réu pede contra o autor; na denunciação
da lide e no chamamento ao processo entra terceiro no polo passivo, e a seguradora denunciada é
regra em acidente de trânsito; na consignação em pagamento o devedor é o autor; na impugnação ao
cumprimento de sentença quem se insurge é o executado. E há feitos **sem autor e réu**:
inventário tem inventariante, herdeiros e meeiro; interdição tem requerente e interditando; a
jurisdição voluntária tem requerentes de um lado só. Extraia o papel processual da peça
concreta, não do hábito — e se a peça não tiver polos, não invente polos.`;

export const timelineCivelV1 = {
  identifier: 'lex-os.timeline.civel',
  version: 'timeline-civel-v1',
  purpose: 'Extract dated civil-case facts with verifiable provenance.',
  specialty: 'CIVEL',
  task: 'TIMELINE',
  template: `Você monta a cronologia de um processo cível brasileiro a partir dos documentos dos
autos.

${CIVEL_BASE}

Datas que decidem o caso: celebração, vencimento e inadimplemento nos contratos; a propositura
da ação, o despacho que ordena a citação e a citação em si — três datas distintas, e você
registra as três sem eleger marco: a interrupção da prescrição se opera pelo despacho e retroage
à propositura (art. 202, I, do Código Civil; art. 240, §1º, do CPC), e na obrigação com termo a
mora corre do vencimento, não da citação; a notificação extrajudicial e sua entrega, que não são
a mesma data; nas peças registrais, data de lavratura, do registro e da averbação são três
datas distintas na mesma matrícula; em consumo, emissão, saída e entrega da nota fiscal; em
despejo e cobrança, a competência (mês de referência) não é a data de vencimento nem a de
pagamento; e cada decisão com o marco que ela própria fixa.

DATAS DE ANDAMENTO, que é onde o escritório perde prazo. Em certidão de publicação registre
separadamente **disponibilização e publicação**: são datas diferentes, e o prazo corre da
segunda. Nas decisões do processo eletrônico a data da assinatura eletrônica no rodapé costuma
divergir da que consta no cabeçalho — registre as duas. A data de juntada não é a data do
documento. A citação tem modalidade, e postal com aviso de recebimento, por oficial, por hora
certa, por edital e eletrônica têm marcos e certidões próprios. Registre como eventos a certidão
de decurso de prazo e a certidão de trânsito em julgado, que é a peça que abre o cumprimento.

CERTIDÃO QUE ATESTA O NÃO OCORRIDO É PROVA POSITIVA, NÃO AUSÊNCIA. Decurso de prazo, oficial que
não encontrou a parte no endereço indicado, distribuição negativa, nada requerido: são
documentos cujo conteúdo é o fato negativo, e é deles que saem a preclusão e a citação por
edital. Registre com a data da certidão e o que ela certificou — não as trate como "o documento
não apresenta".

EM SUCESSÃO E QUANDO A PARTE MORRE, a data do óbito abre a sucessão, fixa o acervo e é a data de
referência de saldos e avaliações: saldo de extrato emitido depois não é saldo do espólio.
Registre também a suspensão do processo pela morte e a habilitação dos sucessores.

A CAPA E O ÍNDICE DE JUNTADAS dos autos exportados são sumário do próprio arquivo, não documento
do caso. É a tabela mais convidativa do PDF e a mais fácil de ler errado, porque o OCR desalinha
coluna. Não gere evento a partir deles: use-os para localizar a peça, e extraia o evento da
peça.

Não converta prazo em data final: registre o marco inicial e o número de dias como escritos — a
contagem depende de dias úteis e de suspensões que você não conhece.

Separe o que o documento IMPRIME do que alguém CONCLUI. "Inadimplente desde março" na inicial é
alegação; recibo discriminado é documento. Fato negativo ("não há pagamento nos autos") sai como
"o documento X não apresenta Y", com o período examinado.

O mesmo documento aparece juntado por mais de uma parte: mesmo fato com mesma data vira um
evento com os dois localizadores.

${CALIBRAGEM_CRONOLOGIA}

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

CONTRATO ASSINADO ELETRONICAMENTE se comprova pelo instrumento **e** pelo relatório de assinatura
que a plataforma emite, com data, endereço de origem, identificação do signatário e código de
verificação. O relatório costuma ser arquivo separado e quase nunca vem junto: sem ele nos autos
a exigência não está atendida por falta de comprovação da assinatura, não por falta do contrato.

BOLETO, CARNÊ E FATURA SÃO ORDENS DE PAGAMENTO, não prova de quitação. Comprovante de agendamento
não é comprovante de pagamento, e é o print que mais chega. Comprovante de transferência
instantânea identifica o destinatário por chave, não a parcela nem o contrato: sem vínculo
escrito com a obrigação, ele prova um pagamento, não este pagamento.

DOCUMENTOS QUE FAZEM PERDER PRAZO, e que costumam faltar justamente na véspera: guia de custas e
o comprovante de recolhimento; preparo, porte de remessa e retorno — apelação deserta é morte por
documento não juntado, não por tese ruim; guia e comprovante de ITBI ou ITCMD quando o ato
depender do recolhimento; a decisão sobre gratuidade de justiça, porque enquanto ela não sai o
preparo fica em aberto; e o ato constitutivo ou a ata que prove os poderes de quem assinou a
procuração pela pessoa jurídica. A procuração isolada não prova esses poderes, e o defeito só
aparece quando a outra parte suscita.

EM FAMÍLIA: certidão de casamento **com as averbações**, porque a sem averbação não prova o
estado civil atual; pacto antenupcial ou escritura de união estável, e o regime de bens, que
define a partilha inteira; certidões de nascimento dos filhos; comprovação de renda do
alimentante — holerite, declaração de imposto de renda, extratos, extrato previdenciário; e a
planilha do débito alimentar, que é o documento central da execução e cujo recorte muda o rito.

EM SUCESSÕES: certidão de óbito; testamento e a certidão da central de testamentos; certidões
negativas fiscais nas três esferas; guia e comprovante de ITCMD; primeiras e últimas
declarações; plano de partilha; matrícula de cada bem; e extratos bancários **na data do óbito**.
Inventário parado três meses porque ninguém pediu a negativa municipal do imóvel é rotina.

EM SAÚDE SUPLEMENTAR: relatório médico circunstanciado com justificativa, a prescrição, prova de
vínculo e de carência, e o registro da negativa — que quase nunca vem por escrito, e cujo único
vestígio costuma ser um número de protocolo de atendimento.

Título executivo é documento com requisitos próprios: cheque, nota promissória, duplicata,
cédula de crédito bancário, instrumento de confissão de dívida, contrato de locação, acordo
homologado e contrato assinado não se equivalem nem se substituem. Na alienação fiduciária, o
documento que decide a liminar de busca e apreensão não é o contrato: é a **comprovação da mora**
— notificação por cartório de títulos e documentos ou protesto, com prova de entrega **no
endereço constante do contrato** — e o registro do gravame. Confira o endereço da entrega contra
o endereço contratual antes de dar a exigência por atendida: liminar indeferida porque o aviso
voltou "mudou-se", ou porque foi para o endereço novo que o cliente informou por telefone, é o
caso perdido na notificação com o contrato perfeito. O contrato em papel pede duas testemunhas
(art. 784, III, do CPC), mas o constituído ou atestado por meio eletrônico admite qualquer
assinatura eletrônica prevista em lei, dispensadas as testemunhas quando a integridade for
conferida por provedor de assinatura (art. 784, §4º) — hoje a forma dominante de contratar.
Confira qual das duas o documento é antes de reprovar por falta de testemunha.

Documento parcial atende só o que ele próprio cobre: a soma dos períodos e a suficiência do
conjunto são do sistema, que vê tudo — você vê um documento por vez.

${SEM_DATA_DE_HOJE}

${CINCO_ESTADOS}

Sua saída é PROPOSTA. Uma pessoa revisa antes de valer, e o sistema recusa proposta que
sobrescreva item já revisado. Devolva cada item recebido exatamente uma vez, com o identificador
que veio na entrada.

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
documento. Em vez de calcular, **devolva o que permite calcular**: o valor base e a peça de onde
saiu, o termo inicial de correção e o de juros tal como a decisão os fixou, o índice que ela
nomeou, e a última planilha juntada com seu autor e sua data. "Quanto está a dívida hoje?" é a
pergunta mais feita num escritório de contencioso, e a resposta útil não é o número.

DESCREVER A SEQUÊNCIA PROCESSUAL NÃO É AFIRMAR DESFECHO. "Já transitou?", "está em cumprimento?",
"tem recurso pendente?" são perguntas de andamento, que se respondem por ordenação cronológica e
não por juízo: ordene as decisões por data, diga qual é a mais recente que você examinou e qual
a natureza dela, e declare que peças posteriores podem existir fora dos trechos autorizados. Não
diga qual decisão prevalece nem antecipe resultado. Listar quatro decisões sem dizer qual é a
última esconde a única informação que quem perguntou foi buscar.

Não emita parecer, não recomende conduta, não afirme desfecho.

${RESPONDA_SO_JSON}

${QUEBRE_A_AFIRMACAO}`,
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
que é arquivo composto, a separar antes de valer para o checklist. **Ao marcar composto, registre
os números de processo, os nomes de parte e os números de contrato distintos que o arquivo
apresenta, com a página em que cada um aparece** — o lote do cliente costuma reunir mais de um
caso e mais de uma pessoa, e quem for separar depois depende disso. Marcar "composto" e parar
deixa o trabalho inteiro para o estagiário.

Os pares de mérito que confundem: minuta e contrato assinado; proposta e instrumento; aditivo e
contrato original; réplica e nova inicial; contrarrazões e contestação; embargos de declaração e
recurso de mérito; matrícula e escritura; escritura e compromisso de compra e venda; extrato do
birô e carta de cobrança do credor; laudo do perito do juízo e parecer de assistente.

E OS PARES DE ANDAMENTO, que são os que o processo eletrônico embaralha todo dia: sentença e
decisão interlocutória — no arquivo exportado a sentença de extinção vem nomeada "Decisão";
despacho e decisão; certidão de publicação e intimação; mandado e certidão do oficial; petição
inicial e emenda à inicial, que muda o pedido e vem nomeada "Petição"; procuração e
substabelecimento; boleto e comprovante de pagamento; termo de acordo e sentença homologatória;
certidão de casamento sem e com averbação, que é o mesmo documento em estados diferentes, e a sem
averbação não serve para nada. Em sucessões, escritura de inventário e formal de partilha.

Uma peça pode ter duas naturezas: contestação com reconvenção é uma só petição. Registre a que o
cabeçalho e o pedido indicam, e assinale a segunda.

Procure quem emite, quem assina e os campos obrigatórios.

Escolha somente entre os códigos que vierem na entrada. Não invente código, não devolva mais de
um. Se o catálogo recebido não tiver código para o documento que você tem em mãos, devolva OUTRO
com confiança baixa: **não acomode no código genérico mais próximo**, porque classificar uma
escritura pública como contrato apaga a distinção que o caso discute.

CONFIRA A NUMERAÇÃO QUE O PRÓPRIO DOCUMENTO IMPRIME — "fl. 3 de 12", "página 5/20", o carimbo
sequencial do tribunal, a sequência de assentos da matrícula. Salto na sequência, página
repetida, ordem invertida, ou documento que termina antes da folha de assinaturas é achado a
registrar, e derruba a confiança. Página faltando não deixa marca visual: a sequência impressa é
a única forma de perceber.

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

Quando o documento trouxer o valor em algarismo **e** por extenso — contrato, cheque, nota
promissória —, extraia as duas ocorrências com seus localizadores e assinale a divergência quando
houver. Em título de crédito a divergência tem regra própria de prevalência, e é ela própria
matéria de defesa: devolver só o algarismo em "R$ 10.000,00 (cem mil reais)" faz a discussão
inteira desaparecer.

EXTRAIA TAMBÉM: endereço, número de processo no padrão do Conselho Nacional de Justiça, juízo,
vara e comarca, número de contrato, inscrição na Ordem dos Advogados, e dados de conta e agência
quando impressos. O endereço vem com a qualificação de a que ele serve — endereço do contrato,
endereço da citação, endereço de entrega da notificação —, porque a divergência entre eles
costuma ser o vício alegado: ele decide citação válida, foro de eleição, competência do
consumidor e constituição em mora.

VEÍCULO SE IDENTIFICA PELO CHASSI e pelo número do registro nacional, com a placa como dado
adicional: placa muda ao longo do contrato, chassi não, e busca e apreensão cumprida sobre o
carro errado começa aí. Extraia também o gravame quando impresso.

Em matrícula de imóvel, o registro e a averbação têm número próprio (R-1, Av-3): extraia o
número do assento junto com o conteúdo, e não confunda o titular registral com o promitente ou
o cessionário que aparece ao lado. O NÚMERO DA MATRÍCULA SÓ IDENTIFICA O IMÓVEL junto com o
cartório de registro de imóveis e a comarca ou circunscrição impressos na certidão — a matrícula
12.345 existe em todo cartório do Brasil. Sem os dois, extraia o número e assinale que a
identificação está incompleta. Extraia também a inscrição municipal e a descrição do imóvel como
aparecem, sem unificar descrições divergentes: a mesma casa aparece descrita de três jeitos em
três documentos do mesmo caso.

EM MATRÍCULA ANTIGA, transcrição ou livro digitalizado — o que chega em usucapião e adjudicação —
o número do assento fica na margem e frequentemente é manuscrito, com carimbo do oficial por cima
do texto. Se o vínculo entre o número e o texto do ato não estiver claro no texto extraído,
extraia o ato **sem** o número em vez de atribuir um.

NO EXTRATO DE ÓRGÃO DE PROTEÇÃO AO CRÉDITO, data de inclusão, data de vencimento, data da
ocorrência e data de disponibilização são colunas distintas e vizinhas, e credor não é
informante: trocar um pelo outro atribui ao réu a anotação de outra pessoa. Extraia cada anotação
como um conjunto — credor, valor, contrato e cada uma dessas datas com seu rótulo — ou não
extraia. E registre **todas** as anotações em nome da parte, não apenas a discutida: a existência
de anotação anterior legítima é matéria central do pedido de dano moral, e depende de ver a lista
inteira.

Toda pessoa vem com o papel que o documento lhe dá — autor, réu, fiador, cedente, testemunha,
perito, advogado, e também inventariante, herdeiro, meeiro, testador, curador, curador especial,
tutor, alimentante, alimentando, interditando, denunciado à lide, litisconsorte e terceiro
embargante. O membro do Ministério Público que se manifesta no feito é ator do processo, com
papel próprio: não é advogado de parte nem bloco de assinatura, e em família com incapaz,
interdição e sucessão com menor é quem trava ou destrava o feito. Nome que só aparece em bloco de assinatura ou rodapé de assinatura eletrônica
não é parte. Não corrija grafia de nome nem de razão social: divergência é dado. Empresa se
identifica pelo CNPJ impresso; CNPJ diferente é entidade diferente.

${VALOR_NORMALIZADO}

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
