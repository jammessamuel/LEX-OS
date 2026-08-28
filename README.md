# LEX OS

O LEX OS é um sistema inteligente de operações jurídicas para escritórios de advocacia brasileiros. O projeto recebe material operacional desorganizado e prepara um dossiê jurídico estruturado, pesquisável e rastreável para análise humana.

O último marco aceito é a **Entrega 10 — Fatia vertical essencial da web**. A **Entrega 11 — Verificação do MVP e endurecimento do CI** está autorizada e implementada, e só é aceita depois que toda a matriz de CI passar na `main`: qualidade, integração com ensaio de recuperação, Playwright, revisão de dependências e o contrato OpenAPI inventariado. Provedores reais de IA/OCR/scanner, ingestão por e-mail, legal hold e administração completa de usuários permanecem fora desta entrega.

## Base da arquitetura

- workspace pnpm com Turborepo;
- API NestJS e processo worker NestJS separado;
- cliente web Vue 3 com Vite, Pinia e Vue Router;
- PostgreSQL 18 com pgvector, Redis, MinIO privado e Mailpit via Docker Compose;
- pacote de banco Prisma 7 com adaptador de driver PostgreSQL e helper de transação;
- migração revisada com pgcrypto, pgvector, chaves estrangeiras compostas por tenant, índices parciais e checks;
- seed fictício idempotente com hash de senha Argon2id;
- plataforma HTTP `/api/v1` com validação estrita de DTOs, envelopes de erro estáveis, primitivos de paginação por cursor, CORS/Helmet e OpenAPI gerado;
- tokens de acesso JWT de curta duração e cookies de refresh opacos guardados apenas como hash SHA-256, com rotação, revogação de família e detecção de replay;
- proteção contra força bruta no login apoiada em Redis, verificação de usuário bloqueado e falhas de autenticação que não permitem enumeração;
- contexto de tenant derivado da sessão autenticada e autorização por código de permissão, sem ramificação por nome de papel;
- auditoria de autenticação append-only com allowlist de campos e testes de redação dos logs estruturados;
- CRUD de pessoas e casos isolado por tenant com exclusão lógica, paginação keyset opaca e comportamento de não-encontrado entre tenants;
- validação e normalização de CPF/CNPJ com saída mascarada na API e nenhum valor de identidade em logs ou auditoria;
- responsável do caso, situação, prioridade, política de confidencialidade e auditoria de leitura confidencial;
- participantes de caso validados, apoiados em chaves estrangeiras compostas por tenant e resumo de pessoa em consulta única;
- recepção multipart em streaming para storage privado compatível com S3, com memória limitada, chaves geradas, SHA-256, verificação real de MIME/assinatura e interface de scanner que falha fechado;
- vínculo de duplicados dentro do mesmo tenant, persistência transacional de arquivo/documento/job, URLs de download autorizadas de 60 segundos e reconciliação de storage não destrutiva;
- listagem e detalhe de documentos por tenant, correção humana de metadados, verificação de visibilidade por tipo de documento e exclusão lógica auditada;
- mensagens de fila estritas e versionadas contendo apenas identificadores de job/tenant/correlação, com uma fila BullMQ por etapa implementada;
- transições de job persistentes e otimistas, novas tentativas exponenciais limitadas, IDs de filho determinísticos, segurança contra entrega duplicada e reconciliação de jobs travados;
- OCR/texto, classificação e extração de entidades determinísticos para desenvolvimento/teste, com procedência append-only e estado obrigatório de revisão humana;
- saídas determinísticas validadas de cronologia/checklist, localizadores de fonte no mesmo caso, extrações de geração imutáveis e eventos de IA não confirmados;
- confirmação humana auditada da cronologia, instantâneos versionados de checklist, revisão de itens e uma tarefa rastreável por item pendente selecionado;
- rotas HTTP de progresso de processamento, histórico de extrações e reprocessamento cientes de tenant/RBAC/confidencialidade;
- rotas HTTP de cronologia, checklist e tarefas cientes de tenant/RBAC/confidencialidade;
- travessia de pessoa para casos, resumo de usuários atribuíveis, atualizações do ciclo de vida de tarefas e confirmação de entidades extraídas;
- geração de respostas ancoradas em fontes que recusa sem evidência autorizada e valida cada citação de afirmação;
- contabilidade exata de custo de processamento em BRL com reservas atômicas e teto rígido recuperável por caso;
- configuração de ambiente tipada com validação explícita de produção;
- logs JSON estruturados com IDs de requisição e correlação;
- liveness, readiness e métricas de processo na API;
- volumes nomeados de desenvolvimento para PostgreSQL, Redis e MinIO.

