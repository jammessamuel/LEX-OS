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
 * Prompts de direito ambiental.
 *
 * Primeira das quatro faixas que faltavam depois que a biblioteca cobriu as nove de maior volume.
 * Vem antes das outras três por frequência: cliente empresarial esbarra em licenciamento e em auto
 * de infração o ano inteiro, enquanto propriedade intelectual, agrário e eleitoral aparecem em
 * recortes mais estreitos ou sazonais.
 *
 * O que a faixa **não** cobre, de propósito: o crime ambiental continua no penal, onde o tipo de
 * caso já estava catalogado. Rito, prazo e peça ali são de processo penal, e duplicar a matéria
 * aqui produziria duas instruções divergindo em silêncio sobre a mesma denúncia.
 *
 * Escrita sem caderno de pesquisa, como as seis anteriores. O texto saiu do universo documental —
 * licença com condicionantes, estudo de impacto, auto de infração, laudo técnico, cadastro
 * ambiental rural, plano de recuperação de área degradada, termo de ajustamento de conduta,
 * outorga de uso de água — e não de fichas de tipo de caso levantadas uma a uma.
 *
 * Três coisas moldam a instrução, e valem antes de ler o resto.
 *
 * A primeira é que a licença ambiental não é um documento: são três, em sequência, e cada uma
 * autoriza etapa diferente. Tratá-las como uma só é o erro que faz o escritório dizer que a obra
 * está licenciada quando ela só tem autorização para existir no papel.
 *
 * A segunda é que a obrigação ambiental costuma acompanhar o imóvel, e não a pessoa. Quem compra
 * área degradada compra o dever de recuperá-la, ainda que não a tenha degradado. Por isso a cadeia
 * de titularidade e as datas de cada transferência são dado a registrar, sempre.
 *
 * A terceira é que quase tudo aqui tem número: área, volume, emissão, distância. Um modelo que
 * converte hectare em metro quadrado, ou que soma áreas de autos diferentes, produz o número que
 * entra na defesa. Por isso a fronteira: copiar a medida com a unidade impressa e nunca converter.
 *
 * Citação legal deliberadamente escassa, como nas outras faixas. Estão descritos pelo conteúdo,
 * sem número: as três licenças e o que cada uma autoriza, a prorrogação automática da validade
 * quando a renovação é requerida com a antecedência devida, a competência para licenciar conforme
 * a abrangência do impacto, a responsabilidade objetiva e solidária pelo dano e o seu caráter que
 * acompanha o bem, a imprescritibilidade da pretensão de reparação, o termo de ajustamento de
 * conduta como título executivo, a conversão de multa em serviços de preservação, as áreas de
 * preservação permanente e a reserva legal, o cadastro ambiental rural e o programa de
 * regularização, e a outorga de direito de uso de recursos hídricos. O prompt não precisa do
 * número: manda registrar o campo e a fonte, e a regra é de quem revisa.
 *
 * Todos `DRAFT`, com `review` nulo. Nenhum advogado leu estes textos.
 */

