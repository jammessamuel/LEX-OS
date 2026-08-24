# Quadro de trabalho

**Status:** Fonte da verdade do que está em andamento
**Última atualização:** 2026-08-24 · Entrega 14 completa

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

| Cartão                              | Detalhe                                                                                                                           |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Entrega 14 — Segundo fator com TOTP | Autorizada pela sociedade em 2026-08-20. Escopo completo: primitiva, banco, inscrição, entrada e telas. Aceita quando a CI fechar |

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

| Cartão | O que falta                                                                                          |
| ------ | ---------------------------------------------------------------------------------------------------- |
| —      | Nada bloqueado. A administração de usuários saiu daqui: virou a Entrega 12, autorizada em 2026-08-20 |

---

## Decidido pela sociedade — 2026-08-07 e 2026-08-20

Os cinco registros abertos foram fechados. As decisões liberam planejamento e
implementação futura; não autorizam, por si só, o início de uma nova entrega.

| Registro | Decisão                                                   | Condição inegociável                                                      |
| -------- | --------------------------------------------------------- | ------------------------------------------------------------------------- |
| ADR-009  | Resposta ancorada em fonte autorizada                     | Sem fonte autorizada, o sistema recusa responder                          |
| ADR-010  | Upload e e-mail no MVP; WhatsApp como conector futuro     | Remetente não verificado nunca escreve em um tenant                       |
| ADR-011  | Assinatura com franquia e medição de excedente            | Custo por execução e teto rígido por caso antes do primeiro provedor real |
| ADR-012  | Preservar por padrão; sem expurgo automático              | Legal hold falha fechado e nenhum fornecedor treina com o conteúdo        |
| ADR-013  | Notificações internas com conteúdo mínimo                 | Somente código do caso, tipo do acontecimento e link                      |
| ADR-014  | Fronteira de identidade: as oito resolvidas em 2026-08-20 | Adapter de e-mail primeiro; TOTP próprio; papel nunca vem de grupo do IdP |

---

## Bloqueado por decisão da sociedade

Nenhum é código. Cada um trava trabalho abaixo dele.

| Cartão                           | Registro | Trava                                                                        |
| -------------------------------- | -------- | ---------------------------------------------------------------------------- |
| Fronteira de identidade e acesso | ADR-014  | Oito pendências registradas. As duas primeiras dependem do adapter de e-mail |
| Aprovar a fundação de design     | —        | Nada: já é possível construir em cima                                        |
| Família tipográfica definitiva   | —        | Exige licença e teste em documento denso                                     |

---

## Verificação pendente

Itens que não são funcionalidade, mas que a equipe não deve esquecer.

| Cartão                            | Situação                                                                                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Gate de lint e formato pré-commit | Instalado em 2026-08-18 dentro da Entrega 11; falha fechado sem pnpm                                                                       |
| Matriz E2E ampliada               | Jornada total no Playwright e abuso HTTP da matriz cobertos; CI do `08dd44d` verde                                                         |
| Limitações de produção            | Registradas no README e no runbook em 2026-08-18: mocks, ADR-010/012/013, admin de usuários e hold jurídico bloqueiam dado real            |
| Checklist em caso sem template    | Corrigido em 2026-08-18: a etapa conclui sem exigências, o EMBEDDING roda e o documento segue pesquisável; coberto por teste de integração |

---

## Feito

Ordem cronológica inversa. Serve para o quadro não perder a memória do que já foi resolvido.

- **Entrega 14, fatia 5 — as telas do segundo fator** — a entrada virou dois passos, e o
  segundo não é tratado como erro: a senha foi aceita, então a tela avança em vez de acusar
  credencial errada, e um código errado não apaga a senha já conferida. A segurança da conta
  abre com o veredito — "seu acesso depende só da senha" alarma, "pede duas provas" não — e os
  dez códigos de recuperação aparecem uma vez, com o aviso de guardá-los fora deste computador
  e fora do telefone que os gera. Desligar exige código na tela porque exige no servidor.

- **Entrega 14, fatia 4 — o segundo fator vale na entrada** — a senha sozinha deixou de bastar
  para quem o ativou: ela devolve 401 sem token e sem cookie, pedindo o código. O desafio roda
  **depois** de a senha ser conferida, porque responder "informe o código" a quem errou a senha
  confirmaria a conta e entregaria que ela tem segundo fator. O campo aceita os seis dígitos ou
  um código de recuperação, que é o que se procura justamente quando o telefone sumiu. O código
  do aplicativo é gasto dentro do passo de trinta segundos — interceptá-lo não compra uma
  segunda entrada — e o de recuperação é gasto para sempre, com auditoria própria.

