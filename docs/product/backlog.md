# Quadro de trabalho

**Status:** Fonte da verdade do que está em andamento
**Última atualização:** 2026-08-06 · envio de arquivos entregue

Este arquivo é o quadro. Ele vive no repositório de propósito: fica versionado, aparece no
diff para quem revisa, e um agente consegue lê-lo sem depender de ferramenta externa.

Regras do quadro:

- **Fazendo** tem no máximo dois cartões. Mais que isso não é trabalho em andamento, é
  trabalho parado em paralelo.
- Um cartão só sai de **Bloqueado** quando o bloqueio for removido de fato, não quando
  alguém tiver uma ideia de contorno.
- Cartão de front só entra em **A fazer** se a rota da API já existir. Caso contrário ele
  pertence a **Bloqueado por backend**.

---

## Fazendo

| Cartão | Detalhe                                            |
| ------ | -------------------------------------------------- |
| —      | Nada em andamento. Próximo: revisão de procedência |

---

## A fazer — front, com API pronta

Em ordem de valor. Os três primeiros formam o fluxo "Preparar processo", que é a
experiência central da `vision.md` e o componente 11 da proposta.

| #   | Cartão                       | Rotas que já existem                                                  |
| --- | ---------------------------- | --------------------------------------------------------------------- |
| 1   | Revisão de procedência       | `GET /documents/:id/extractions`                                      |
| 2   | Lista e detalhe de documento | `GET /cases/:caseId/documents` · `GET /documents/:id`                 |
| 3   | Correção humana de documento | `PATCH /documents/:id`                                                |
| 4   | Download autorizado          | `GET /files/:id/download-url` — URL assinada de 60 s                  |
| 5   | Reprocessar documento        | `POST /documents/:id/reprocess`                                       |
| 6   | Criar e editar caso          | `POST /cases` · `PATCH /cases/:id`                                    |
| 7   | Participantes do caso        | `GET`/`POST /cases/:caseId/participants`                              |
| 8   | Pessoas — CRUD               | `GET`/`POST`/`PATCH`/`DELETE /persons` — CPF e CNPJ chegam mascarados |
| 9   | Excluir caso e documento     | `DELETE /cases/:id` · `DELETE /documents/:id`                         |

## A fazer — qualidade de interface

| Cartão                               | Detalhe                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------ |
| Alternador de tema persistente       | Escuro é o padrão; a escolha do usuário precisa sobreviver ao recarregar |
| Passagem de teclado no fluxo crítico | Critério de aceite da Delivery 10, não item opcional                     |
| Sincronizar a referência visual      | A página do sistema visual ficou na escala e no raio antigos             |

---

## Bloqueado por backend

Nada aqui pode virar front antes de a rota existir. Registrado para deixar de ser
invisível.

| Cartão                       | O que falta                                                                                                                                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Responsável do caso com nome | Não existe rota de usuários. `responsibleUserId` só pode virar UUID na tela. Precisa de `GET /users` ou de `responsible: { id, name }` embutido no caso, como já é feito com `file` e `documentType` |
| Painel com números           | Nenhum endpoint devolve contagem ou agregado. Um resumo exigiria varrer páginas no cliente, o que não escala                                                                                         |
| Cronologia                   | Delivery 8, não autorizada. `TimelineEvent` já existe no schema                                                                                                                                      |
| Checklist                    | Delivery 8, não autorizada. Tabelas já existem                                                                                                                                                       |
| Busca e memória              | Delivery 9. `KnowledgeChunk` e pgvector já estão no lugar                                                                                                                                            |
| Tarefas                      | Sem rota                                                                                                                                                                                             |
| Leitura de auditoria         | Sem rota                                                                                                                                                                                             |
| Administração de usuários    | Sem rota                                                                                                                                                                                             |

---

## Bloqueado por decisão da sociedade

Nenhum é código. Cada um trava trabalho abaixo dele.

| Cartão                                   | Registro | Trava                                     |
| ---------------------------------------- | -------- | ----------------------------------------- |
| Escopo do Assistente Interno             | ADR-009  | Delivery 9 e o componente 10 da proposta  |
| Canais de ingestão e posição do WhatsApp | ADR-010  | Componente 1 e a viabilidade da Fase 1    |
| Custo de processamento e provedores      | ADR-011  | Sair do estado de mock; formação de preço |
| Retenção, legal hold e LGPD              | ADR-012  | Dado real em produção; contrato comercial |
| Aprovar a fundação de design             | —        | Nada: já é possível construir em cima     |
| Família tipográfica definitiva           | —        | Exige licença e teste em documento denso  |

---

## Verificação pendente

Itens que não são funcionalidade, mas que a equipe não deve esquecer.

| Cartão                            | Situação                                                                                                          |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Testes de integração              | Nunca executados fora do CI. A máquina de desenvolvimento usada até aqui não tem Docker                           |
| `pnpm infra:up`                   | Pode ter o mesmo defeito de `--wait` com o `minio-init` que foi corrigido em `infra:dependencies`. Não verificado |
| Gate de lint e formato pré-commit | Os hooks cobrem só mensagem de commit                                                                             |
| Playwright ponta a ponta          | Delivery 11                                                                                                       |

---

## Feito

Ordem cronológica inversa. Serve para o quadro não perder a memória do que já foi resolvido.

- **Progresso de preparação** — o advogado acompanha documentos, não jobs: uma frase de
  resumo com contagem ("Preparando 3 documentos…"), a garantia explícita de que pode fechar
  a página, e o chip de cada documento com a etapa em verbo do dia a dia ("Extraindo
  texto…"). Polling com recuo que para sozinho, pausa com a aba escondida e acorda no
  envio; as linhas nunca mudam de posição durante a atualização.
- **Detalhe do caso e envio de arquivos** — a moldura do caso com documentos e partes em
  painéis independentes, e o envio multipart com pré-verificação local, fila editável e o
  resultado parcial (aceitos, recusados, quarentena) como estado de primeira classe.
- **Interface** — fundação de design com tokens medidos nos dois temas, escala e raio
  ajustados, autenticação e lista de casos em Vue, protótipo clicável do fluxo de preparação.
- **Correções que o CI expôs** — `prisma generate` no `postinstall`, que fazia o fluxo
  documentado de banco falhar em clone limpo; `infra:dependencies` reprovando depois da
  stack subir com sucesso; scripts do worker que nunca rodaram no Windows.
- **Plataforma de qualidade** — CI com três jobs, normalização de fim de linha, harness de
  decisões com dois guardas contra atribuição de IA em commits.
- **Código** — validação de UUID e parser de cursor centralizados, teste do grafo de módulos,
  métrica de enfileiramento adiado.
- **Produto** — reconciliação entre a proposta conceitual e o plano de entregas, e os quatro
  registros de decisão que ela revelou.

---

## Manutenção

Mover o cartão na hora em que o estado muda, não no fim do dia. Ao concluir, escrever em
**Feito** o que mudou para quem não acompanhou — não o nome do cartão.