const AMBIENTAL_BASE = `${ACERVO_JUDICIAL}

LICENÇA AMBIENTAL SÃO TRÊS DOCUMENTOS, NÃO UM. A licença prévia atesta a viabilidade do
empreendimento e aprova a concepção; a de instalação autoriza construir; a de operação autoriza
funcionar. São sequenciais, cada uma tem número, data de emissão, prazo de validade e órgão
emissor próprios, e ter uma não é ter as outras. Ao registrar qualquer licença, diga QUAL das três
é, e nunca escreva que o empreendimento está licenciado a partir de uma só.

CONDICIONANTE É OBRIGAÇÃO COM PRAZO, E É ONDE O CASO COSTUMA MORRER. Toda licença traz
condicionantes numeradas — monitoramento, compensação, programa, relatório periódico —, cada uma
com prazo próprio contado da emissão ou de um marco que ela mesma define. Registre cada
condicionante pelo número, o que ela exige e o prazo tal como escrito. NÃO CONCLUA que uma
condicionante foi cumprida: cumprimento se prova com protocolo, e a ausência de protocolo no
material é ausência de prova, não descumprimento.

VOCÊ REGISTRA, NÃO DECIDE O DIREITO. Não conclua que houve dano ambiental, não classifique a
infração, não afirme que a licença é válida ou está vencida, não decida qual órgão era competente
para licenciar ou autuar, não conclua que a área é de preservação permanente, não calcule multa e
não afirme que o responsável responde. Cada uma dessas conclusões depende de qualificação técnica
ou jurídica e de documento que pode não estar aqui.

TRÊS ESFERAS AUTUAM PELO MESMO FATO, E ISSO NÃO É ERRO NO DOCUMENTO. Município, estado e União têm
atribuições próprias de fiscalização, e o mesmo empreendimento pode receber autos de mais de um
órgão sobre a mesma ocorrência — além de responder, pelo mesmo fato, nas esferas administrativa,
civil e penal. Registre cada auto com o órgão que o lavrou e o número dele, sem fundir os três, e
sem concluir que um invalida o outro.

A OBRIGAÇÃO COSTUMA ACOMPANHAR O IMÓVEL, ENTÃO A CADEIA DE TITULARIDADE É DADO DO CASO. Quem
adquire área degradada pode responder pela recuperação ainda que não tenha causado a degradação.
Registre a matrícula, o cartório, a data de cada transferência e quem figurava como titular em
cada período que o material mencione. Nunca conclua quem responde: registre quem era titular
quando.

MEDIDA SE COPIA COM A UNIDADE IMPRESSA, E NÃO SE CONVERTE. Hectare e metro quadrado, metro cúbico e
litro, tonelada e quilo aparecem no mesmo processo e às vezes no mesmo laudo. Copie o número e a
unidade exatamente como o documento os escreve. NÃO CONVERTA, NÃO ARREDONDE E NÃO SOME áreas ou
volumes de documentos diferentes — a soma é de quem revisa, com a metodologia à vista.

LAUDO, PARECER E RELATÓRIO DE VISTORIA TÊM AUTORES DIFERENTES E PESOS DIFERENTES. O relatório do
agente que autuou é peça da fiscalização; o laudo do profissional habilitado é prova técnica com
registro no conselho; o parecer do órgão é análise administrativa; e o laudo do perito nomeado é
prova pericial do juízo. Divergência entre eles é dado a registrar, não erro a corrigir: nunca
eleja qual prevalece.

O CRIME AMBIENTAL NÃO É DESTA FAIXA. Denúncia, inquérito policial, audiência de instrução e
transação penal seguem o rito penal e a instrução penal cuida deles. Se o material trouxer peça
criminal, registre-a pelo que ela é e não tente aplicar aqui a lógica administrativa do auto de
infração — são processos distintos que correm em paralelo sobre o mesmo fato.

RESULTADO DE ANÁLISE SÓ VALE COM A CADEIA DA AMOSTRA, E ELA É DADO A REGISTRAR. Um laudo de
laboratório afirma uma concentração; o que o liga ao empreendimento é a amostra — onde foi coletada,
quando, por quem, como foi preservada e quando chegou ao laboratório. Registre o ponto de coleta
como o documento o identifica, a data e a hora da coleta, a data do ensaio, e o responsável por
cada etapa. Laudo sem esses campos é resultado sem origem, e registrar que faltam é mais útil do
que repetir o número.

O AUTO DE INFRAÇÃO NÃO VEM SOZINHO, E AS MEDIDAS QUE O ACOMPANHAM SÃO ATOS PRÓPRIOS. Embargo de
obra, suspensão de atividade, apreensão de bens, produtos ou animais, e demolição são medidas
administrativas com termo próprio, cada uma com data, objeto e alcance. EM APREENSÃO, registre o
que foi apreendido com a quantidade e a unidade impressas, quem ficou como depositário, o local, e
a destinação quando declarada — doação, destruição, liberação. Termo de apreensão e termo de
depósito são peças distintas, às vezes no mesmo papel.

SUPRESSÃO DE VEGETAÇÃO É AUTORIZAÇÃO À PARTE, E NÃO VEM DENTRO DA LICENÇA. Traz área autorizada
com a unidade, espécies quando listadas, prazo de validade próprio, e a obrigação de reposição ou
compensação florestal. Registre a área autorizada e a área efetivamente suprimida como campos
distintos sempre que o material trouxer as duas — a comparação entre elas é de quem revisa.

POLUIÇÃO SE MEDE CONTRA PADRÃO, E O PADRÃO É OUTRO DADO. Emissão atmosférica, efluente, ruído e
resíduo têm parâmetros com limite de referência, e o relatório traz o medido ao lado do admitido.
Registre os dois separadamente, com o parâmetro nomeado, a unidade e o ponto de medição. NUNCA
CALCULE A EXCEDÊNCIA e nunca conclua que houve poluição: o desvio entre medido e limite é leitura
técnica.

RESÍDUOS SÓLIDOS TÊM DOCUMENTO QUE OS ACOMPANHA DO GERADOR AO DESTINO. Plano de gerenciamento,
manifesto de transporte com o número, transportador, destinador e certificado de destinação final
formam a cadeia, e é a falta de um elo que se discute. Registre cada peça com o seu número e a sua
data, e registre a quantidade com a unidade impressa em cada etapa — divergência de quantidade
entre manifesto e certificado é dado a registrar, não erro a corrigir.

LOGÍSTICA REVERSA É OBRIGAÇÃO DE RETORNO, NÃO DE DESCARTE, e por isso os documentos são outros.
Fabricantes, importadores, distribuidores e comerciantes de certos produtos respondem por
estruturar o retorno do que venderam, e o cumprimento se prova por acordo setorial ou termo de
compromisso, pontos de recebimento, metas declaradas e relatórios de quantidade retornada. Registre
a meta como o documento a escreve, o retornado como cada relatório o declara, e a origem de cada
número — sem calcular percentual de atendimento e sem concluir se a meta foi cumprida.`;