- **Entrega 14, fatia 3 — a inscrição** — gerar, provar, ativar. Gerar não liga o fator: um
  segredo que valesse na hora trancaria do lado de fora quem começa e desiste. Ativar exige um
  código do aplicativo, e só então saem os dez códigos de recuperação, guardados em hash.
  Desligar também exige código — sem essa prova, quem tomasse uma sessão aberta removeria o
  segundo fator e teria a conta inteira. Onze testes de integração, incluindo o segredo cifrado
  na coluna, os códigos que nunca aparecem em claro, e a força bruta barrada em cinco tentativas.
- **Demo republicado** — front e API na mesma versão de novo. O front tinha subido sozinho e
  quebrado a entrada por vinte minutos: o bundle novo mandava `organizationSlug` e a API
  publicada ainda esperava `organizationId`. A ordem certa está registrada na memória do
  projeto, junto com o `--scope` obrigatório da Vercel e o slug que a migração gerou.

- **Entrega 13 aceita** — adapter de e-mail, caixa de saída, recuperação de senha e as telas,
  com a CI verde em `e58c6de`.
- **Entrega 14, fatia 1 — a primitiva do segundo fator** — RFC 6238 sobre `node:crypto`, sem
  dependência: o algoritmo inteiro cabe em algumas dezenas de linhas, e uma biblioteca aqui
  seria superfície de cadeia de suprimento sem ganho. Conferida contra os vetores de referência
  da própria RFC, que é o que impede um erro de deslocamento no truncamento aparecer só como
  "meu aplicativo não funciona". A comparação é de tempo constante e sem curto-circuito — sair
  no primeiro acerto revelaria pelo tempo qual passo casou. O segredo é cifrado com AES-256-GCM
  antes de tocar o banco: um despejo não pode entregar o segundo fator, senão o fator adicional
  é encenação.

- **Entrega 13, fatia 3 — o e-mail sai de verdade** — em desenvolvimento a mensagem chega no
  Mailpit em `localhost:8025`, e ver isso vale mais que acreditar num teste. O adaptador SMTP
  não trouxe dependência nova: fala o subconjunto que o Mailpit aceita, com assunto em palavra
  codificada e corpo em base64 — o que resolve de uma vez acento, escape de ponto e limite de
  linha. Ele recusa produção e recusa host que não seja local, as duas de forma estrutural, e
  o comentário diz por quê: sem TLS e sem autenticação, apontá-lo a um relay externo por engano
  de configuração vazaria mensagem em claro pela rede. O adaptador de produção entra junto com
  a escolha do relay, que segue em aberto na ADR-014.

- **Entrega 13, fatia 2 — as telas de recuperação** — "esqueci a senha" e "criar nova senha",
  as duas públicas. A confirmação do pedido é deliberadamente condicional — "se houver uma
  conta ativa" —, porque a tela não sabe e não pode fingir que sabe; a única resposta que se
  distingue é o limite de tentativas, e essa é informação para o próprio usuário. Concluir avisa
  que as sessões de outros dispositivos caíram, e esquece a identidade guardada aqui, cuja
  sessão não existe mais. As quatro telas de porta passaram a dividir `styles/gate.css`.
- **Entrar sem redigitar** — escritório e e-mail guardados no dispositivo, "manter conectado"
  como escolha explícita, e a última tela retomada ao reabrir. A senha fica com o gerenciador do
  navegador: o formulário passou a declarar `name` e `autocomplete` para ele se oferecer.
  De quebra, o cookie de sessão deixou de ser sempre persistente — o padrão agora termina ao
  fechar o navegador, adequado a máquina compartilhada de escritório.

- **Entrega 12 aceita** — escopo completo em `59c046c`, com os cinco jobs da CI verdes.
- **Entrega 13, fatia 1 — caixa de saída e recuperação de senha** — o e-mail deixou de ser
  promessa. O contrato `EmailProvider` vive em `@lex-os/shared` com modelos em catálogo
  fechado e texto puro; nenhum código de domínio conhece SMTP. A API grava a intenção em
  `email_outbox` **na mesma transação** do fato que a origina, e o worker drena no laço que já
  existia — handler HTTP não abre conexão de rede. O pedido de redefinição responde 204 sempre:
  endereço desconhecido, pessoa bloqueada e escritório inexistente recebem o mesmo silêncio de
  uma conta real. Concluir derruba todas as sessões abertas, porque quem redefine senha
  costuma fazê-lo suspeitando de acesso indevido. Oito testes de integração.

