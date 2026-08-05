# Alinhamento de roadmap: proposta conceitual x plano de implementação

**Status:** Registro de reconciliação
**Última atualização:** 2026-08-05
**Idioma:** este documento e os ADR-009 a ADR-012 são escritos em pt-BR porque o público é a sociedade da SAMUEL DEV LTDA, não a equipe de engenharia. A documentação técnica do repositório permanece em inglês, conforme `AGENTS.md`.

## Objetivo

Dois documentos descrevem o LEX OS e eles não usam a mesma unidade de medida.

- A **proposta conceitual** preparada para os sócios descreve 11 componentes de arquitetura e um roadmap de MVP em 4 fases.
- O **plano de implementação** (`../architecture/implementation-plan.md`) descreve 12 entregas incrementais com critérios de aceite.

Nada liga um ao outro. Por isso a pergunta "onde estamos na Fase 1?" hoje não tem resposta. Este documento é essa ligação. Ele também registra onde os dois documentos realmente discordam, para que essas divergências sejam decididas de propósito e não resolvidas por quem escrever código primeiro.

É um registro de reconciliação, não um plano novo. Não altera escopo. Onde há decisão pendente, aponta o ADR que a governa.

## Por que o progresso parece invisível

A proposta conceitual enumera capacidades de produto. Ela não tem nenhuma linha para isolamento entre clientes, autenticação, RBAC, auditoria, entrada segura de arquivos ou pipeline de processamento — a plataforma sobre a qual essas capacidades se apoiam.

Cinco das sete entregas concluídas foram exatamente nisso:

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

Essa é a ordem correta de construção — nenhum dos 11 componentes pode entrar em produção com segurança sem ela. Mas significa que a maior parte do trabalho feito até aqui não aparece quando se lê a proposta. Essa lacuna é de percepção e de documentação, não de entrega.

## Mapeamento dos componentes

| #   | Componente              | Entrega responsável | Situação                                                                                                                                                                                                                                                    |
| --- | ----------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Central de Ingestão     | 6 (parcial)         | **Parcial.** Apenas upload HTTP multipart. E-mail, scanner, pastas monitoradas e APIs não existem. WhatsApp está explicitamente fora do escopo do MVP — ver ADR-010                                                                                         |
| 2   | Pipeline Inteligente    | 7                   | **Estrutura completa, inteligência simulada.** Contratos de fila, ciclo de vida do job, retry, reconciliação e proveniência têm forma de produção. Todos os provedores são mocks determinísticos. Não existe estágio de transcrição                         |
| 3   | Organizador Inteligente | **nenhuma**         | **Sem entrega.** Existe apenas vínculo de duplicata por SHA-256 dentro do mesmo cliente. Estrutura de pastas, versionamento e renomeação inteligente não têm entrega no plano                                                                               |
| 4   | OCR Jurídico            | 7 (mock)            | **Mock.** A extração de texto devolve fixtures determinísticos. Extração de CPF, CNPJ, OAB, datas, valores e número de processo _a partir do conteúdo do documento_ não existe. A validação de CPF/CNPJ que existe é de cadastro de pessoa, não de extração |
| 5   | Extração Semântica      | 7 (mock)            | **Mock.** `ExtractedEntity` carrega página, offsets, confiança e `linkedPersonId`; os valores são fabricados                                                                                                                                                |
| 6   | Timeline Engine         | 8                   | Não iniciada. Exige autorização explícita. `TimelineEvent` já existe no schema                                                                                                                                                                              |
| 7   | Checklist Inteligente   | 8                   | Não iniciada. `ChecklistTemplate`, `CaseChecklist` e `CaseChecklistItem` já existem no schema                                                                                                                                                               |
| 8   | Workspace               | 10                  | Não iniciada. A aplicação web é uma única página estática                                                                                                                                                                                                   |
| 9   | Memory Engine           | 9                   | Não iniciada. `KnowledgeChunk` e a extensão pgvector já estão no lugar                                                                                                                                                                                      |
| 10  | Assistente Interno      | **nenhuma**         | **Contradição.** A proposta lista como componente central e Fase 3. O `vision.md` lista "chatbot jurídico genérico" entre as coisas que o LEX OS **não é**. Ver ADR-009                                                                                     |
| 11  | Agente Pré-Processo     | 6 + 7 + 10          | **Planejado e parcialmente construído.** É o fluxo "Preparar processo" do `vision.md`. A metade de backend existe em forma mock; a metade visível ao usuário é a Delivery 10                                                                                |