Leia o [`AGENTS.md`](./AGENTS.md), o [guia de desenvolvimento local](./docs/architecture/local-development.md) e os documentos em [`docs/`](./docs/) antes de alterar o sistema. O [`CLAUDE.md`](./CLAUDE.md) é a tabela de roteamento que um agente deve ler primeiro.

O [alinhamento com o roadmap](./docs/product/roadmap-alignment.md) mapeia os 11 componentes e as 4 fases da proposta conceitual sobre as 12 entregas e registra as quatro decisões ainda em aberto.

## Pré-requisitos

- Node.js `>=24.14.0 <25` (`24.18.0` fixado no `.node-version`);
- Corepack e pnpm `11.9.0`;
- Docker Desktop ou um Docker Engine compatível com Compose.

## Instalar e configurar

```bash
corepack enable
corepack prepare pnpm@11.9.0 --activate
pnpm install --frozen-lockfile
cp .env.example .env
```

Substitua cada valor `replace-with-*` do `.env` por uma credencial exclusivamente local. O arquivo é ignorado pelo Git. Nunca o commite nem cole seus valores em logs, issues ou documentação.

## Subir a stack completa

Em um clone limpo o schema precisa existir antes das aplicações: o worker reconcilia jobs no boot e não fica saudável em um banco vazio. Um comando cobre a ordem inteira, com guarda que recusa endpoint que não seja local:

```bash
pnpm infra:bootstrap
```

Ele executa, nesta ordem, o que a CI também executa:

```bash
pnpm infra:dependencies
pnpm db:migrate:deploy
pnpm db:migrate:status
pnpm db:seed
pnpm infra:up
```

`pnpm infra:up` sozinho reconstrói e aguarda a stack quando o volume do PostgreSQL já tem migração. Não use isso como primeiro passo após `docker compose down --volumes`.

Endpoints locais:

| Componente    | URL ou porta                                     |
| ------------- | ------------------------------------------------ |
| Web           | `http://localhost:5173`                          |
| API           | `http://localhost:3000/api/v1`                   |
| OpenAPI UI    | `http://localhost:3000/api/v1/docs`              |
| OpenAPI JSON  | `http://localhost:3000/api/v1/docs/openapi.json` |
| Liveness      | `http://localhost:3000/api/v1/health/live`       |
| Readiness     | `http://localhost:3000/api/v1/health/ready`      |
| Métricas      | `http://localhost:3000/api/v1/metrics`           |
| PostgreSQL    | `localhost:5433` via Docker, porta interna 5432  |
| Redis         | `localhost:6379`                                 |
| MinIO API     | `http://localhost:9000`                          |
| Console MinIO | `http://localhost:9001`                          |
| Mailpit       | `http://localhost:8025`                          |

A porta do PostgreSQL no Docker usa `5433` por padrão, então uma instância de PostgreSQL que já ocupe a porta convencional `5432` do host pode permanecer ativa.

A API escuta na variável de ambiente `PORT` de plataformas gerenciadas quando ela existe e recua para `API_PORT` na execução local e no Compose. Isso mantém o roteamento externo e os health checks na mesma porta sem mudar o contrato de desenvolvimento local.

Inspecionar ou parar o ambiente sem apagar os volumes persistentes:

```bash
pnpm infra:ps
pnpm infra:down
```