- **Harness de interface** — criar uma tela deixou de exigir abrir `tokens.css`, `styles.css`
  e uma view de exemplo. `docs/product/ui-harness.md` cataloga tokens, classes prontas,
  componentes, o esqueleto de tela e as oito regras que reprovam revisão; `patterns.css` traz a
  gramática que estava copiada em cada view — `.panel` aparecia em treze arquivos,
  `.state__title` em nove. As duas telas novas nasceram sem reescrever nada disso.
- **Entrega 12, fatia 4 — as telas da equipe** — a administração ganhou rosto. A tela abre com
  quem tem acesso, e só alarma quando há bloqueio. O convite entrega o link **uma vez**, com o
  aviso de que ele não volta e de que quem o tiver entra no acervo: a ausência de e-mail é dita,
  não escondida. Não há botão para bloquear a si mesmo, porque o servidor recusaria — a tela não
  promete o que seria negado. O aceite é uma tela pública própria, a primeira que uma pessoa nova
  vê do produto: ela explica onde a pessoa está antes de pedir a senha, exige as duas iguais, e
  repassa a recusa do servidor sem inventar qual das quatro causas foi.

- **Entrega 12, fatia 3 — papéis e bloqueio** — o backend da administração fecha. O conjunto de
  papéis é **substituído**, não somado: apagar e recriar dentro da transação evita a aritmética
  de diferença, que é onde sobra um papel por engano. A regra de concessão virou um serviço só,
  usada pelo convite e pela troca — duas cópias divergiriam no dia em que uma fosse ajustada.
  Bloquear revoga todas as sessões de atualização na mesma transação, com motivo registrado; o
  token vivo já para de funcionar na requisição seguinte porque o guard reconsulta o banco a
  cada chamada, e há teste provando os dois. Reativar só age sobre quem está bloqueado: quem foi
  convidado e não aceitou ainda não tem senha. Ninguém altera os próprios papéis nem o próprio
  acesso — sem isso o último administrador tranca o escritório para fora da própria conta.

- **Entrega 12, fatia 2 — o escritório convida sozinho** — o ciclo convidar → aceitar → entrar
  existe de ponta a ponta. O token é opaco de 256 bits, guardado só em hash, devolvido **uma
  única vez** na resposta e nunca em log ou auditoria. O uso único é garantido pelo banco, não
  por checagem prévia: o aceite atualiza a linha com o estado esperado no `where`, então dois
  pedidos com o mesmo token disputam a cláusula e só um altera. Toda recusa diz a mesma coisa —
  inexistente, expirado, usado e revogado são indistinguíveis. Convidar não é caminho de
  escalada: só se concede papel que quem convida já tem, verificado por consulta. A senha exige
  doze caracteres no aceite, e não os oito da entrada, porque é o único momento em que dá para
  subir o piso sem trancar quem já entra. Onze testes de integração, incluindo isolamento entre
  escritórios na listagem e na revogação.
- **ADR-014 — o que está ficando na mesa** — oito pendências de identidade registradas com o
  que destrava cada uma: senha esquecida sem caminho, convite que viaja fora do sistema,
  ausência de segundo fator e de entrada federada, escritório que não se cadastra sozinho, nome
  curto imutável, pessoa presa a um escritório, e o último administrador que pode se trancar do
  lado de fora. Duas coisas que pareciam pendência não são, e o registro diz por quê: bloqueio e
  troca de papel valem na requisição seguinte, porque o guard reconsulta o banco a cada chamada.

- **Entrega 12, fatia 1 — o escritório tem nome** — entrar deixou de exigir um UUID colado.
  A organização ganhou um `slug` único e imutável, com a mesma forma validada no DTO e numa
  constraint do banco, e o campo aceita o valor em qualquer caixa porque quem digita não tem
  que acertar isso. Slug inexistente e senha errada continuam indistinguíveis: a consulta junta
  escritório e pessoa numa só, o caminho de erro ainda verifica o hash de mentira, e a contagem
  de tentativas passou a ser chaveada pelo slug enviado — chavear pelo identificador resolvido
  deixaria sem freio a tentativa contra um escritório que não existe. O formulário aceita o
  escritório pré-preenchido por `?escritorio=`, que é identificador e não conteúdo. A migração
  cria também `user_invitations`, com token só em hash, uso único, validade e chave composta
  com o tenant para o banco recusar convite que aponte para outra organização.
