# LEX OS

O LEX OS é um sistema inteligente de operações jurídicas para escritórios de advocacia brasileiros. O projeto recebe material operacional desorganizado e prepara um dossiê jurídico estruturado, pesquisável e rastreável para análise humana.

O último marco aceito é a **Entrega 10 — Fatia vertical essencial da web**. O repositório oferece a stack local reproduzível, a plataforma jurídica e de arquivos autenticada e isolada por tenant, um pipeline persistente de sete etapas em BullMQ, análise determinística de cronologia/checklist com fontes e indexação de embeddings, busca textual em português no PostgreSQL, recuperação exata com pgvector, ranqueamento híbrido, citações resolvíveis, respostas mock ancoradas em fontes, tetos de processamento por caso, procedência segura de auditoria e uma interface responsiva em pt-BR sobre a API implementada. Provedores reais e o endurecimento de verificação da Entrega 11 permanecem intencionalmente adiados.

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

Um único comando constrói as aplicações, inicia todos os serviços necessários e aguarda os health checks:

```bash
pnpm infra:up
```

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
pnpm build
pnpm db:validate
pnpm infra:config
```

O `db:validate` formata e valida o schema do Prisma e confere que as adições revisadas de SQL bruto continuam na migração. Os testes de integração de banco exigem o serviço PostgreSQL do Compose com a migração já aplicada. O Playwright exige a stack completa, o seed fictício e o `SEED_ADMIN_PASSWORD` local; ele exercita o fluxo autenticado crítico em viewports de desktop e celular sem criar dados jurídicos.

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

## Limitações atuais

- o login exige o UUID da organização porque a descoberta pública e o onboarding de organizações estão adiados;
- os endpoints de onboarding público de organizações e de administração de usuários seguem adiados;
- os identificadores de pessoa são mascarados de propósito nas respostas da API até que uma permissão dedicada a identificadores sensíveis seja desenhada;
- remoção/atualização de participantes e políticas de titularidade da equipe do caso seguem adiadas; a Entrega 5 cobre associação validada e listagem;
- o throttle genérico de requisições do NestJS é local ao processo; o estado de força bruta do login fica no Redis e é compartilhado;
- uma política confiável de reverse proxy/IP precisa ser configurada antes de um deploy de produção exposto à internet;
- a recepção de ZIP está desabilitada; os tipos aceitos são PDF, JPEG, PNG e texto UTF-8, com máximo padrão de 25 MiB por arquivo e 10 arquivos por requisição;
- o scanner determinístico de malware é apenas de desenvolvimento/teste e a API se recusa a iniciar com ele em produção; um adaptador de scanner de produção ainda é necessário;
- os provedores de processamento e embedding são mocks determinísticos de desenvolvimento/teste; API e worker se recusam a iniciar em produção até que adaptadores de provedores reais sejam configurados;
- uploads duplicados são vinculados dentro de um tenant, mas o segundo objeto é retido até que uma política de retenção/deduplicação de produção seja aprovada;
- a reconciliação relata condições de ausência, quarentena estagnada e órfãos sem apagar automaticamente evidência jurídica;
- não há adaptador de e-mail, apesar do Mailpit local;
- a interface essencial de revisão/busca e o CRUD de pessoas estão implementados; o onboarding de organizações e a administração de usuários seguem adiados;
- as respostas ancoradas e os provedores de processamento ainda usam apenas adaptadores determinísticos de desenvolvimento/teste;
- as políticas de produção de retenção de objetos, legal hold, backup/restore e expurgo irreversível seguem como bloqueios de governança;
- a matriz essencial do Playwright roda localmente; cobertura ampla de casos de abuso, revisão de dependências, ensaio de backup/restore e endurecimento do CI permanecem agendados para a Entrega 11;
- os hooks de Git cobrem apenas a política de mensagem de commit; o gate de lint/formato no pré-commit ainda não foi instalado.

O marco aceito é a **Entrega 10 — Fatia vertical essencial da web**. O trabalho governado restante é acompanhado em [`docs/product/backlog.md`](./docs/product/backlog.md); a Entrega 11 ainda exige autorização explícita.