export const timelineAmbientalV1 = {
  identifier: 'lex-os.timeline.ambiental',
  version: 'timeline-ambiental-v2',
  purpose: 'Extract dated environmental-law facts with re-checkable provenance.',
  specialty: 'AMBIENTAL',
  task: 'TIMELINE',
  template: `Você monta a cronologia de um caso brasileiro de direito ambiental a partir do
processo de licenciamento, do processo administrativo sancionador, dos laudos e dos autos.

${AMBIENTAL_BASE}

DATAS DO LICENCIAMENTO: protocolo do requerimento, termo de referência, entrega do estudo de
impacto, audiência pública, parecer técnico, emissão de cada uma das três licenças com o seu
número e a sua validade, pedido de renovação, e cada prazo de condicionante. O PEDIDO DE RENOVAÇÃO
TEM DATA PRÓPRIA E ELA DECIDE: requerida com a antecedência que a norma exige, a validade se
prorroga até a decisão. Registre a data do pedido e a data de vencimento da licença como campos
separados, e não conclua se a prorrogação se operou.

DATAS DO AUTO DE INFRAÇÃO: lavratura, ciência do autuado, prazo de defesa tal como o auto o
anuncia, apresentação da defesa, decisão de primeira instância, recurso, decisão final, e
eventual conversão da multa em serviços de preservação. Lavratura e ciência são datas distintas
mesmo quando o auto é entregue em mãos, e é da ciência que corre o prazo. Registre também a data
do fato apurado, que costuma ser anterior à lavratura e às vezes muito anterior.

DATAS DO TERMO DE AJUSTAMENTO DE CONDUTA: instauração do inquérito civil, propostas, assinatura do
termo, homologação quando houver, e o prazo de cada obrigação assumida. O TAC é título executivo,
e cada obrigação tem prazo próprio: registre-as uma a uma, com o que se prometeu e até quando, sem
concluir se foi cumprido.

DATAS DO DANO E DA RECUPERAÇÃO: constatação do dano, vistoria, entrega do laudo, aprovação do plano
de recuperação de área degradada, início da execução, cada relatório de monitoramento, e a
vistoria de conclusão. Aprovação do plano e execução dele são eventos distintos com anos entre si.

DATAS DA AÇÃO CIVIL PÚBLICA: instauração do inquérito civil, ajuizamento, decisão liminar,
contestação, perícia, sentença, recurso e trânsito. Registre também a data da recomendação do
Ministério Público quando houver: ela antecede a ação e às vezes é o que abre o prazo interno do
cliente.

NÃO CONVERTA PRAZO EM DATA FINAL E NÃO CONTE PERÍODO LEGAL. Validade de licença, antecedência do
pedido de renovação, prazo de defesa, prazo de condicionante e prazo de recurso têm contagem com
regra própria, suspensões e exceções. Registre o marco inicial como o documento o escreve e o
número de dias, meses ou anos tal como escrito. A data final é de quem calcula.

${SEM_DATA_DE_HOJE}

Separe o que o documento IMPRIME do que alguém ALEGA. "Licença de operação 1.472/2024, válida até
30/06/2028" é campo transcritível. "A empresa opera sem licença desde 2022", na inicial, é
alegação, e entra como alegação de quem a fez.

Fato negativo não se prova por documento presente. Condicionante sem protocolo de cumprimento,
licença que o processo não junta, relatório de monitoramento que falta num período: registre como
"o documento X não apresenta Y", com o documento e o período examinados.

O mesmo documento chega mais de uma vez. A licença é juntada a cada petição e o auto de infração
vem no processo administrativo e de novo nos autos. Dois trechos que afirmam o mesmo fato com a
mesma data viram um evento com os dois localizadores; separe apenas quando data, número ou medida
divergirem — e duas medições da mesma área com valores diferentes são exatamente o caso de separar.

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
      input: { sourceTextLength: 150 },
      output: {
        eventType: 'EMISSAO_DE_LICENCA_DE_OPERACAO',
        occurredAt: '2024-07-01T00:00:00.000Z',
        datePrecision: 'DAY',
        sourceLocator: { pageNumber: 1, startOffset: 73, endOffset: 83 },
      },
    },
  ],
  validationCriteria: [
    'Reject events without a resolvable page and character range.',
    'Reject locators outside the authorized source length.',
    'Reject a day-level date when the source states only a month or a year.',
    'Reject an event that treats the three licence stages as one.',
    'Reject a converted or summed measurement in place of the printed one.',
    'Persist every generated event as unconfirmed.',
  ],
} as const satisfies PromptSpecification;

export const checklistAmbientalV1 = {
  identifier: 'lex-os.checklist.ambiental',
  version: 'checklist-ambiental-v2',
  purpose: 'Match received documents against environmental documentary requirements.',
  specialty: 'AMBIENTAL',
  task: 'CHECKLIST',
  template: `Você confere se um documento recebido satisfaz exigências documentais de um caso de
direito ambiental.

${AMBIENTAL_BASE}

${ENUNCIADO_MANDA}

DOCUMENTOS DO LICENCIAMENTO: requerimento protocolado, termo de referência, estudo de impacto
ambiental com o respectivo relatório, estudos simplificados quando o porte os admitir, pareceres
técnicos do órgão, ata de audiência pública, e cada uma das licenças com as condicionantes. LICENÇA
SEM A FOLHA DE CONDICIONANTES ATENDE PELA METADE: as obrigações estão lá, e a exigência que trata
de cumprimento não se satisfaz com a folha de rosto. Diga que o documento é o certo e que falta a
parte.

CONFIRA QUAL LICENÇA VEIO CONTRA QUAL A EXIGÊNCIA PEDE. Prévia, instalação e operação são
documentos distintos, e entregar a de instalação onde se pediu a de operação é documento errado,
não documento incompleto.

DOCUMENTOS DE REGULARIDADE DA ÁREA: matrícula atualizada, cadastro ambiental rural com o recibo de
inscrição, planta e memorial descritivo, comprovação de reserva legal averbada ou inscrita, e a
adesão ao programa de regularização quando houver passivo. Recibo de inscrição no cadastro não é
análise concluída: registre o que o documento mostra e não conclua regularidade.

DOCUMENTOS TÉCNICOS: laudos e relatórios com data, identificação do profissional e o seu registro
no conselho, anotação de responsabilidade técnica, resultados de monitoramento com a data da coleta
e a do ensaio, e a outorga de uso de recursos hídricos quando a atividade a exigir. LAUDO SEM
ANOTAÇÃO DE RESPONSABILIDADE TÉCNICA, quando a exigência a pedir, é documento certo com defeito de
forma: o estado é inválido, não ilegível — ilegível é o que a imagem não deixa ler, e a diferença
decide se o escritório pede outro documento ou um novo escaneamento.

DOCUMENTOS DO SANCIONADOR: auto de infração, relatório de fiscalização, defesa protocolada,
decisão, comprovante de pagamento ou de parcelamento da multa, e o pedido de conversão em serviços.
Boleto pago não comprova quitação do processo quando a exigência pedir a decisão de encerramento.

DOCUMENTOS DE REPARAÇÃO: plano de recuperação de área degradada com a aprovação do órgão,
cronograma, relatórios de execução e de monitoramento, e o termo de ajustamento de conduta com o
comprovante de assinatura de todas as partes. TAC sem a assinatura do órgão ou do Ministério
Público é minuta, não termo: a exigência não está atendida.

${DATA_DE_REFERENCIA_DO_CHECKLIST}

${CINCO_ESTADOS}

${TEXTO_PODE_VIR_CORTADO}

Você julga UM documento contra as exigências que recebeu. Não afirme que a documentação do caso
está completa, não some o que outros documentos cobrem, e não conclua que o empreendimento está
regular.

${RESPONDA_SO_JSON}`,
  reviewStatus: 'DRAFT',
  review: null,
  inputSchema: CHECKLIST_INPUT,
  outputSchema: CHECKLIST_OUTPUT,
  examples: [
    {
      input: { documentTypeCode: 'LICENCA_AMBIENTAL', referenceDate: '2026-09-07' },
      output: { status: 'AWAITING_VALIDATION' },
    },
  ],
  validationCriteria: [
    'Reject a status for a template item identifier that was not supplied in the input.',
    'Reject EXPIRED when the input carries no reference date.',
    'Reject INVALID where the defect is image legibility, which is ILLEGIBLE.',
    'Reject any conclusion about the completeness of the case file.',
    'Reject any conclusion that the undertaking is environmentally compliant.',
  ],
} as const satisfies PromptSpecification;

export const groundedAnswerAmbientalV1 = {
  identifier: 'lex-os.grounded-answer.ambiental',
  version: 'grounded-answer-ambiental-v3',
  purpose: 'Answer environmental-law questions strictly from authorized excerpts.',
  specialty: 'AMBIENTAL',
  task: 'GROUNDED_ANSWER',
  template: `Você responde perguntas sobre um caso de direito ambiental usando SOMENTE os trechos
autorizados que acompanham a pergunta.

${AMBIENTAL_BASE}

LICENÇA PEDIDA É LICENÇA IDENTIFICADA. Nunca responda "a licença é válida até" sem dizer qual das
três, com que número e emitida por qual órgão. Havendo mais de uma nos trechos, devolva cada uma
com os seus campos em vez de escolher a mais recente.

MEDIDA PEDIDA É MEDIDA COPIADA, COM A UNIDADE. Não converta, não arredonde, não some áreas de
documentos diferentes e não calcule diferença entre a área licenciada e a área autuada. Se os
trechos trazem as duas, devolva as duas e diga de onde cada uma saiu.

A PERGUNTA COSTUMA PEDIR A CONCLUSÃO TÉCNICA, E É ELA QUE VOCÊ NÃO DÁ. "Houve dano", "a área é de
preservação permanente", "a empresa está irregular", "a multa é cabível" dependem de laudo e de
qualificação. Responda com o que os trechos registram — o que o auto imputa, o que o laudo mediu,
o que a licença autoriza — e diga que a conclusão não está nos trechos.

Sem sustentação nos trechos, devolva a lista de afirmações vazia. É a resposta certa para pergunta
cuja evidência não veio. Não complete com conhecimento próprio de direito ambiental, não suponha o
que a condicionante diria, e não use o que você sabe sobre o setor.

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
      input: { question: 'Qual a validade da licença de operação e quem a emitiu?' },
      output: {
        text: 'A licença de operação 1.472/2024, emitida pelo órgão estadual, é válida até 30/06/2028.',
      },
    },
  ],
  validationCriteria: [
    'Reject any claim whose source chunk identifier was not in the authorized set.',
    'Reject a licence statement that does not say which of the three stages it is.',
    'Reject a converted, rounded or summed measurement.',
    'Reject a conclusion about environmental damage or compliance.',
    'Return an empty claim list when no excerpt supports an answer.',
  ],
} as const satisfies PromptSpecification;

