# Alinhamento de roadmap: proposta conceitual x plano de implementação

**Status:** Registro de reconciliação atualizado após o encerramento do MVP
**Última atualização:** 2026-08-28
**Idioma:** este documento e os ADR-009 a ADR-013 são escritos em pt-BR porque o público é a sociedade da SAMUEL DEV LTDA, não a equipe de engenharia. A documentação técnica do repositório permanece em inglês, conforme `AGENTS.md`.

## Objetivo

Dois documentos descrevem o LEX OS e eles não usam a mesma unidade de medida.

- A **proposta conceitual** preparada para os sócios descreve 11 componentes de arquitetura e um roadmap de MVP em 4 fases.
- O **plano de implementação** (`../architecture/implementation-plan.md`) descreve as entregas incrementais aceitas até a Entrega 16.

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

| #   | Componente              | Entrega responsável | Situação                                                                                                                                                                                                                                                          |
| --- | ----------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Central de Ingestão     | 6                   | **Concluída no MVP.** Upload HTTP multipart autenticado é o único canal. O ADR-016 levou e-mail e WhatsApp para conectores futuros; pastas monitoradas são iniciativa separada                                                                                    |
| 2   | Pipeline Inteligente    | 7                   | **Estrutura completa, inteligência simulada.** Contratos de fila, ciclo de vida do job, retry, reconciliação e proveniência têm forma de produção. Todos os provedores são mocks determinísticos. Não existe estágio de transcrição                               |
| 3   | Organizador Inteligente | **nenhuma**         | **Sem entrega.** Existe apenas vínculo de duplicata por SHA-256 dentro do mesmo cliente. Estrutura de pastas, versionamento e renomeação inteligente não têm entrega no plano                                                                                     |
| 4   | OCR Jurídico            | 7 (mock)            | **Mock.** A extração de texto devolve fixtures determinísticos. Extração de CPF, CNPJ, OAB, datas, valores e número de processo _a partir do conteúdo do documento_ não existe. A validação de CPF/CNPJ que existe é de cadastro de pessoa, não de extração       |
| 5   | Extração Semântica      | 7 (mock)            | **Mock.** `ExtractedEntity` carrega página, offsets, confiança e `linkedPersonId`; os valores são fabricados                                                                                                                                                      |
| 6   | Timeline Engine         | 8                   | **Concluída com inteligência simulada.** Eventos carregam documento, localizador, extração, confiança e começam não confirmados; a confirmação humana preserva a extração original                                                                                |
| 7   | Checklist Inteligente   | 8                   | **Concluída com inteligência simulada.** Template versionado, snapshot por caso, revisão de itens, vínculo documental no mesmo caso e tarefa rastreável estão implementados                                                                                       |
| 8   | Workspace               | 10                  | **Concluída no escopo essencial.** Login, painel, casos, participantes, envio, progresso, documentos, revisão humana, timeline, checklist, tarefas, busca e auditoria usam a API real. Navegação respeita permissões e o fluxo crítico passa em desktop e celular |
| 9   | Memory Engine           | 9                   | **Concluída com embeddings simulados.** Indexação determinística, busca full-text em português, vetor exato, ranking híbrido, filtros no banco, citações e recusa sem evidência estão implementados                                                               |
| 10  | Assistente Interno      | 9 + 10              | **Backend mock ancorado concluído.** Recupera somente fontes autorizadas, recusa sem evidência e valida as citações. Uma experiência conversacional completa e provedores reais continuam fora do escopo                                                          |
| 11  | Agente Pré-Processo     | 6 + 7 + 10          | **Concluído com inteligência simulada.** A interface cobre envio, progresso, procedência, correção humana, download, reprocessamento e revisão; o fluxo essencial foi verificado em desktop e celular                                                             |

## Mapeamento das fases

| Fase                                      | Componentes | Entregas                       | Cobertura                                                                     |
| ----------------------------------------- | ----------- | ------------------------------ | ----------------------------------------------------------------------------- |
| Fase 1 — Ingestão, Organizador, OCR       | 1, 3, 4     | 6 (parcial), nenhuma, 7 (mock) | **A mais fraca.** Um componente parcial, um sem entrega, um mockado           |
| Fase 2 — Timeline, Checklist, Workspace   | 6, 7, 8     | 8, 8, 10                       | Timeline, checklist e Workspace essencial concluídos com provedores simulados |
| Fase 3 — Memory Engine, Assistente        | 9, 10       | 9, 10                          | Memory Engine e contrato backend ancorado concluídos com provedores simulados |
| Fase 4 — Integrações com ERPs e tribunais | —           | fora do escopo do MVP          | Excluída de propósito pelo `mvp-scope.md`                                     |

**A escolha registrada:** a sociedade autorizou seguir a cadeia de dependências do plano, e a Entrega 8 foi concluída mesmo pertencendo à **Fase 2** da proposta. Isso não resolve as lacunas da Fase 1; apenas evita bloquear capacidades independentes que já tinham fundação segura.

O checkpoint formal é a Entrega 16. O ADR-016 encerrou o MVP e nenhum incremento posterior está autorizado.

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

| Decisão | Resultado aceito                                                     | Consequência que ainda precisa de entrega própria                                                  |
| ------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| ADR-009 | Assistente ancorado; sem fonte autorizada, recusa                    | Construir a superfície de resposta somente depois da recuperação da Entrega 9                      |
| ADR-010 | Superado pelo ADR-016 quanto ao e-mail no MVP                        | Preservar a trava: remetente não verificado nunca escreve em tenant algum                          |
| ADR-011 | Assinatura com franquia, excedente medido e teto rígido por caso     | Registrar custo por execução e aplicar o teto antes do primeiro provedor real                      |
| ADR-012 | Preservação padrão, nenhum expurgo automático e legal hold fechado   | Implementar hold e procedimentos de governança antes de dados reais, contratos ou provedores reais |
| ADR-013 | E-mail mínimo: código do caso, acontecimento e link                  | Implementado; relay de produção continua sendo condição operacional externa                        |
| ADR-016 | Upload como única entrada do MVP e portões externos falhando fechado | Novo conector ou acervo real exige incremento e evidência próprios                                 |

Essas obrigações compõem backlog governado, não autorização implícita. A ordem exata após as Entregas 9–11 deve preservar as travas dos ADRs: governança e controle de custo antecedem qualquer provedor real; recuperação antecede o assistente; e-mail de entrada e de saída permanecem incrementos distintos.

## Lacunas sem dono

Registradas aqui para deixarem de ser invisíveis. Nenhuma delas é trabalho autorizado; todas precisam de especificação de entrega antes de qualquer código.

1. **Organizador Inteligente (componente #3).** Estrutura de pastas, detecção de versões, renomeação inteligente. Citado na Fase 1 da proposta, ausente das 12 entregas.
2. **Estágio de transcrição.** `TranscriptionProvider` é citado no `AGENTS.md` e no ADR-006, e resumo de áudio e vídeo é um diferencial de destaque na proposta, mas nenhum estágio do pipeline o consome.
3. **Incrementos pós-MVP.** Conectores de e-mail/WhatsApp, provedores de OCR/embedding de produção e qualquer uso de acervo real precisam de autorização e evidência próprias.

## Manutenção

Atualizar as tabelas de componentes e fases sempre que uma entrega for aceita. Uma nova decisão deve ser registrada no ADR correspondente e refletida neste mapa sem reabrir decisões já aceitas.
