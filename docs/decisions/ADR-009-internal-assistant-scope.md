# ADR-009: Definir o escopo do Assistente Interno

- **Status:** Proposto — depende de decisão da sociedade
- **Data:** 2026-08-05
- **Decisores:** sócios da SAMUEL DEV LTDA
- **Trava:** componente conceitual #10, escopo da Fase 3, desdobramentos da Delivery 9
- **Idioma:** pt-BR, por ser documento de decisão para a sociedade e não documentação técnica

## Contexto

A proposta conceitual lista um **Assistente Interno** como componente de arquitetura #10 e o coloca na Fase 3, descrevendo-o como a capacidade de "conversar com toda a base de conhecimento do escritório".

O `docs/product/vision.md` afirma que o LEX OS **não é** "um chatbot jurídico genérico", e o `docs/product/mvp-scope.md` prevê apenas uma fundação de busca e memória: recuperação lexical e semântica filtrada por cliente, resultados com referência de origem, e um contrato explícito de evidência insuficiente em vez de resposta sem apoio.

São produtos diferentes. Os dois documentos discordam, e nenhuma entrega do plano constrói uma superfície conversacional. A Delivery 9 constrói o substrato de recuperação sobre o qual qualquer assistente se apoiaria, então a decisão é necessária antes de a Delivery 9 ser desenhada, não depois.

A distinção que importa não é "com chat ou sem chat". É se o sistema pode produzir texto que não seja diretamente atribuível a uma fonte autorizada. É essa propriedade, e não a interface, que define o perfil de responsabilidade num contexto jurídico.

## Opções

### A. Sem assistente — apenas recuperação

A busca devolve trechos ranqueados com citação. O advogado lê as fontes. Nenhum texto gerado.

### B. Resposta ancorada em fontes autorizadas — _recomendada_

Uma superfície de pergunta e resposta restrita de modo que:

- a recuperação seja escopada por cliente e filtrada por permissão **antes** da geração;
- toda afirmação carregue um localizador de origem resolvível (documento, página, offset);
- a resposta seja recusada quando a recuperação não devolver nenhuma fonte autorizada de apoio;
- o modelo possa resumir e conectar trechos recuperados, mas não possa introduzir fatos ausentes deles;
- o conteúdo do documento fique estruturalmente separado das instruções, conforme o ADR-006;
- nenhuma resposta seja apresentada como parecer jurídico ou fato confirmado, e toda resposta seja marcada como gerada por máquina.

Histórico de conversa pode existir por usabilidade, mas cada resposta é reancorada; o histórico não é fonte.

### C. Assistente conversacional pleno

Diálogo aberto com memória persistente sobre o acervo do escritório, capaz de discussão jurídica geral além do material recuperado.

## Recomendação

**Opção B.**

A opção A entrega menos do que foi apresentado aos sócios. "Conversar com a base de conhecimento" é um diferencial de destaque na proposta, e busca pura não satisfaz isso.

A opção C é exatamente a commodity que o posicionamento rejeita — a própria proposta argumenta que chat com LLM está virando commodity e que o LEX OS deve competir em outro lugar. É também a de maior exposição: geração sem ancoragem em contexto jurídico corre o risco de uma citação inventada chegar a uma peça protocolada.

A opção B preserva a promessa e o posicionamento. É também a consumidora natural do substrato da Delivery 9, em vez de um sistema à parte, e o comportamento de recusa já está especificado no `mvp-scope.md`.

## Consequências

### Positivas

- o assistente vira uma camada de apresentação sobre recuperação que já é necessária, não arquitetura nova;
- comportamento de recusa e exigência de citação são testáveis e já estão contratados;
- o produto mantém intacto o seu argumento de diferenciação.

### Negativas

- usuários acostumados a chatbots genéricos vão sentir as recusas como limitação, e isso precisa ser tratado no texto da interface;
- resposta ancorada ainda consome tokens de modelo de linguagem por pergunta, o que alimenta o modelo de custo do ADR-011;
- resumir vários trechos ainda pode distorcer sentido mesmo com toda frase tendo fonte, então a revisão humana continua necessária.

## Alternativas rejeitadas

- **Responder com conhecimento do modelo quando a recuperação vier vazia:** viola a promessa central do produto e é o modo de falha de maior responsabilidade.
- **Tratar o histórico de conversa como fonte:** permite que uma afirmação anterior da máquina vire evidência de uma posterior.
- **Entregar o assistente antes da Delivery 9:** não há nada autorizado onde ancorar as respostas.

## Verificações de conformidade

- Uma resposta sem localizador de origem quebra um teste em vez de chegar ao usuário.
- Fontes de outro cliente ou confidenciais nunca entram no conjunto de recuperação, inclusive em contagens e ranqueamento.
- Testes de prompt injection cobrem documentos que tentem alterar o comportamento do assistente ou revelar outros clientes.
- Toda resposta é auditável até as fontes e a versão de modelo que a produziram.
- O texto da interface nunca apresenta uma resposta como parecer jurídico.

## Necessário antes de

Iniciar o desenho da Delivery 9.
