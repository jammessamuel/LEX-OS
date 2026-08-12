# Alinhamento de roadmap: proposta conceitual x plano de implementação

**Status:** Registro de reconciliação
**Última atualização:** 2026-08-12
**Idioma:** este documento e os ADR-009 a ADR-013 são escritos em pt-BR porque o público é a sociedade da SAMUEL DEV LTDA, não a equipe de engenharia. A documentação técnica do repositório permanece em inglês, conforme `AGENTS.md`.

## Objetivo

Dois documentos descrevem o LEX OS e eles não usam a mesma unidade de medida.

- A **proposta conceitual** preparada para os sócios descreve 11 componentes de arquitetura e um roadmap de MVP em 4 fases.
- O **plano de implementação** (`../architecture/implementation-plan.md`) descreve 12 entregas incrementais com critérios de aceite.

Nada liga um ao outro. Por isso a pergunta "onde estamos na Fase 1?" hoje não tem resposta. Este documento é essa ligação. Ele também registra onde os dois documentos realmente discordam, para que essas divergências sejam decididas de propósito e não resolvidas por quem escrever código primeiro.

É um registro de reconciliação, não um plano novo. Não altera escopo. Onde uma decisão já foi tomada, registra a consequência sem autorizar código fora da entrega ativa.

## Por que o progresso parece invisível

A proposta conceitual enumera capacidades de produto. Ela não tem nenhuma linha para isolamento entre clientes, autenticação, RBAC, auditoria, entrada segura de arquivos ou pipeline de processamento — a plataforma sobre a qual essas capacidades se apoiam.

Cinco das nove entregas concluídas foram exatamente nisso:

| Entrega | Resultado                                    | Componente na proposta         |
| ------- | -------------------------------------------- | ------------------------------ |
| 0       | Linha de base arquitetural, 8 ADRs           | nenhum                         |
| 1       | Fundação de qualidade do monorepo            | nenhum                         |
| 2       | Infraestrutura local e health checks         | nenhum                         |
| 3       | Banco, migração e seed fictício              | nenhum                         |
| 4       | Plataforma HTTP, autenticação, tenancy, RBAC | nenhum                         |
| 5       | Pessoas, casos e participantes               | nenhum                         |
| 6       | Entrada segura de arquivos e documentos      | parte do #1                    |
| 7       | Pipeline de processamento persistente        | #2, e a forma mock dos #4 e #5 |
| 8       | Timeline, checklist e tarefas rastreáveis    | #6 e #7                        |

Essa é a ordem correta de construção — nenhum dos 11 componentes pode entrar em produção com segurança sem ela. Mas significa que a maior parte do trabalho feito até aqui não aparece quando se lê a proposta. Essa lacuna é de percepção e de documentação, não de entrega.

## Mapeamento dos componentes

| #   | Componente              | Entrega responsável      | Situação                                                                                                                                                                                                                                                                                                    |
| --- | ----------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Central de Ingestão     | 6 (parcial)              | **Parcial.** Apenas upload HTTP multipart existe. O ADR-010 incluiu e-mail no MVP, mas esse incremento ainda não foi agendado. WhatsApp é conector futuro; pastas monitoradas são iniciativa separada                                                                                                       |
| 2   | Pipeline Inteligente    | 7                        | **Estrutura completa, inteligência simulada.** Contratos de fila, ciclo de vida do job, retry, reconciliação e proveniência têm forma de produção. Todos os provedores são mocks determinísticos. Não existe estágio de transcrição                                                                         |
| 3   | Organizador Inteligente | **nenhuma**              | **Sem entrega.** Existe apenas vínculo de duplicata por SHA-256 dentro do mesmo cliente. Estrutura de pastas, versionamento e renomeação inteligente não têm entrega no plano                                                                                                                               |
| 4   | OCR Jurídico            | 7 (mock)                 | **Mock.** A extração de texto devolve fixtures determinísticos. Extração de CPF, CNPJ, OAB, datas, valores e número de processo _a partir do conteúdo do documento_ não existe. A validação de CPF/CNPJ que existe é de cadastro de pessoa, não de extração                                                 |
| 5   | Extração Semântica      | 7 (mock)                 | **Mock.** `ExtractedEntity` carrega página, offsets, confiança e `linkedPersonId`; os valores são fabricados                                                                                                                                                                                                |
| 6   | Timeline Engine         | 8                        | **Concluída com inteligência simulada.** Eventos carregam documento, localizador, extração, confiança e começam não confirmados; a confirmação humana preserva a extração original                                                                                                                          |
| 7   | Checklist Inteligente   | 8                        | **Concluída com inteligência simulada.** Template versionado, snapshot por caso, revisão de itens, vínculo documental no mesmo caso e tarefa rastreável estão implementados                                                                                                                                 |
| 8   | Workspace               | 10                       | **Iniciada como preparação, não aceita como Entrega 10.** Login, lista/detalhe de caso, envio, progresso e procedência já usam a API real. Criação/edição, participantes, download, correção humana, timeline, checklist, busca, auditoria autorizada, matriz completa de acessibilidade e E2E ainda faltam |
| 9   | Memory Engine           | 9                        | **Autorizada.** `KnowledgeChunk` e pgvector já existem como fundação; a Entrega 9 implementa indexação determinística, busca lexical/semântica e resultados citáveis                                                                                                                                        |
| 10  | Assistente Interno      | incremento posterior à 9 | **Decidido.** Será resposta ancorada em fontes autorizadas, com recusa sem evidência. Não é chat jurídico genérico. A Entrega 9 fornece a recuperação; a superfície de resposta continua sem entrega agendada — ver ADR-009                                                                                 |
| 11  | Agente Pré-Processo     | 6 + 7 + 10               | **Parcialmente construído e visível.** O backend mock e a interface de envio, progresso e procedência existem; correção humana, download, reprocessamento pela interface e verificação E2E ainda faltam                                                                                                     |

