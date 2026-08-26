# Pendências da biblioteca de prompts

**Data:** 2026-08-26
**Origem:** três revisões adversariais — parecer de advogado sênior, lente de alucinação
(criminal) e lente de prática (cível) — mais os limites que eu já conhecia.
**Estado da biblioteca:** 20 prompts, cinco tarefas × quatro faixas, **todos `DRAFT`**.

Ordenado por prioridade de conserto. Cada item diz onde está, por que dói, e o que fazer.

---

## P0 — Defeitos de contrato. Enquanto existirem, a qualidade do texto do prompt não importa

Estes quatro não se consertam escrevendo melhor. O prompt pode estar perfeito e continuar
sem poder fazer o que promete.

**Os quatro foram fechados em 2026-08-26.**

### P0.1 — O checklist tem oito estados no banco e dois na saída — **CORRIGIDO**

`ChecklistStatus` em `packages/database/prisma/schema.prisma`: MISSING, RECEIVED, INVALID,
EXPIRED, ILLEGIBLE, AWAITING_VALIDATION, VALIDATED, NOT_APPLICABLE.
`CHECKLIST_OUTPUT` em `packages/ai-prompts/src/prompts/contratos.ts:67`: `['MISSING', 'AWAITING_VALIDATION']`.

Os quatro que faltam são exatamente os que o escritório precisa distinguir: ilegível, vencido,
inválido, inaplicável. Todos saem como MISSING, que na tela se lê **"não recebemos"**.

Consequência concreta: o advogado pede o documento ao cliente, o cliente reenvia o mesmo scan
ruim, e o ciclo repete até a véspera do prazo. O próprio prompt de checklist escreve, com todas
as letras, que quer "o pedido ao cliente ser de novo escaneamento e não de novo documento" — e o
contrato de saída torna essa distinção impossível de transmitir.

**Feito:** a análise passa a propor **cinco** estados — não atendido, aguardando validação,
ilegível, inválido, vencido. Os três de fora (validado, não aplicável, recebido) são juízo de
quem revisa, e a análise nunca preenche `validatedBy`, então o item continua não confirmado.
O worker só move item que ainda está em MISSING: proposta automática nunca sobrescreve humano.
O genérico passou a apontar para `CHECKLIST_OUTPUT` em vez de repetir o literal — foi a cópia
que o deixou para trás. Três testes de deriva novos, e o bloco `CINCO_ESTADOS` ensina a
diferença nas três faixas.

### P0.2 — O prompt de checklist não recebe o que precisaria julgar — **CORRIGIDO**

`CHECKLIST_INPUT` é `{ documentTypeCode, items }`, e `items` é `{ id, documentTypeCode }[]`.
Não vai texto do documento, não vai imagem, não vai página, e **não vai o enunciado da
exigência**. O modelo não tem como saber que o item 3 pede "matrícula atualizada".

Todo o parágrafo sobre matrícula, título executivo, notificação com prova de entrega e nota
fiscal descreve um julgamento sem insumo. O que sobra é comparar duas strings — que é
literalmente o que o mock determinístico já faz sem modelo nenhum.

É o prompt mais bem escrito dos cinco e o que menos decide.

**Feito em 2026-08-26, e o defeito era maior do que este item.** Ao abrir o contrato apareceu que
a fome era das **quatro** tarefas que leem documento: a cronologia recebia só o comprimento do
texto, o checklist só códigos de tipo, e classificação e entidades **não recebiam argumento
nenhum** — enquanto as quatro instruções mandavam ler o documento. O mock determinístico não
sentia falta porque não lê nada; o defeito só apareceria no primeiro provedor real, respondendo
sobre um texto que nunca viu.

Agora as quatro recebem `sourceText` — conteúdo, tamanho total e o aviso de truncamento, com
limite de 20.000 caracteres declarado em `SOURCE_TEXT_LIMIT`. O checklist recebe também o
**enunciado** de cada exigência: título, descrição e se é obrigatória. A classificação recebe o
catálogo de tipos, que ela mandava respeitar e nunca recebia.

Três testes de deriva novos: uma entrada por tarefa em toda faixa, o texto presente nas quatro
tarefas que o leem, e o enunciado presente no checklist.

### P0.3 — O catálogo de tipos de documento tem 21 códigos genéricos — **CORRIGIDO**