O `infra:down` omite `--volumes` de propósito; os dados de PostgreSQL, Redis e MinIO sobrevivem à recriação normal dos contêineres.

## Preview de staging na Railway

O repositório mantém arquivos separados de configuração como código da Railway para os três processos de aplicação:

| Serviço | Arquivo de configuração      |
| ------- | ---------------------------- |
| API     | `/infra/railway/api.json`    |
| Worker  | `/infra/railway/worker.json` |
| Web     | `/infra/railway/web.json`    |

Configure em cada serviço a opção **Railway Config File** apontando para o caminho absoluto correspondente no repositório. A configuração da API executa as migrações forward revisadas como etapa de pré-deploy; o worker nunca executa migrações. Um deploy de staging a partir de um CLI autenticado e vinculado usa então:

```bash
railway up --service api --environment staging
railway up --service worker --environment staging
railway up --service web --environment staging
```

Mantenha as dependências de staging restritas ao ambiente de staging. Em particular, configure o Redis da API e do worker com referências de serviço da Railway (`Redis.REDISHOST`, `Redis.REDISPORT` e `Redis.REDISPASSWORD`) em vez de credenciais copiadas. O serviço MinIO de staging usa a imagem `minio/minio:RELEASE.2025-04-22T22-12-26Z`, um volume montado em `/data` e o comando de início `minio server /data --console-address :9001`. Defina `WEB_ORIGIN` com o domínio web de staging gerado e `VITE_API_BASE_URL` com a URL `/api/v1` da API de staging.

Use um token de projeto de curta duração quando precisar de automação e revogue-o após o deploy. Nunca commite nem imprima o token. Os provedores determinísticos atuais tornam isso um preview de desenvolvimento apenas: os bloqueios de produção listados abaixo continuam valendo.

## Rodar as aplicações no host

Para o modo watch, suba apenas as dependências e depois os três processos de aplicação:

```bash
pnpm infra:dependencies
pnpm dev
```

Os processos no host deste projeto devem usar o PostgreSQL gerenciado pelo Compose em `DATABASE_PORT=5433`. Um PostgreSQL local sem relação com o projeto pode permanecer na `5432`; os comandos do LEX OS não devem apontar para ele. Não execute os serviços `api`, `worker` e `web` do Compose ao mesmo tempo que o modo watch no host nas mesmas portas.