## Mapeamento das fases

| Fase                                      | Componentes | Entregas                       | Cobertura                                                                                |
| ----------------------------------------- | ----------- | ------------------------------ | ---------------------------------------------------------------------------------------- |
| Fase 1 — Ingestão, Organizador, OCR       | 1, 3, 4     | 6 (parcial), nenhuma, 7 (mock) | **A mais fraca.** Um componente parcial, um sem entrega, um mockado                      |
| Fase 2 — Timeline, Checklist, Workspace   | 6, 7, 8     | 8, 8, 10                       | Timeline e checklist mock concluídos; Workspace iniciado parcialmente                    |
| Fase 3 — Memory Engine, Assistente        | 9, 10       | 9, posterior à 9               | Memory Engine autorizado; política do assistente decidida, superfície ainda não agendada |
| Fase 4 — Integrações com ERPs e tribunais | —           | fora do escopo do MVP          | Excluída de propósito pelo `mvp-scope.md`                                                |

**A escolha registrada:** a sociedade autorizou seguir a cadeia de dependências do plano, e a Entrega 8 foi concluída mesmo pertencendo à **Fase 2** da proposta. Isso não resolve as lacunas da Fase 1; apenas evita bloquear capacidades independentes que já tinham fundação segura.

As telas preparatórias não alteram o checkpoint formal: a Entrega 8 é a última aceita. A Entrega 9 foi autorizada para o incremento atual e só se torna checkpoint após todos os critérios de aceite serem verificados. A Entrega 10 continua separada.

## Reversões de stack deliberadas

A proposta sugere um stack que o registro de arquitetura rejeitou intencionalmente. Cada reversão está documentada e cada uma remove um componente operacional. Ficam registradas aqui para que a leitura dos dois documentos lado a lado não pareça desvio de rota.

| Proposta                                        | Construído                                              | Registro |
| ----------------------------------------------- | ------------------------------------------------------- | -------- |
| Microserviços e arquitetura orientada a eventos | Monólito modular, API e worker como processos separados | ADR-001  |
| RabbitMQ ou Kafka                               | BullMQ sobre Redis                                      | ADR-007  |
| OpenSearch ou Elasticsearch                     | Busca full-text do PostgreSQL mais pgvector             | ADR-005  |
| pgvector evoluindo para Qdrant ou Weaviate      | pgvector, sem migração comprometida                     | ADR-005  |

A proposta conceitual não foi atualizada para refletir isso. Ou ela é atualizada, ou esta tabela é anexada a ela. Quem comparar os dois documentos hoje vai concluir que a equipe saiu da especificação, quando aconteceu o contrário.

## Decisões tomadas e obrigações de implementação

| Decisão | Resultado aceito                                                   | Consequência que ainda precisa de entrega própria                                                  |
| ------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| ADR-009 | Assistente ancorado; sem fonte autorizada, recusa                  | Construir a superfície de resposta somente depois da recuperação da Entrega 9                      |
| ADR-010 | Upload e e-mail no MVP; WhatsApp posterior                         | Agendar ingestão por e-mail com remetente verificado e proveniência da mensagem                    |
| ADR-011 | Assinatura com franquia, excedente medido e teto rígido por caso   | Registrar custo por execução e aplicar o teto antes do primeiro provedor real                      |
| ADR-012 | Preservação padrão, nenhum expurgo automático e legal hold fechado | Implementar hold e procedimentos de governança antes de dados reais, contratos ou provedores reais |
| ADR-013 | E-mail mínimo: código do caso, acontecimento e link                | Agendar jobs de notificação, preferências e auditoria sem corpo de mensagem                        |

Essas obrigações compõem backlog governado, não autorização implícita. A ordem exata após as Entregas 9–11 deve preservar as travas dos ADRs: governança e controle de custo antecedem qualquer provedor real; recuperação antecede o assistente; e-mail de entrada e de saída permanecem incrementos distintos.

## Lacunas sem dono

Registradas aqui para deixarem de ser invisíveis. Nenhuma delas é trabalho autorizado; todas precisam de especificação de entrega antes de qualquer código.

1. **Organizador Inteligente (componente #3).** Estrutura de pastas, detecção de versões, renomeação inteligente. Citado na Fase 1 da proposta, ausente das 12 entregas.
2. **Estágio de transcrição.** `TranscriptionProvider` é citado no `AGENTS.md` e no ADR-006, e resumo de áudio e vídeo é um diferencial de destaque na proposta, mas nenhum estágio do pipeline o consome.
3. **Incrementos das decisões aceitas.** Ingestão por e-mail, controles de custo, legal hold, notificações e a superfície do assistente têm política definida, mas ainda precisam de slots de implementação próprios.

## Manutenção

Atualizar as tabelas de componentes e fases sempre que uma entrega for aceita. Uma nova decisão deve ser registrada no ADR correspondente e refletida neste mapa sem reabrir decisões já aceitas.
