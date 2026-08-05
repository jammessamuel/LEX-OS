# ADR-010: Decidir os canais de ingestão do MVP

- **Status:** Proposto — depende de decisão da sociedade
- **Data:** 2026-08-05
- **Decisores:** sócios da SAMUEL DEV LTDA
- **Trava:** componente conceitual #1, e se a Fase 1 é viável como está escrita
- **Idioma:** pt-BR, por ser documento de decisão para a sociedade e não documentação técnica

## Contexto

A proposta conceitual descreve uma **Central de Ingestão** recebendo documentos de WhatsApp, e-mail, upload, scanner, APIs e pastas monitoradas. É o componente #1 e o primeiro item da Fase 1.

O `docs/product/mvp-scope.md` lista "integrações de WhatsApp ou mensageria ao vivo" como explicitamente fora de escopo. O que existe hoje é apenas upload HTTP multipart, entregue na Delivery 6.

WhatsApp é o diferencial mais citado na proposta e o que tem menos análise por trás. Fatos que pesam na decisão:

- A WhatsApp Business Platform cobra por conversa, exige verificação de conta Meta Business, exige aprovação de template para mensagens iniciadas pela empresa e restringe contato iniciado pela empresa fora da janela de atendimento.
- Documentos que o cliente envia por WhatsApp transitam pela infraestrutura da Meta antes de chegar ao LEX OS. Para um escritório recebendo material privilegiado de cliente, isso é uma questão de proteção de dados, não apenas de integração. Interage com o ADR-012.
- Mídia recebida por WhatsApp chega sem o nome de arquivo, sem confiabilidade de MIME e sem as garantias de proveniência sobre as quais o pipeline de entrada atual foi construído.

"Pastas monitoradas" implica um agente instalado nas máquinas dentro do escritório: distribuição, atualização automática, assinatura de código, permissões de endpoint e suporte próprio. Isso é um segundo produto, não uma funcionalidade deste.

E-mail é diferente dos dois. Escritórios já recebem documentos por e-mail, o Mailpit já está no stack local, e o adaptador é contido: buscar, verificar o remetente contra o cliente, tratar todo anexo como entrada hostil e entregar ao pipeline de entrada que já existe.

## Opções

### A. Somente upload no MVP

Todos os demais canais viram conectores pós-MVP. É a posição atual do `mvp-scope.md`.

### B. Upload mais ingestão por e-mail — _recomendada_

Adicionar um adaptador autenticado de entrada por e-mail dentro do MVP. WhatsApp e pastas monitoradas viram conectores explicitamente agendados, cada um com seu próprio ADR. Entrada por scanner já é coberta pelo upload.

### C. WhatsApp dentro do MVP como porta de entrada

Tratar mensageria como canal primário de aquisição e construí-la primeiro.

## Recomendação

**Opção B.**

A opção A deixa o componente #1 da proposta em cerca de um quinto do que foi descrito, e deixa a Fase 1 inviável como está escrita.

A opção C antecipa o canal de maior custo e maior incerteza — termos comerciais, verificação junto à Meta, economia por conversa e uma questão de proteção de dados que o ADR-012 ainda não respondeu — antes de o produto ter interface funcionando. Também constrói um canal de aquisição antes de existir algo demonstrável para onde adquirir.

A opção B fecha a maior parte da lacuna real com custo baixo, reaproveita a entrada em streaming, a quarentena, a verificação de MIME e o caminho do scanner já construídos na Delivery 6, e deixa o WhatsApp _decidido_ em vez de ambíguo. A ambiguidade é o problema atual: dois documentos discordam e nenhum é autoritativo.

Seja qual for a escolha, pastas monitoradas devem ser registradas como iniciativa de produto separada, não como um item dentro do componente #1.

## Consequências

### Positivas

- e-mail reaproveita o caminho de entrada existente: chaves geradas, SHA-256, inspeção de assinatura MIME, quarentena e a interface de scanner que falha fechada;
- a proposta e o documento de escopo param de se contradizer;
- a análise de economia e de proteção de dados do WhatsApp acontece antes do compromisso, não durante a implementação.

### Negativas

- entrada por e-mail traz preocupações de autenticação e falsificação de remetente que o upload não tem; um remetente não verificado nunca pode vincular documento a caso;
- polling de caixa ou entrega por webhook adiciona dependência de disponibilidade e um novo modo de falha a reconciliar;
- adiar o WhatsApp pode enfraquecer o discurso comercial se a venda estiver sendo feita em cima dele.

## Alternativas rejeitadas

- **Aceitar qualquer anexo de qualquer remetente:** transforma o pipeline de entrada em relay aberto para arquivos hostis.
- **Confiar no nome do arquivo ou no MIME declarado no e-mail:** o pipeline atual já rejeita isso para uploads; e-mail não é exceção.
- **Vincular uma mensagem a um caso lendo o assunto sem autorização:** permite que alguém de fora escreva dentro de um cliente.

## Verificações de conformidade

- Um e-mail de remetente não reconhecido não pode criar nem alterar dado de cliente algum.
- Anexos seguem o mesmo caminho de tamanho, quantidade, tipo, assinatura, quarentena e scanner que os uploads.
- A mensagem de origem é retida como proveniência de cada documento que ela gerou.
- Nenhum conteúdo de corpo de mensagem é registrado em log.
- Entrega cruzada entre clientes é impossível: o vínculo caixa-postal/cliente é do lado do servidor e nunca derivado do conteúdo da mensagem.

## Necessário antes de

Qualquer trabalho no componente conceitual #1 além de upload, e antes de a Fase 1 da proposta ser declarada iniciada.
