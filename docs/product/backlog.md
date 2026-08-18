# Quadro de trabalho

**Status:** Fonte da verdade do que está em andamento
**Última atualização:** 2026-08-18 · Entrega 11 autorizada e em andamento

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

| Cartão                                                | Detalhe                                                                                                                                                   |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entrega 11 — Verificação do MVP e endurecimento do CI | Autorizada pela sociedade em 2026-08-18. Matriz completa de testes, gates no CI com Playwright, fluxo E2E integral, abuso, dependências, backup e runbook |

---

## Próximos incrementos — ainda não autorizados

São capacidades úteis, mas não pertencem ao aceite da Delivery 10. Só entram em **Fazendo**
depois de receberem escopo e autorização explícitos.

| Cartão                         | Fundação disponível                                               |
| ------------------------------ | ----------------------------------------------------------------- |
| Assistente — conversa completa | A resposta ancorada simples existe; histórico de conversa não     |
| Referência visual viva         | Tokens e dois temas existem; falta definir o artefato de catálogo |

---

## Bloqueado por backend

Nada aqui pode virar front antes de a rota existir. Registrado para deixar de ser
invisível.

| Cartão                    | O que falta                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| Administração de usuários | Existe somente a lista mínima de usuários atribuíveis; CRUD, convites e papéis não têm rota |

---

## Decidido pela sociedade — 2026-08-07

Os cinco registros abertos foram fechados. As decisões liberam planejamento e
implementação futura; não autorizam, por si só, o início de uma nova entrega.

| Registro | Decisão                                               | Condição inegociável                                                      |
| -------- | ----------------------------------------------------- | ------------------------------------------------------------------------- |
| ADR-009  | Resposta ancorada em fonte autorizada                 | Sem fonte autorizada, o sistema recusa responder                          |
| ADR-010  | Upload e e-mail no MVP; WhatsApp como conector futuro | Remetente não verificado nunca escreve em um tenant                       |
| ADR-011  | Assinatura com franquia e medição de excedente        | Custo por execução e teto rígido por caso antes do primeiro provedor real |
| ADR-012  | Preservar por padrão; sem expurgo automático          | Legal hold falha fechado e nenhum fornecedor treina com o conteúdo        |
| ADR-013  | Notificações internas com conteúdo mínimo             | Somente código do caso, tipo do acontecimento e link                      |

---

## Bloqueado por decisão da sociedade

Nenhum é código. Cada um trava trabalho abaixo dele.

| Cartão                         | Registro | Trava                                    |
| ------------------------------ | -------- | ---------------------------------------- |
| Aprovar a fundação de design   | —        | Nada: já é possível construir em cima    |
| Família tipográfica definitiva | —        | Exige licença e teste em documento denso |

---

## Verificação pendente

Itens que não são funcionalidade, mas que a equipe não deve esquecer.

| Cartão                            | Situação                                                                                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Gate de lint e formato pré-commit | Instalado em 2026-08-18 dentro da Entrega 11; falha fechado sem pnpm                                                                       |
| Matriz E2E ampliada               | Em andamento na Entrega 11: abuso e jornada total entram no cartão                                                                         |
| Checklist em caso sem template    | Corrigido em 2026-08-18: a etapa conclui sem exigências, o EMBEDDING roda e o documento segue pesquisável; coberto por teste de integração |

---

## Feito

Ordem cronológica inversa. Serve para o quadro não perder a memória do que já foi resolvido.

- **Pessoas — experiência CRUD** (autorizado pela sociedade em 2026-08-17) — lista com filtro por
  tipo e paginação por cursor, ficha com participações em casos (papel, polo e vínculo de cliente),
  cadastro e edição, e exclusão lógica com confirmação. CPF, CNPJ e RG chegam mascarados da API e
  nunca voltam no envio: na edição a máscara vira dica de campo e só documento digitado viaja no
  PATCH — comportamento coberto por teste de componente. Entrada "Pessoas" na navegação para quem
  tem `persons.read`; ações de escrita aparecem somente com `persons.manage`, e o servidor segue
  revalidando tudo.
- **Delivery 10 aceita no navegador real** — Playwright cobre o fluxo autenticado essencial em
  desktop e celular, sem criar dados jurídicos; verifica navegação por teclado, foco visível,
  ausência de estouro horizontal e falhas inesperadas de console ou HTTP.
- **Workspace essencial conectado à API** — painel, criação/edição/exclusão de caso, participantes,
  correção/download/reprocessamento/exclusão de documento, confirmação de entidade, tarefas e busca
  com resposta ancorada são ações reais. O tema escuro é padrão e a preferência clara/escura persiste
  sem armazenar sessão.
- **Permissões efetivas na interface** — login e refresh recebem o conjunto deduplicado de permissões
  calculado pelas mesmas atribuições visíveis do guard. Rotas, navegação e ações ocultam o que não está
  disponível, mas a API continua revalidando autorização no banco em toda requisição.