- **Entrega 11 aceita** — os cinco jobs obrigatórios passaram na `main` em `ab9de3d`,
  incluindo o ensaio de recuperação no lugar novo e a jornada completa no Playwright.

- **Reconciliação da PR #7 com a `main`** — os dois lados construíram a Entrega 11 em paralelo e
  colidiram em oito arquivos, dois deles `add/add`. A resolução escolheu por mérito, não por lado:
  fica o `pre-commit` da `main`, que roda só sobre o que está em stage; fica o ensaio de
  recuperação da PR, que restaura em banco descartável, compara impressão digital de onze tabelas e
  também exercita o object storage — o da `main`, que derrubava o schema no lugar, foi removido em
  vez de conviver duplicado. O job de `dependency-review` estava duplicado pela auto-merge e o
  `pnpm-workspace.yaml` tinha duas chaves `overrides:`, que era o erro de parse do lockfile.
  O ensaio ficou no job de e2e porque exige api, web e worker de pé: no job de integração, onde a
  `main` o tinha, ele falharia. As duas asserções mais fortes da PR foram enxertadas na jornada
  completa: a procedência do documento depois de o worker rodar de verdade, e a auditoria filtrada
  pela ação exata `timeline.event.confirmed`.

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
**Feito** o que mudou para quem não acompanhou — não o nome do cartão.## A fazer — qualidade de interface

| Cartão                           | Detalhe                                                                                                                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| QR na inscrição do segundo fator | Hoje o cadastro é pela chave ou pelo link. Um codificador escrito à mão erra em silêncio — um QR sutilmente errado só aparece quando alguém tenta ler. Uma dependência resolve |

| Cartão                                   | Detalhe                                                                                                         |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Seletor de papéis na equipe              | A rota existe; falta mostrar o que cada papel permite. Lista de nomes soltos levaria a conceder acesso às cegas |
| Limpar o CSS duplicado das views antigas | `.panel` em treze arquivos, `.state__title` em nove. Depende de cobertura visual para ser seguro                |

---

## Fazendo

| Cartão                                                            | Detalhe                                                                                                               |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Entrega 12 — Onboarding do escritório e administração de usuários | Autorizada pela sociedade em 2026-08-20. Backend e telas prontos. Falta o seletor de papéis com o que cada um permite |

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

| Cartão | O que falta                                                                                          |
| ------ | ---------------------------------------------------------------------------------------------------- |
| —      | Nada bloqueado. A administração de usuários saiu daqui: virou a Entrega 12, autorizada em 2026-08-20 |

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

| Cartão                           | Registro | Trava                                                                        |
| -------------------------------- | -------- | ---------------------------------------------------------------------------- |
| Fronteira de identidade e acesso | ADR-014  | Oito pendências registradas. As duas primeiras dependem do adapter de e-mail |
| Aprovar a fundação de design     | —        | Nada: já é possível construir em cima                                        |
| Família tipográfica definitiva   | —        | Exige licença e teste em documento denso                                     |

---

## Verificação pendente

Itens que não são funcionalidade, mas que a equipe não deve esquecer.

| Cartão                            | Situação                                                                                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Gate de lint e formato pré-commit | Instalado em 2026-08-18 dentro da Entrega 11; falha fechado sem pnpm                                                                       |
| Matriz E2E ampliada               | Jornada total no Playwright e abuso HTTP da matriz cobertos; CI do `08dd44d` verde                                                         |
| Limitações de produção            | Registradas no README e no runbook em 2026-08-18: mocks, ADR-010/012/013, admin de usuários e hold jurídico bloqueiam dado real            |
| Checklist em caso sem template    | Corrigido em 2026-08-18: a etapa conclui sem exigências, o EMBEDDING roda e o documento segue pesquisável; coberto por teste de integração |

---

## Feito

Ordem cronológica inversa. Serve para o quadro não perder a memória do que já foi resolvido.