`packages/database/prisma/seed.ts:50`. Não existe MATRICULA — **e o exemplo do próprio prompt de
classificação usa `MATRICULA`**. Também não existem ESCRITURA, COMPROMISSO, RECIBO, BOLETO,
COMPROVANTE_PAGAMENTO, CERTIDAO, DECISAO, DESPACHO, ATA_AUDIENCIA, ACORDO, GUIA_CUSTAS,
FORMAL_PARTILHA, CONTRATO_SOCIAL, HOLERITE, TRCT, CARTAO_PONTO.

Existe um único `CONTRATO` para contrato de locação, cédula bancária, compromisso de compra e
venda, contrato de honorários, aditivo e distrato.

Consequência: os prompts ensinam a distinguir pares cujos códigos não existem. Em adjudicação
compulsória chegam matrícula, escritura e compromisso — ou os três viram OUTRO, ou os três viram
CONTRATO. Nos dois casos o item de checklist "matrícula atualizada" nunca fecha.

**Feito:** 44 códigos acrescentados, de 21 para 65 — matrícula, escritura, compromisso,
decisão, despacho, certidão, ata de audiência, mandado, alvará, recibo, boleto, comprovante de
pagamento, planilha de cálculo, cheque, nota promissória, duplicata, extrato de birô, holerite,
TRCT, cartão de ponto, extrato do FGTS, norma coletiva, certidões de casamento, nascimento e
óbito, pacto antenupcial, testamento, formal de partilha, contrato social, auto de flagrante,
denúncia, inquérito, termo de declarações, certidão de antecedentes, laudo pericial, relatório
de assinatura eletrônica, CRLV e notificação extrajudicial.

Os identificadores do seed derivam do índice (`301 + index`), então código novo entra **só no
fim**: inserir no meio remapearia o id de todo código seguinte e trocaria o tipo de documento já
classificado. O comentário no arquivo diz isso.

### P0.4 — Teto de três citações por afirmação — **CORRIGIDO**

`sourceChunkIds: { minItems: 1, maxItems: 3 }`. "Quais parcelas estão pagas?" numa revisional se
apoia em 24 recibos; "quantos meses de hora extra?" em 18 folhas de ponto. Com teto de três o
modelo escolhe entre citar mal e responder pouco, e nada no prompt diz qual escolher.

Já estava registrado como não atendido no cabeçalho de `trabalhista.ts`.

**Feito:** subiu de três para **cinco**, que é o teto real — a recuperação entrega no máximo
cinco trechos (`grounded-answer-request.dto.ts`, `@Max(5)`), e nenhuma afirmação pode citar o que
não foi recuperado. O bloco `QUEBRE_A_AFIRMACAO` manda quebrar em várias afirmações em vez de
descartar citação.

**Continua aberto:** o teto de recuperação de cinco. "Quais parcelas estão pagas?" sobre 24
recibos não cabe em cinco trechos, e subir esse número é decisão de custo e de contexto, não de
prompt.

---

## P1 — Errado ou perigoso no texto que vai ao modelo

### P1.1 — `datePrecision` travado em DAY — **CORRIGIDO nesta rodada**

O validador exigia `DAY` enquanto o prompt manda respeitar a precisão escrita. Um depoimento
que diz "por volta de 2019" produzia evento rejeitado ou data inventada. Agora aceita os seis
valores do enum, e `importance` aceita os quatro. Dois testes de deriva novos.

### P1.2 — A cronologia é o único prompt sem calibragem de confiança nem regra de importância — **CORRIGIDO**

`IMAGEM_RUIM` está em classificação e entidades nas três faixas, e **em nenhuma cronologia**.
`importance` e `confidenceScore` são obrigatórios na saída e nenhum dos três templates diz uma
palavra sobre eles.

Sem regra, o modelo pontua por interesse narrativo: "o cliente ficou abalado" sai CRITICAL e a
intimação da sentença sai NORMAL. E a cronologia é justamente a tarefa que mais lê data em scan
ruim — é onde a calibragem de confiança faz mais falta.

Regressão do mesmo tipo que o cabeçalho de `trabalhista.ts` já registra ter cometido uma vez.

**Feito:** o bloco `CALIBRAGEM_CRONOLOGIA` entrou nas três faixas e carrega quatro regras de
uma vez — importância como consequência processual, as seis precisões de data, `IMAGEM_RUIM`, a
conferência da numeração impressa (P1.5) e a proibição de nome de menor em título (P1.6).
O parágrafo solto que só o trabalhista tinha foi absorvido: agora há uma fonte só.

### P1.3 — `normalizedValue` é obrigatório e nenhum prompt diz o que é — **CORRIGIDO**

Contra o parágrafo seguinte, que proíbe corrigir grafia. Sem definição, "normalizar" convida o
modelo a arrumar nome próprio e razão social.

