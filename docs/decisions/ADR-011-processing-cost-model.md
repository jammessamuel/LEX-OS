# ADR-011: Estabelecer o modelo de custo de processamento e a escolha de provedores

- **Status:** Proposto — depende de decisão da sociedade
- **Data:** 2026-08-05
- **Decisores:** sócios da SAMUEL DEV LTDA
- **Trava:** componentes conceituais #4 e #5 saírem do estado de mock; formação de preço
- **Idioma:** pt-BR, por ser documento de decisão para a sociedade e não documentação técnica

## Contexto

A proposta conceitual promete um agente que "recebe centenas de arquivos e devolve um dossiê jurídico organizado". Cada arquivo pode exigir OCR, às vezes transcrição, depois classificação, extração de entidades e geração de embeddings. Processamento é, portanto, o custo variável dominante do produto, e ele escala com o volume de documentos do cliente, não com o número de pessoas do escritório.

Nenhum número de custo aparece em lugar algum da proposta, e nenhuma unidade de cobrança foi escolhida.

O `docs/product/vision.md` já exige instrumentar "custo de processamento por provedor, modelo, caso e organização". A instrumentação está especificada; o modelo que ela deveria alimentar, não. O ADR-006 mantém todo provedor atrás de uma porta substituível, então esta é uma decisão comercial e não arquitetural — a arquitetura é deliberadamente indiferente a qual fornecedor vence.

Duas consequências tornam isso urgente em vez de adiável:

1. Substituir qualquer mock por um provedor real começa a gastar dinheiro por documento. Enquanto não existir um teto, um único cliente subindo um caso atípico produz uma conta ilimitada.
2. Enviar conteúdo de documento a um provedor terceiro torna esse provedor **suboperador** dos dados dos clientes do escritório. A escolha de provedor fica, portanto, acoplada ao ADR-012 e não pode ser feita apenas por preço.

## Decisões necessárias

1. **Unidade de cobrança.** Pelo que o cliente é faturado.
2. **Teto de custo por caso.** O máximo que o pipeline pode gastar antes de parar e chamar um humano.
3. **Provedor inicial por capacidade.** OCR, transcrição, classificação, extração de entidades, embeddings, modelo de linguagem.
4. **Comportamento no teto.** O que o produto faz quando um caso estoura o orçamento.
5. **Termos de tratamento de dados.** Se o provedor candidato permite contratualmente tratar dados pessoais e jurídicos brasileiros, e se ele treina com o conteúdo enviado.

## Opções de unidade de cobrança

### A. Por usuário

Simples e com receita previsível. Desacopla preço de custo por completo: um escritório com volume alto de documentos e o mesmo número de usuários fica deficitário, e quem extrai mais valor paga menos.

### B. Por caso preparado

Alinha receita a custo e à unidade de valor que o produto realmente entrega — "Preparar processo" é a experiência central. Mais difícil de projetar, e penaliza justamente o comportamento que o produto quer estimular.

### C. Base por usuário mais medição acima de uma franquia inclusa — _recomendada_

Uma base previsível, no formato em que escritórios já compram software, com o componente variável ligado ao custo variável. A franquia é dimensionada para que o uso comum nunca chegue a ser medido.

## Recomendação

**Opção C para cobrança, mais um teto rígido de processamento por caso aplicado dentro do pipeline.**

O teto importa tanto quanto a unidade de cobrança. O `ProcessingJob` já registra provedor, modelo, duração e confiança por execução; estendê-lo para registrar custo e recusar continuar além de um limite configurado é uma mudança contida. Sem isso, o modo de falha é gasto silencioso descoberto na fatura.

Ao atingir o teto, o pipeline deve parar e levar o caso para revisão humana, em vez de continuar gastando ou falhar o caso inteiro. Um dossiê parcialmente preparado com um estado explícito de "orçamento atingido" é mais útil que qualquer das duas alternativas, e encaixa no estado `NEEDS_REVIEW` que já existe.

A escolha de provedor deve ser feita por capacidade, não por fornecedor. Qualidade de OCR em documento jurídico digitalizado brasileiro, qualidade de transcrição em português do Brasil e custo de embedding são perguntas independentes, com vencedores diferentes.

## Consequências

### Positivas

- custo vira propriedade mensurável e de primeira classe do processamento, em vez de surpresa na fatura;
- a escolha por capacidade preserva o benefício do ADR-006 em vez de colapsar em dependência de fornecedor único;
- um teto aplicado converte um risco financeiro ilimitado em um estado de produto delimitado.

### Negativas

- cobrança medida exige contabilização de uso, faturamento e tratamento de contestação, que o MVP não tem e que o `mvp-scope.md` hoje exclui;
- um teto por caso pode interromper um caso legitimamente grande e precisa de um caminho de liberação autorizada;
- registrar custo por execução acrescenta mais um campo a uma tabela que já é append-only e de volume alto.

## Alternativas rejeitadas

- **Escolher o provedor mais barato por capacidade olhando só o preço:** ignora as questões de suboperador e de treinamento com o conteúdo, tratadas no ADR-012, que podem desqualificar um fornecedor independentemente do preço.
- **Adiar o teto até o primeiro provedor real entrar:** o teto é justamente o controle que torna seguro colocar um provedor real; não é tarefa posterior.
- **Estimar custo apenas pela quantidade de documentos:** número de páginas, qualidade da digitalização e duração de áudio dominam; um PDF nativo de dez páginas e uma gravação de duas horas não são unidades comparáveis.
- **Absorver o custo de processamento num preço fixo sem medição:** não é possível precificar o produto sem saber quanto custa um caso.

## Verificações de conformidade

- Toda execução de provedor registra provedor, modelo, versão do modelo e custo.
- Um caso não pode ultrapassar seu orçamento configurado sem liberação explícita e autorizada, e a liberação é auditada.
- Os valores de custo são consultáveis por organização, caso, provedor e modelo.
- Nenhum provedor entra em produção sem termos de tratamento de dados registrados.
- Casos interrompidos por orçamento chegam a um estado visível e recuperável, nunca a uma falha silenciosa.

## Necessário antes de

Substituir qualquer mock por provedor real, e antes de qualquer preço ser apresentado a um cliente.