- **Resumo operacional sem varrer páginas** — o painel recebe contagens de casos, documentos,
  tarefas e processamentos em uma única consulta. Tenant, exclusão lógica e confidencialidade são
  aplicados antes dos agregados; quem não pode ver sigilo não recebe nem mesmo o sinal numérico.
- **Leitura supervisionada da auditoria** — a rota pagina somente metadados do tenant e exige
  `audit.read` junto de `confidential_cases.read`, porque a atividade pode identificar um caso
  confidencial. Snapshots `old_data/new_data` nunca saem pela rota; a própria leitura é auditada sem
  copiar o payload consultado.
- **Controles de custo antes do primeiro provedor real** — cada caso nasce com teto zero em BRL;
  o worker reserva o custo máximo antes de chamar um provedor, liquida gasto e reserva no mesmo
  fluxo transacional e interrompe o processamento ao alcançar o limite. Jobs expõem provedor,
  modelo, versão e valores exatos; filtros e auditoria permitem medir sem registrar conteúdo.
- **Resposta ancorada do ADR-009** — `POST /assistant/answers` recupera apenas fontes autorizadas,
  recusa sem evidência antes de chamar o modelo e rejeita qualquer afirmação cuja citação não
  resolva para os trechos retornados. O adaptador ainda é mock, marcado como máquina, com aviso de
  revisão humana e auditoria sem pergunta, resposta ou conteúdo jurídico.
- **Lacunas de ação da interface fechadas** — pessoa agora lista seus casos acessíveis sem vazar
  confidenciais; tarefa pode concluir, reabrir, mudar prioridade, prazo e responsável com proteção
  contra corrida; a seleção de responsável usa apenas usuários ativos do tenant; e uma entidade
  extraída pode receber confirmação humana única sem alterar sua extração de origem.
- **Responsável legível no caso** — a listagem e o detalhe preservam o identificador para filtros
  e edição, mas agora trazem também somente `id` e `name` do usuário na mesma consulta tenant-scoped.
  O detalhe mostra o nome ou “Sem responsável”, sem N+1 e sem expor e-mail, status ou papéis.
- **Cronologia com confirmação humana** — a primeira ação de escrita de revisão do
  produto: eventos na ordem dos fatos, data respeitando a precisão registrada (mês vira
  03/2019, nunca um dia inventado — e formatada em UTC para não derivar pelo fuso), nota
  de procedência no título enquanto não confirmado, e o botão Confirmar que troca o
  evento pela resposta do servidor. O 409 de corrida recarrega e mostra o estado real em
  vez de erro. ADR-013 (notificações) escrito e issues #2 e #3 abertas para o backend.
- **Qualidade do fluxo autenticado** — o login retoma apenas destinos internos seguros; falhas
  de documentos e partes são recuperáveis sem transformar erro em lista vazia; os dois painéis
  usam paginação por cursor independente; e o seletor de arquivos tem um único ponto na ordem
  de foco. Testes de componente cobrem retorno seguro, isolamento das falhas e acréscimo de páginas.
- **Revisão local do stack e da interface** — testes unitários e de integração executados
  com Docker; `infra:up` verificado no Compose v5.3.1; build das imagens corrigido para o
  `postinstall` do Prisma e para a URL da API no bundle web; fluxo login → casos → detalhe
  exercitado em desktop e celular; verificação WCAG automatizada incorporada à revisão.
- **Tarefas do caso** — fecha o ciclo checklist → tarefa rastreável. A tela abre com o
  atraso, contando só o que está em aberto, e o prazo é dito em linguagem de quem tem prazo:
  "Vence hoje", "Atrasada 3 dias". A criação sai da exigência pendente no checklist, com
  prioridade e prazo no formulário — porque sem rota de alteração, a criação é a única
  chance de acertá-los. A tela declara que concluir tarefa ainda não existe em vez de
  oferecer um botão morto: issue #5.
- **Checklist documental** — a tela responde antes de tudo a pergunta que o advogado faz: o
  veredito no topo conta só a exigência **obrigatória** em falta, porque é ela que trava o
  protocolo; pendência não obrigatória entra na lista sem alarmar. O item que bloqueia recebe
  faixa lateral, não só cor. Validar e marcar como não aplicável trocam o item pelo retorno do
  servidor, que é a autoridade sobre validador e horário. O vazio explica que o checklist é
  instantâneo versionado do modelo.
- **Revisão de procedência** — a tela onde a promessa central vira produto: cada dado
  identificado carrega uma nota de rodapé com arquivo, página, trecho, modelo e confiança,
  revelada no cursor e no foco de teclado; quando a IA normalizou um valor, a nota preserva
  o que estava escrito no documento; o texto extraído aparece em serifa com medida de
  leitura; e a trilha append-only lista cada execução com provedor, modelo e hora. Sem
  botão de confirmar de mentira: a rota não existe, e o bloqueio está registrado.
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