Caso concreto: negativação por homônimo, em que a lide inteira é a grafia e o CPF.
"JOAO DA SILVA JUNIOR" virando "João da Silva Júnior" apaga o objeto do pedido dentro do campo
que o revisor humano lê primeiro.

**Feito:** bloco `VALOR_NORMALIZADO` nos três prompts de entidades, com essa definição.

### P1.4 — Julgamento de vigência sem data de referência — **CORRIGIDO**

"Matrícula atualizada", "certidão dentro do prazo", "carência cumprida" são comparações com hoje,
e o modelo não sabe que dia é hoje. Vai chutar — e chutar a data corrente é a alucinação mais
silenciosa que existe, porque o resultado parece razoável.

O trabalhista construiu a defesa certa ("sem essa data na entrada, a exigência está pendente de
informação e você não estima a janela"). O cível perdeu a regra e ficou com o adjetivo.

**Feito:** bloco `SEM_DATA_DE_HOJE` nos checklists do cível e do criminal.

### P1.5 — Página faltando não é detectada por nenhum dos vinte prompts — **CORRIGIDO na cronologia**

`IMAGEM_RUIM` cobre ilegível. Não cobre **ausente** — o defeito mais comum e o único que não
deixa marca visual.

Contrato de 12 folhas com duplo-arrasto comendo as folhas 5 e 6, onde está a cláusula de juros:
sai um PDF de 10 páginas contínuas, todas nítidas, sem nenhum sinal. Folha de assinaturas que
ficou na mesa e o checklist marca "contrato recebido". Matrícula escaneada sem o verso, onde
estão as averbações.

Todo documento que importa traz a própria numeração — "fl. 3 de 12", o carimbo sequencial do
tribunal, a sequência R-1/R-2/Av-3 da matrícula — e nenhum prompt mandava conferi-la.

**Feito:** a regra entrou em `CALIBRAGEM_CRONOLOGIA`. **Falta** levá-la a classificação e
entidades, que também leem página.

### P1.6 — Nome de criança em título de evento — **CORRIGIDO**

Família corre em segredo de justiça e as peças trazem nome completo, escola e endereço de menor.
`title` é campo de lista, exibido antes de qualquer revisão.

**Feito:** a cláusula de sigilo entrou no bloco comum, e `CALIBRAGEM_CRONOLOGIA` manda
identificar pelo papel — "a filha menor", "o interditando" — deixando o nome apenas no trecho
original localizado.

### P1.7 — Cronologia vazia e status ILLEGIBLE

Do parecer do sênior: o contrato não distingue "examinei e não há eventos" de "não consegui
examinar". Some com P0.1 — é a mesma família de defeito.

---

## P2 — Lacunas de conteúdo jurídico, por faixa

### Criminal — **CORRIGIDO nesta rodada**

- Justiça consensual saía como não-condenação sem registro. Um modelo que aprende "transação não
  é antecedente" descarta o registro que decide o próximo benefício. Reescrito.
- Contradição na classificação entre quatro termos consensuais. Separados por assinatura.
- `contestação` vazando do bloco comum — **não existe contestação no processo penal**. Neutralizado.
- Papel `AUTOR DO FATO` faltando no rol. Incluído.
- Prescrição em duas cláusulas; "cite-se" na mesma decisão.

### Trabalhista — **CORRIGIDO em rodada anterior**

Cinco erros de direito que eu escrevi (projeção do aviso prévio "para todos os efeitos"; controle
de ponto como obrigação universal; "instrumento coletivo é por ano"; "citação interrompe a
prescrição", que é CPC/73; "duas testemunhas" sem a exceção do contrato eletrônico) e três
regressões contra os prompts genéricos.

### Cível — **PENDENTE, é a faixa mais atrasada**

- **Família e sucessões inteiras ausentes.** Sete dos trinta tipos levantados, e nenhum documento
  deles chegou ao prompt: certidão de casamento com averbação, pacto antenupcial e regime de bens,
  planilha do débito alimentar, certidão de óbito, testamento e certidão da central, negativas
  fiscais nas três esferas, ITCMD, primeiras declarações, plano de partilha, extratos **na data do
  óbito**.
- **Endereço não é entidade** — e decide citação válida, foro de eleição, competência do consumidor
  e constituição em mora.
- **Número CNJ não é extraído.** A Entrega 15 autorizada chama-se "o caso carrega o número do
  processo" e o extrator não o extrai.
- **Matrícula sem cartório e comarca não identifica imóvel nenhum** — a 12.345 existe em todo
  cartório do Brasil.
- **Veículo não é entidade.** Placa muda, chassi não; busca e apreensão cumprida no carro errado.
- **Extrato de birô de crédito** — quatro colunas de data vizinhas e duas de pessoa. Trocar credor
  por informante atribui ao réu anotação de outro. E a anotação anterior legítima é o fato que
  decide o pedido de dano moral: é a triagem que o advogado faz antes de aceitar a causa.
- **Disponibilização × publicação** ausente. Sentença assinada dia 12, disponibilizada 14,
  publicada 15: o prazo corre do 15 e o modelo registra 12.
- **Documentos que fazem perder prazo** — custas, preparo, porte de remessa e retorno, ITBI/ITCMD,
  decisão sobre gratuidade, e o ato que prova poderes de quem assinou a procuração pela pessoa
  jurídica. Apelação deserta é morte por documento não juntado, não por tese ruim.
- **Exceção da verdade** está no bloco cível e é peça criminal. Ocupa o lugar das inversões que
  aparecem toda semana — reconvenção, denunciação da lide, consignação —, e deixa de fora os feitos
  **sem autor e réu**: inventário tem inventariante e herdeiros; interdição tem requerente e
  interditando.
- **Alienação fiduciária**: o que decide a liminar não é o contrato, é a comprovação da mora
  entregue **no endereço do contrato**, e o registro do gravame.
- **Boleto não é comprovante de pagamento**, e comprovante de agendamento também não.
- **Capa e índice de juntadas** dos autos exportados geram cronologia inteira a partir do sumário.
- **Certidão de decurso de prazo** é documento positivo de fato negativo, e a regra atual a joga fora.
- **Óbito não é evento** — abre a sucessão, fixa o acervo e a data de avaliação, e suspende o feito.

---

## P3 — Governança. Não quebra hoje, decide se dá para usar amanhã

### P3.1 — A guarda de rascunho protege o ambiente errado

`assertUsableIn` recusa `DRAFT` quando `NODE_ENV === 'production'`. Mas o risco não é o nome do
ambiente — é o dado ser real. Uma homologação com acervo de cliente passa pela guarda.

**Conserto:** condicionar à natureza do dado, não ao rótulo do processo.

### P3.2 — `REVIEWED` não significa nada

É um literal de união. Não registra quem revisou, com qual inscrição na OAB, em que data, nem
contra qual versão do texto. Qualquer pessoa promove qualquer prompt trocando uma palavra.

**Conserto:** `REVIEWED` só com nome, OAB e data do advogado revisor no próprio registro.

### P3.3 — Ordem de piloto

Trabalhista primeiro: é a faixa com checklist template semeado, a mais revisada, e a de menor dano
por erro. Criminal por último: é onde um erro custa liberdade.

---

## O que falta — portões que continuam fechados

Nada aqui está errado; está ausente. Todos **bloqueiam** o primeiro provedor real,
independentemente da qualidade dos prompts.

| Portão                                                            | Origem                 | Estado                                     |
| ----------------------------------------------------------------- | ---------------------- | ------------------------------------------ |
| Custo consultável por organização, provedor e modelo              | ADR-011, verificação 3 | Por caso existe e é enforçado; falta somar |
| Termos de tratamento de dados registrados                         | ADR-011, verificação 4 | `docs/legal/` não existe                   |
| Lista de suboperadores versionada                                 | ADR-012                | Não existe                                 |
| Legal hold                                                        | ADR-012                | Zero ocorrências em código                 |
| Custo do assistente debitando o orçamento do caso                 | ADR-011                | Calcula e audita, não desconta             |
| Canal de entrada por e-mail                                       | ADR-010                | Decidido como MVP, nunca construído        |
| `ProcessingCostPolicy.quote()` recebendo páginas, bytes ou tokens | ADR-011                | Assinatura não expressa cotação real       |
| Os três gatilhos de notificação                                   | ADR-013                | Não implementados                          |
| Um único prompt `REVIEWED`                                        | Esta entrega           | Vinte de vinte em `DRAFT`                  |

E uma dívida que não é de ADR nenhum: **a senha guardada em `localStorage`** no front, decidida
pelo dono depois de eu objetar uma vez. Fica registrada como bloqueio de produção.

---

## Veredito das três revisões

O sênior: _"Sim, com condições — e as condições não são negociáveis."_

A lente de prática sobre o cível: os prompts descrevem o **direito** com competência e descrevem
o **acervo** pela metade.

Meu resumo: o texto está melhor do que a tubulação. Os quatro defeitos P0 não se resolvem
escrevendo, e são eles que hoje limitam o que a biblioteca inteira consegue entregar.
