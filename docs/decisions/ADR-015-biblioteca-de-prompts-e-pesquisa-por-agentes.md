# ADR-015: Biblioteca de prompts e pesquisa por agentes

- **Status:** Aceito — decidido pela sociedade em 2026-08-26
- **Data:** 2026-08-26
- **Decisores:** sócios da SAMUEL DEV LTDA
- **Trava:** nenhum texto de processo sai; nenhum provedor real entra
- **Idioma:** pt-BR, por ser documento de decisão para a sociedade e não documentação técnica
- **Acopla:** ADR-001 (raízes de composição), ADR-006 (portas de provedor), ADR-009 (resposta
  fundamentada), ADR-011 (custo antes do provedor), ADR-012 (suboperadores)

## Decisão (2026-08-26)

Sete decisões. As duas primeiras são as que mudam como se trabalha daqui em diante; as cinco
seguintes existem porque três revisões adversariais mostraram que sem elas a primeira não vale.

| #   | Decisão                                                                | Condição inegociável                                                        |
| --- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1   | O prompt é artefato de código, versionado no monorepo                  | Nunca em tabela de banco, nunca em serviço próprio, nunca em SaaS de prompt |
| 2   | Agentes pesquisam; advogado revisa. O prompt nasce `DRAFT`             | Promoção a `REVIEWED` exige nome, OAB e data de quem revisou                |
| 3   | **O contrato de saída faz parte do prompt**                            | Prompt que não consegue dizer o que viu é prompt defeituoso                 |
| 4   | A guarda de rascunho depende do dado ser real, não do ambiente         | `NODE_ENV` é rótulo de processo, não medida de risco                        |
| 5   | O catálogo de especialidades normaliza apelidos sem fechar `legalArea` | Caso existente com área fora do catálogo continua funcionando               |
| 6   | Toda alteração de prompt passa por revisão adversarial por lentes      | Mínimo três lentes: parecer sênior, alucinação, prática                     |
| 7   | Nenhum provedor real antes dos portões do ADR-011 e do ADR-012         | Reafirmação, não decisão nova                                               |

**Prioridade de execução.** O item 3 vem primeiro e já foi parcialmente executado — é o único
que hoje limita todos os outros. O item 4 vem em seguida, por ser o que separa "rascunho não
encosta em caso real" de uma frase de efeito. O item 2 depende de existir um advogado revisor
nomeado, o que é decisão de pessoa, não de código. Os itens 1, 5, 6 e 7 já estão em vigor.

## Contexto

Até 2026-08-25 o repositório tinha três `PromptSpecification` com identificador, versão,
schemas e critérios — **e nenhum texto de prompt**. O único campo que o código de produção lia
era `.version`, usado para carimbar procedência. E `legalArea` era `VarChar(120)` livre, com
divergência já solta: o seed gravava `TRABALHISTA`, os testes do front usavam
`DIREITO_TRABALHISTA`, e nada impedia.

A Entrega 16 foi autorizada para resolver isso: escrever a biblioteca de verdade, organizada
por especialidade e tarefa, alimentando as portas de provedor que já existem.

O que produziu **este** registro não foi a escrita, foi o que veio depois dela. Três revisões
adversariais correram sobre os vinte prompts escritos, e o resultado inverteu a premissa de
trabalho: o texto estava melhor que a tubulação.

## Por que este registro existe

Um ADR se justifica quando a decisão é cara de reverter e não se deduz do código. Aqui há
quatro coisas assim, e nenhuma delas estava escrita em lugar nenhum.

### 1. O contrato de saída faz parte do prompt

Esta é a decisão que a rodada arrancou, e ela contraria o instinto.

O prompt de checklist era o mais bem escrito dos cinco — e o que menos decidia. O banco tem
oito estados; a saída aceitava dois. Ilegível, inválido e vencido saíam todos como "não
atendido", que na tela do advogado se lê **"não recebemos"**. Ele pedia o documento ao cliente,
o cliente reenviava o mesmo scan ruim, e o ciclo repetia até a véspera do prazo. O próprio
texto do prompt declarava querer "o pedido ao cliente ser de novo escaneamento e não de novo
documento" — contra um canal que tornava a distinção impossível de transmitir.

O mesmo padrão apareceu três vezes mais: o validador exigia precisão de data em dia enquanto o
prompt mandava respeitar a precisão escrita, forçando data inventada; o catálogo tinha 21
códigos genéricos enquanto a classificação ensinava a distinguir pares cujos códigos não
existiam — o exemplo do próprio prompt usava `MATRICULA`, que não era semeado; e o teto de três
citações por afirmação obrigava a descartar fonte numa pergunta apoiada em 24 recibos.

**A regra que fica:** ao revisar um prompt, o revisor lê o contrato de saída junto. Um prompt
que instrui a observar o que a saída não comporta não é um prompt bom com uma limitação — é um
prompt defeituoso, e a correção é no contrato.

A alternativa — tratar contrato e texto como camadas separadas, cada uma com seu dono — foi
recusada porque foi exatamente ela que produziu os quatro defeitos: cada camada estava correta
sozinha.

### 2. A guarda de rascunho protege o dado, não o ambiente