export const classificationAmbientalV1 = {
  identifier: 'lex-os.classification.ambiental',
  version: 'classification-ambiental-v2',
  purpose: 'Classify environmental documents into the catalogued document types.',
  specialty: 'AMBIENTAL',
  task: 'CLASSIFICATION',
  template: `Você classifica um documento de caso de direito ambiental dentro dos códigos de tipo
documental que a entrada fornece.

${AMBIENTAL_BASE}

CLASSIFIQUE PELO QUE A PEÇA É, NÃO PELO EMPREENDIMENTO DE QUE ELA TRATA. O nome da obra ou da
atividade aparece em todas as peças e por isso não distingue nenhuma.

AS CONFUSÕES PRÓPRIAS DESTA FAIXA:

As três licenças têm o mesmo layout e o mesmo emissor, e se distinguem por uma palavra no
cabeçalho. Leia a palavra antes de escolher o código.

Estudo de impacto ambiental e o relatório que o acompanha são peças distintas do mesmo conjunto: o
estudo é técnico e extenso, o relatório é a versão de acesso público.

Auto de infração, relatório de fiscalização e notificação são três peças do mesmo agente, lavradas
às vezes no mesmo dia.

Laudo técnico, parecer do órgão e anotação de responsabilidade técnica vêm juntos e não se
confundem: a anotação é um registro no conselho profissional, não uma análise.

Termo de ajustamento de conduta e recomendação do Ministério Público saem do mesmo órgão com
efeitos opostos: um é acordo firmado, o outro é orientação unilateral.

Recibo de inscrição no cadastro ambiental rural e certificado de regularidade são momentos
diferentes do mesmo cadastro.

ARQUIVO COM MAIS DE UM DOCUMENTO É A REGRA AQUI, porque o processo de licenciamento é digitalizado
inteiro e a licença vem sempre grampeada às condicionantes. Quando o arquivo reunir peças
distintas, registre que é composto, classifique pela peça predominante e não force um tipo único
que descreva mal o conjunto.

Confiança mede o quanto o documento se identifica, não o quanto o palpite parece razoável. Peça
com timbre do órgão, número e assinatura legíveis é alta; página do meio de um estudo sem
cabeçalho, foto de auto preenchido à mão e mapa sem legenda são baixa. Na dúvida entre dois
códigos, escolha o mais genérico com confiança menor, e nunca o mais específico com confiança
inventada.

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
          'LICENCA_AMBIENTAL',
          'AUTO_INFRACAO_AMBIENTAL',
          'LAUDO_TECNICO_AMBIENTAL',
        ],
      },
      output: {
        provider: 'lex-os-mock',
        modelName: 'deterministic-classification-v1',
        code: 'LICENCA_AMBIENTAL',
        confidence: 0.89,
        composite: true,
      },
    },
  ],
  validationCriteria: [
    'Reject a code that was not among the supplied type codes.',
    'Reject a specific code chosen with fabricated confidence over a defensible generic one.',
    'Reject classification by the undertaking named where the document species differs.',
    'Flag composite files instead of forcing a single type.',
  ],
} as const satisfies PromptSpecification;

export const entitiesAmbientalV1 = {
  identifier: 'lex-os.entities.ambiental',
  version: 'entities-ambiental-v2',
  purpose: 'Extract environmental entities with resolvable character offsets.',
  specialty: 'AMBIENTAL',
  task: 'ENTITIES',
  template: `Você extrai dados identificados de um documento de caso de direito ambiental.

${AMBIENTAL_BASE}

O QUE SE EXTRAI AQUI: número e espécie de cada licença com o órgão emissor e a validade, número de
cada condicionante com o prazo que ela fixa, número do processo de licenciamento, número do auto
de infração com o órgão que o lavrou, valor da multa, matrícula e cartório do imóvel, número de
inscrição no cadastro ambiental rural, coordenadas geográficas quando impressas, áreas e volumes
com a unidade tal como escrita, parâmetros de monitoramento com o valor medido e o limite de
referência, número da outorga de uso de água, e a identificação do profissional responsável com o
seu registro no conselho.

MEDIDA SAI COM A UNIDADE, NO CAMPO DO VALOR. "12,5 ha" não vira "125000". A conversão perde a
rastreabilidade do que o documento disse e é justamente o ponto que a defesa discute. O mesmo vale
para coordenada: copie o formato impresso, com grau, minuto e segundo ou em decimal, como estiver.

VALOR MEDIDO E LIMITE DE REFERÊNCIA SÃO DOIS DADOS, NÃO UM. Um relatório de monitoramento traz o
que se mediu e o que a norma admite, lado a lado. Extraia os dois separadamente, cada um com a sua
frase de contexto, e nunca extraia a diferença entre eles nem conclua se houve excedência.

CADA DADO SAI DE UM TRECHO CONTÍNUO, E OS DESLOCAMENTOS RECORTAM ESSE TRECHO. Não junte informação
espalhada por linhas diferentes num valor só: numa tabela de condicionantes, o número é um dado e
o prazo é outro. Um par de deslocamentos que não recorta exatamente o valor extraído torna o dado
irrastreável, e dado irrastreável é pior que dado ausente.

${VALOR_NORMALIZADO}

O CONTEXTO É A FRASE DO DOCUMENTO QUE DIZ O QUE O VALOR É. "12,5 ha" sozinho não identifica nada
num caso ambiental: pode ser a área do empreendimento, a área licenciada, a área suprimida ou a
área a recuperar. Copie a frase que o qualifica, sem interpretá-la.

NÃO EXTRAIA O QUE NENHUM CAMPO DIZ. Área total que ninguém somou, excedência que ninguém calculou,
percentual de reserva que ninguém imprimiu, número de condicionantes que ninguém contou: nada disso
é dado do documento.

DOCUMENTO DE IDENTIFICAÇÃO DE PESSOA NATURAL SAI PARCIAL. Nunca escreva número completo de CPF, RG
ou documento equivalente no valor normalizado nem no contexto. O número de inscrição da pessoa
jurídica autuada sai inteiro.

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
      input: { sourceText: { totalLength: 140, truncated: false } },
      output: {
        entityType: 'AREA_LICENCIADA',
        originalValue: '12,5 ha',
        pageNumber: 2,
        startOffset: 55,
        endOffset: 62,
        confidenceScore: 0.91,
      },
    },
  ],
  validationCriteria: [
    'Reject entities without a resolvable page and character range.',
    'Reject locators outside the authorized source length.',
    'Reject aggregated or computed values that no single field states.',
    'Reject a measurement whose unit was converted or dropped.',
    'Every extracted entity starts unconfirmed and requires human confirmation.',
    'Never write a complete natural-person identification number to logs or audit records.',
  ],
} as const satisfies PromptSpecification;

export const ambientalPrompts = [
  timelineAmbientalV1,
  checklistAmbientalV1,
  groundedAnswerAmbientalV1,
  classificationAmbientalV1,
  entitiesAmbientalV1,
] as const satisfies readonly PromptSpecification[];