- **Entrega 12, fatia 3 — papéis e bloqueio** — o backend da administração fecha. O conjunto de
  papéis é **substituído**, não somado: apagar e recriar dentro da transação evita a aritmética
  de diferença, que é onde sobra um papel por engano. A regra de concessão virou um serviço só,
  usada pelo convite e pela troca — duas cópias divergiriam no dia em que uma fosse ajustada.
  Bloquear revoga todas as sessões de atualização na mesma transação, com motivo registrado; o
  token vivo já para de funcionar na requisição seguinte porque o guard reconsulta o banco a
  cada chamada, e há teste provando os dois. Reativar só age sobre quem está bloqueado: quem foi
  convidado e não aceitou ainda não tem senha. Ninguém altera os próprios papéis nem o próprio
  acesso — sem isso o último administrador tranca o escritório para fora da própria conta.

- **Entrega 12, fatia 2 — o escritório convida sozinho** — o ciclo convidar → aceitar → entrar
  existe de ponta a ponta. O token é opaco de 256 bits, guardado só em hash, devolvido **uma
  única vez** na resposta e nunca em log ou auditoria. O uso único é garantido pelo banco, não
  por checagem prévia: o aceite atualiza a linha com o estado esperado no `where`, então dois
  pedidos com o mesmo token disputam a cláusula e só um altera. Toda recusa diz a mesma coisa —
  inexistente, expirado, usado e revogado são indistinguíveis. Convidar não é caminho de
  escalada: só se concede papel que quem convida já tem, verificado por consulta. A senha exige
  doze caracteres no aceite, e não os oito da entrada, porque é o único momento em que dá para
  subir o piso sem trancar quem já entra. Onze testes de integração, incluindo isolamento entre
  escritórios na listagem e na revogação.
- **ADR-014 — o que está ficando na mesa** — oito pendências de identidade registradas com o
  que destrava cada uma: senha esquecida sem caminho, convite que viaja fora do sistema,
  ausência de segundo fator e de entrada federada, escritório que não se cadastra sozinho, nome
  curto imutável, pessoa presa a um escritório, e o último administrador que pode se trancar do
  lado de fora. Duas coisas que pareciam pendência não são, e o registro diz por quê: bloqueio e
  troca de papel valem na requisição seguinte, porque o guard reconsulta o banco a cada chamada.

- **Entrega 12, fatia 1 — o escritório tem nome** — entrar deixou de exigir um UUID colado.
  A organização ganhou um `slug` único e imutável, com a mesma forma validada no DTO e numa
  constraint do banco, e o campo aceita o valor em qualquer caixa porque quem digita não tem
  que acertar isso. Slug inexistente e senha errada continuam indistinguíveis: a consulta junta
  escritório e pessoa numa só, o caminho de erro ainda verifica o hash de mentira, e a contagem
  de tentativas passou a ser chaveada pelo slug enviado — chavear pelo identificador resolvido
  deixaria sem freio a tentativa contra um escritório que não existe. O formulário aceita o
  escritório pré-preenchido por `?escritorio=`, que é identificador e não conteúdo. A migração
  cria também `user_invitations`, com token só em hash, uso único, validade e chave composta
  com o tenant para o banco recusar convite que aponte para outra organização.
- **Entrega 11 aceita** — os cinco jobs obrigatórios passaram na `main` em `ab9de3d`,
  incluindo o ensaio de recuperação no lugar novo e a jornada completa no Playwright.

- **Reconciliação da PR #7 com a `main`** — os dois lados construíram a Entrega 11 em paralelo e
  colidiram em oito arquivos, dois deles `add/add`. A resolução escolheu por mérito, não por lado:
  fica o `pre-commit` da `main`, que roda só sobre o que está em stage; fica o ensaio de
  recuperação da PR, que restaura em banco descartável, compara impressão digital de onze tabelas e
  também exercita o object storage — o da `main`, que derrubava o schema no lugar, foi removido em
  vez de conviver duplicado. O job de `dependency-review` estava duplicado pela auto-merge e o
  `pnpm-workspace.yaml` tinha duas chaves `overrides:`, que era o erro de parse do lockfile.
  O ensaio ficou no job de e2e porque exige api, web e worker de pé: no job de integração, onde a
  `main` o tinha, ele falharia. As duas asserções mais fortes da PR foram enxertadas na jornada
  completa: a procedência do documento depois de o worker rodar de verdade, e a auditoria filtrada
  pela ação exata `timeline.event.confirmed`.

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