## Verificações de qualidade

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm deps:audit
pnpm ops:recovery:rehearse
pnpm build
pnpm db:validate
pnpm infra:config
```

O `db:validate` formata e valida o schema do Prisma e confere que as adições revisadas de SQL bruto continuam na migração. Os testes de integração de banco exigem o serviço PostgreSQL do Compose com a migração já aplicada. O Playwright exige a stack completa, o seed fictício e o `SEED_ADMIN_PASSWORD` local; ele exercita a jornada essencial e a jornada fictícia completa em viewports de desktop e celular, sem criar dados jurídicos. O ensaio de recuperação é restrito ao endpoint local do Compose e a um conjunto exclusivamente fictício de organização e usuários; o comportamento exato está no [runbook operacional](./docs/operations/runbook.md).

Os testes de contrato de autenticação e tenant da API também exigem o PostgreSQL do Compose na `5433`, o Redis autenticado e o MinIO privado. Consulte [Autenticação e contrato HTTP](./docs/api/authentication.md), [API do resumo do painel](./docs/api/dashboard.md), [API de pessoas, casos e participantes](./docs/api/people-cases-participants.md), [API de arquivos e documentos](./docs/api/files-documents.md), [API de processamento](./docs/api/processing.md), [API do assistente ancorado](./docs/api/assistant.md), [API de auditoria autorizada](./docs/api/audit.md) e [API de cronologia, checklist e tarefas](./docs/api/timeline-checklists-tasks.md).

## Fluxo de banco de dados

O `.env` do repositório deve definir `DATABASE_URL` e um `SEED_ADMIN_PASSWORD` exclusivamente local. Para o banco do Compose, use o endpoint PostgreSQL na porta `5433` do host.

```bash
pnpm infra:dependencies
pnpm db:validate
pnpm db:migrate:deploy
pnpm db:migrate:status
pnpm db:seed
pnpm test:integration
```

Use `pnpm db:migrate:dev --name <nome_descritivo>` apenas para criar uma migração forward revisada. O `pnpm db:reset` remove irreversivelmente todos os dados do banco configurado e só é permitido em um banco de desenvolvimento explicitamente verificado.

## Limitações atuais e bloqueios de produção

Estes itens estão registrados de propósito. Nenhum deles autoriza dado real de cliente.

- descoberta pública de escritório e autocadastro estão adiados; a entrada pede o nome curto do escritório, não o UUID;
- identificadores de pessoa saem mascarados até existir permissão específica para dado sensível;
- remoção/atualização de participantes e titularidade da equipe do caso seguem adiadas;
- o throttle genérico do NestJS é local ao processo; a força bruta do login vive no Redis;
- um reverse proxy confiável (IP real, TLS, `Secure` no cookie de refresh) é obrigatório antes de exposição à internet;
- ZIP está desabilitado; a allowlist é PDF, JPEG, PNG e texto UTF-8, 25 MiB e 10 arquivos por requisição;
- scanner, OCR, classificação, extração e embedding são mocks determinísticos e recusam `NODE_ENV=production`;
- o modelo de linguagem tem adaptador real e **não há mais trava de código impedindo-o de rodar sobre acervo real**: a guarda por `CASE_ARCHIVE` foi removida por decisão do dono em 2026-08-28, com a cláusula de não-treino do fornecedor ainda pendente de comprovação. Enquanto ela não estiver arquivada, apontar esta instalação para acervo de cliente envia conteúdo de processo a terceiro sem base contratual comprovada;
- upload duplicado é vinculado dentro do tenant, mas o segundo objeto continua armazenado até existir política aprovada de retenção e deduplicação;
- a reconciliação relata objeto ausente, quarentena velha e órfão sem apagar nada: prova jurídica não se remove automaticamente;
- não há adaptador de e-mail de ingestão (ADR-010); o de notificação interna (ADR-013) existe, com caixa de saída, despachante e os três gatilhos ligados;
- do ADR-012, retenção e legal hold estão construídos; o que ainda bloqueia dado real de cliente é a hospedagem nos Estados Unidos sem transferência internacional consentida e a ausência de responsável nomeado pelo atendimento a titular;
- o ensaio de recuperação prova mecânica, e só isso: não é política de backup de produção, nem define RPO, RTO, residência regional ou legal hold, e roda apenas sobre fixture fictício;
- busca vetorial é exata, sem índice ANN, até um modelo/dimensão de produção ser escolhido;
- os hooks de Git rodam formato e lint antes do commit e aplicam a política de mensagem; os demais gates obrigatórios rodam na CI;
- a tela de entrada oferece guardar a senha neste dispositivo, e ela fica em texto puro no armazenamento do navegador; antes de dado real de cliente essa opção precisa sair ou virar decisão por escritório;
- o demo hospedado contém somente dados fictícios; não é ambiente de produção jurídica.

O marco aceito é a **Entrega 15 — o caso carrega o número do processo**, aceita em 2026-08-25. A Entrega 16 (biblioteca de prompts por especialidade) e, depois dela, o adaptador de modelo real e os três gatilhos do ADR-013 estão autorizados e em andamento, ainda não aceitos: o marco só avança quando a CI fechar verde sobre eles. A fronteira de escopo vigente está na seção 0.3 do [`CLAUDE.md`](./CLAUDE.md), o estado por ADR e a ordem do que falta em [`docs/product/ordem-de-execucao.md`](./docs/product/ordem-de-execucao.md), o quadro de trabalho em [`docs/product/backlog.md`](./docs/product/backlog.md), e os bloqueios operacionais também no [runbook](./docs/operations/runbook.md).