`assertUsableIn` recusa prompt `DRAFT` quando `NODE_ENV === 'production'`. Parece
fail-closed e não é: o risco nunca foi o nome do processo, foi o acervo ser de cliente. Uma
homologação com material real passa pela guarda inteira sem tocá-la.

A alternativa de manter o critério por ambiente e "cuidar para não subir dado real em
homologação" foi recusada: é procedimento humano onde cabe invariante de código, e o produto
inteiro se vende dizendo o contrário.

**Ainda não implementado.** É o item 4 da tabela e o próximo da fila.

### 3. `REVIEWED` precisa significar uma coisa só

Hoje é um literal de união. Não registra quem revisou, com qual inscrição, em que data, nem
contra qual versão do texto. Qualquer pessoa promove qualquer prompt trocando uma palavra.

Isso não é higiene de processo: os cinco prompts genéricos estão marcados `REVIEWED` **por
decisão do dono**, e os quinze de especialidade nascem `DRAFT` porque vieram de pesquisa
automatizada. Se a marca não carrega quem assinou, as duas origens ficam indistinguíveis no
dia em que alguém precisar responder por uma delas.

A alternativa de confiar na revisão de código do Git foi recusada: o histórico diz quem
alterou o arquivo, não quem se responsabilizou pelo conteúdo jurídico.

### 4. Revisão adversarial por lentes é o controle de qualidade, e ele se pagou

Não é preferência de método. Na faixa trabalhista, a lente de alucinação encontrou **três
citações fabricadas** — a pior delas tratando aborto como marco inicial de estabilidade da
gestante. A lente de prática encontrou três regressões em que a versão de especialidade tinha
perdido regras que os genéricos já tinham. O parecer sênior encontrou cinco erros de direito
que eu havia escrito com confiança.

Nenhum desses erros seria pego por teste automatizado, por revisão de código ou por leitura
casual. Todos foram pegos por alguém instruído a procurar aquele tipo específico de defeito.

**Mínimo de três lentes por faixa:** parecer sênior (o texto está juridicamente correto?),
alucinação (cada número de artigo, súmula e tema confere?) e prática (isto descreve o acervo
como ele chega, ou como ele deveria chegar?).

**Custo.** O dono sinalizou em 2026-08-25 que o consumo de agentes estava alto demais. A
resposta não é abandonar as lentes — é rodá-las sobre o texto final, uma vez, em vez de sobre
cada rascunho intermediário. Foi o que se fez nesta rodada.

## Alternativas recusadas

**Serviço próprio de IA na Railway.** O ADR-001 fixa duas raízes de composição de backend e
exige ADR novo para extrair uma terceira. Um `apps/ai-gateway` custaria esse ADR revertido,
nove arquivos novos, mudanças em Dockerfile, Compose e CI, e herdaria a exigência das cerca de
quarenta chaves de configuração — sem entregar nenhuma capacidade que a porta
`GROUNDED_LANGUAGE_MODEL_PROVIDER` já não ofereça. Recusado.

**Prompt em tabela de banco, editável pela interface.** Atraente para quem quer ajustar sem
deploy, e incompatível com o resto: procedência exige versão imutável carimbada em cada
extração, e prompt editável em produção sem revisão contradiz frontalmente a decisão 2.
Recusado.

**Fechar `legalArea` num enum.** Casos existentes usam valores que um catálogo fechado
invalidaria. O catálogo normaliza apelidos conhecidos — `DIREITO_TRABALHISTA` para
`TRABALHISTA` — e serve para selecionar prompt; o campo continua livre. Recusado fechar.

**Trocar os validadores escritos à mão por um validador de JSON Schema.** Os parsers do worker
são fail-closed e têm teste. Em vez de substituí-los em caminho de produção, um teste de
deriva compara cada `outputSchema` com o que o parser aceita. Foi esse teste que pegou o
`datePrecision` travado em dia. Recusado substituir.

## Consequências

**O que fica mais fácil.** Trocar de provedor não toca em prompt. Revisar juridicamente uma
faixa inteira é ler um arquivo. A procedência gravada em cada extração aponta para um texto
que existe — antes apontava para `deterministic-prompt-v1`, uma versão que não correspondia a
prompt nenhum.

**O que fica mais caro.** Toda mudança de prompt agora arrasta revisão adversarial e leitura
do contrato de saída. Mudar o contrato arrasta migração, validador, mapeamento de API e teste
de deriva. É caro de propósito: foi a separação entre essas camadas que produziu os defeitos.

**O que continua fechado.** Nenhum provedor real, nenhum texto de processo saindo. Os portões
do ADR-011 (custo consultável, termos registrados) e do ADR-012 (lista de suboperadores,
legal hold) continuam valendo integralmente, e nenhum deles existe hoje.

## Condição para quem mexer nisto depois

Três mudanças exigem voltar aqui antes:

1. **Primeiro provedor real de modelo.** Reabre ADR-006, ADR-011 e ADR-012 juntos.
2. **Prompt editável fora do repositório**, por qualquer mecanismo. Contradiz as decisões 1 e 2.
3. **Qualquer alteração de contrato de saída de tarefa de IA.** Passa pela decisão 3: o
   revisor jurídico lê o contrato junto com o texto.