## Mapeamento das fases

| Fase                                      | Componentes | Entregas                       | Cobertura                                                           |
| ----------------------------------------- | ----------- | ------------------------------ | ------------------------------------------------------------------- |
| Fase 1 — Ingestão, Organizador, OCR       | 1, 3, 4     | 6 (parcial), nenhuma, 7 (mock) | **A mais fraca.** Um componente parcial, um sem entrega, um mockado |
| Fase 2 — Timeline, Checklist, Workspace   | 6, 7, 8     | 8, 8, 10                       | Totalmente especificada, não iniciada                               |
| Fase 3 — Memory Engine, Assistente        | 9, 10       | 9, nenhuma                     | Metade especificada; o assistente está em disputa                   |
| Fase 4 — Integrações com ERPs e tribunais | —           | fora do escopo do MVP          | Excluída de propósito pelo `mvp-scope.md`                           |

**A consequência que precisa ser dita:** a Delivery 8 é o próximo passo do plano de implementação, mas Timeline e Checklist pertencem à **Fase 2** da proposta. Se o roadmap da proposta é a sequência que manda, a Delivery 8 não é a próxima coisa a construir. Se a cadeia de dependências do plano é que manda, é. Essa escolha ainda não foi feita.

## Reversões de stack deliberadas

A proposta sugere um stack que o registro de arquitetura rejeitou intencionalmente. Cada reversão está documentada e cada uma remove um componente operacional. Ficam registradas aqui para que a leitura dos dois documentos lado a lado não pareça desvio de rota.

| Proposta                                        | Construído                                              | Registro |
| ----------------------------------------------- | ------------------------------------------------------- | -------- |
| Microserviços e arquitetura orientada a eventos | Monólito modular, API e worker como processos separados | ADR-001  |
| RabbitMQ ou Kafka                               | BullMQ sobre Redis                                      | ADR-007  |
| OpenSearch ou Elasticsearch                     | Busca full-text do PostgreSQL mais pgvector             | ADR-005  |
| pgvector evoluindo para Qdrant ou Weaviate      | pgvector, sem migração comprometida                     | ADR-005  |

A proposta conceitual não foi atualizada para refletir isso. Ou ela é atualizada, ou esta tabela é anexada a ela. Quem comparar os dois documentos hoje vai concluir que a equipe saiu da especificação, quando aconteceu o contrário.

## Decisões necessárias antes do trabalho afetado

| Pergunta                                                | ADR     | Trava                                                           |
| ------------------------------------------------------- | ------- | --------------------------------------------------------------- |
| O Assistente Interno faz parte do produto ou não?       | ADR-009 | Componente #10, escopo da Fase 3                                |
| WhatsApp é a porta de entrada ou um conector posterior? | ADR-010 | Componente #1, e se a Fase 1 é viável como está escrita         |
| Quanto custa processar um caso, e com quais provedores? | ADR-011 | Componentes #4 e #5 saírem do estado de mock; formação de preço |
| Retenção, legal hold e postura de LGPD                  | ADR-012 | Entrada de dado real em produção; contratos comerciais          |

## Lacunas sem dono

Registradas aqui para deixarem de ser invisíveis. Nenhuma das duas é trabalho autorizado; ambas precisam de especificação de entrega antes de qualquer código.

1. **Organizador Inteligente (componente #3).** Estrutura de pastas, detecção de versões, renomeação inteligente. Citado na Fase 1 da proposta, ausente das 12 entregas.
2. **Estágio de transcrição.** `TranscriptionProvider` é citado no `AGENTS.md` e no ADR-006, e resumo de áudio e vídeo é um diferencial de destaque na proposta, mas nenhum estágio do pipeline o consome.

## Manutenção

Atualizar as tabelas de componentes e fases sempre que uma entrega for aceita. Quando um dos ADR-009 a ADR-012 for decidido, substituir a linha correspondente em "Decisões necessárias" pelo resultado e ajustar a situação do componente afetado.
