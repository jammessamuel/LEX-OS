# Ordem de execução — estado por ADR e o que vem a seguir

**Data:** 2026-08-26
**Para que serve:** não se perder. Quinze ADRs decidiram coisas ao longo de meses; algumas
viraram código, outras esperam, e algumas esperam sem que ninguém lembre por quê. Este
documento diz, de cada uma, o que está de pé — e monta **uma** ordem de execução que atravessa
todas.

Estado verificado no código em 2026-08-26, não deduzido dos ADRs.

---

## 1. Onde estamos, ADR por ADR

| ADR     | Decisão                        | Construído                                                            | Aberto                                                          |
| ------- | ------------------------------ | --------------------------------------------------------------------- | --------------------------------------------------------------- |
| **001** | Monólito modular, 2 raízes     | ✅ `apps/api` e `apps/worker`, fronteiras respeitadas                 | —                                                               |
| **002** | PostgreSQL + Prisma            | ✅ PG 18, Prisma 7.9.1 com `adapter-pg`, 17 migrações                 | —                                                               |
| **003** | Armazenamento de objetos       | ✅ Adaptador S3/MinIO, URL assinada, worker só escreve                | —                                                               |
| **004** | Multi-tenancy por organização  | ✅ `organization_id` em toda leitura e escrita, testes negativos      | —                                                               |
| **005** | pgvector                       | ✅ Busca híbrida, embeddings versionados                              | —                                                               |
| **006** | IA agnóstica de provedor       | ✅ Portas + mocks fail-closed                                         | Nenhum provedor real — **por decisão**, ver 011 e 012           |
| **007** | Trabalho em segundo plano      | ✅ BullMQ, `processing_job`, nada pesado em handler HTTP              | —                                                               |
| **008** | Nomenclatura técnica em inglês | ✅ Código, rotas e colunas                                            | —                                                               |
| **009** | Assistente fundamentado        | ✅ Recusa sem fonte autorizada, citação obrigatória                   | Teto de recuperação em 5 trechos limita pergunta ampla          |
| **010** | Canais de entrada              | ✅ Upload                                                             | ❌ **Canal de e-mail nunca foi construído** — zero no código    |
| **011** | Modelo de custo                | ✅ Cotação por execução, teto por caso enforçado, custo gravado       | ❌ Agregação por organização/provedor/modelo · ❌ `docs/legal/` |
| **012** | Retenção, legal hold, LGPD     | ✅ Sem purga automática                                               | ❌ **Legal hold: zero ocorrências** · ❌ Lista de suboperadores |
| **013** | Notificações internas          | ✅ Caixa de saída + despachante no worker (Entrega 13)                | ❌ Os três gatilhos: preparo concluído, falha, tarefa atribuída |
| **014** | Identidade e acesso            | ✅ Itens 1, 2 (Entrega 13) e 3 — TOTP (Entrega 14). Item 8 sem código | Itens 4–7 adiados **por decisão**, não por esquecimento         |
| **015** | Biblioteca de prompts          | ✅ Itens 1, 5, 6, 7 · ✅ Item 3 em três quartos                       | ❌ Item 4 (guarda pelo dado) · ❌ Item 2 (`REVIEWED` com OAB)   |

**Leitura rápida:** dos quinze, oito estão inteiramente de pé. O que sobra se concentra em três
lugares — os portões que liberam o provedor real (011, 012), o que promete aviso e não avisa
(010, 013), e o que a rodada de prompts abriu (015).

---

## 2. O que a Entrega 16 fechou nesta rodada

Escrita da biblioteca — vinte prompts, cinco tarefas × quatro faixas, noventa tipos de caso
levantados — e depois as três revisões adversariais, que inverteram a premissa: **o texto estava
melhor que a tubulação.**

Fechado em 2026-08-26:

| Defeito                                             | Antes                        | Agora                           |
| --------------------------------------------------- | ---------------------------- | ------------------------------- |
| Estados do checklist na saída                       | 2 de 8                       | 5 de 8, os três humanos de fora |
| Catálogo de tipos de documento                      | 21 códigos genéricos         | 65                              |
| Teto de citações por afirmação                      | 3                            | 5, o teto real da recuperação   |
| Precisão de data aceita pelo validador              | Só `DAY`                     | Os 6 do enum                    |
| Calibragem de confiança e importância na cronologia | Ausente nas três faixas      | Bloco comum nas três            |
| Detecção de página faltando                         | Nenhum dos 20 prompts        | Na cronologia                   |
| `normalizedValue` definido                          | Obrigatório e indefinido     | Definido nas três faixas        |
| Vigência julgada sem data de referência             | Só o trabalhista se defendia | As três se defendem             |
| Nome de menor em título de evento                   | Sem regra                    | Proibido, identifica pelo papel |

Erros de conteúdo corrigidos antes disso: três citações fabricadas na faixa trabalhista, cinco
erros de direito escritos por mim, três regressões contra os prompts genéricos, e no criminal a
justiça consensual saindo sem registro e a contestação vazando do bloco comum — peça que não
existe no processo penal.

---

## 3. A ordem de execução

Uma fila só, atravessando os ADRs. A posição de cada item é justificada; não é lista de desejos
por ordem de simpatia.

### Fila A — antes de qualquer cliente real tocar a biblioteca

**A0. A biblioteca não estava ligada ao worker** — descoberto e corrigido em 2026-08-26
Não estava nesta fila porque eu não sabia. O worker importava os quatro prompts genéricos direto
— `classificationPromptV1`, `entitiesPromptV1`, `timelinePromptV1`, `checklistPromptV1` — e
nunca chamava `promptFor`. **Doze dos quinze prompts de especialidade nunca rodaram**:
classificação, entidades, cronologia e checklist, nas três faixas. Só a resposta fundamentada,
que sai pela API, escolhia por especialidade.

A tubulação já existia: `job.document.case.legalArea` viaja no job desde sempre. Agora o
pipeline resolve o prompt pela área e passa a especificação aos provedores, que carimbam a
versão do que receberam em vez de uma constante. A procedência gravada em cada extração passa a
dizer qual prompt de fato rodou.

**A1. Guarda de rascunho pelo dado, não pelo ambiente** — ADR-015 item 4 · **FEITO 2026-08-26**
`assertUsableIn` recusava `DRAFT` só quando `NODE_ENV === 'production'`. O nome do processo não
mede risco: um laptop apontado para a base de um cliente roda como `development` e passava
inteiro. Agora a condição é `CASE_ARCHIVE`, com dois valores — `fictional` ou `real` — e
**sem padrão**: instalação que não declara não sobe. Omitir, errar o valor ou passar o nome de um
ambiente conta como acervo real, e rascunho é recusado.

Ganhou alcance junto com o A0: antes a guarda cobria uma das cinco tarefas, agora cobre as cinco.

**Antes do próximo deploy:** `CASE_ARCHIVE=fictional` precisa existir nos serviços `api` e
`worker` da Railway, e no seu `.env` local. Sem ela o processo falha na partida — de propósito.

**A2. Faixa cível ao nível das outras duas** — Entrega 16
Família e sucessões inteiras ausentes: sete dos trinta tipos levantados, zero documentos no
prompt. Endereço não é entidade. Número CNJ não é extraído — e a Entrega 15 se chama "o caso
carrega o número do processo". Mais quatorze achados da lente de prática.
**Segundo porque é a faixa que hoje entrega pior, e é trabalho de texto, sem contrato no meio.**

**A3. `REVIEWED` com nome, OAB e data** — ADR-015 item 2
Vinte de vinte estão `DRAFT`. Sem isso, promover é trocar uma palavra.
**Terceiro porque depende de existir um advogado revisor nomeado — decisão de pessoa, não de
código — e o A1 e o A2 não esperam por ela.**

**A4. Contrato de entrada do checklist** — ADR-015 item 3, o quarto que ficou
A entrada é `{ documentTypeCode, items: [{ id, documentTypeCode }] }`. Não vai o enunciado da
exigência nem o texto do documento: o prompt não tem como saber que o item 3 pede "matrícula
atualizada", e o que sobra é comparar duas strings — o que o mock já faz sem modelo.
**Quarto porque é decisão de entrega: muda contrato, validador, mapeamento e teste de deriva.**

### Fila B — os portões do provedor real

Nenhum destes é opcional, e nenhum existe hoje. Enquanto qualquer um faltar, o provedor real
permanece bloqueado — e é a única coisa que separa a biblioteca de valer para o cliente.

**B1. Lista de suboperadores versionada** — ADR-012
**B2. `docs/legal/` com os termos de tratamento registrados** — ADR-011, verificação 4
**B3. Agregação de custo por organização, provedor e modelo** — ADR-011, verificação 3
O teto por caso já existe e é enforçado (`Case.processingCostLimitAmount`, verificado em
`cases.repository.ts:272`). Falta somar por organização e abrir por provedor e modelo.
**B4. Custo do assistente debitando o orçamento do caso** — ADR-011
Hoje calcula e audita, não desconta.
**B5. Legal hold** — ADR-012. Zero ocorrências em código, e falha-fechado é o requisito.

**Ordem interna:** B1 e B2 são documento, não código, e destravam a conversa comercial — vêm
primeiro. B3 e B4 são o mesmo trabalho de agregação. B5 é o maior e o mais tarde, mas nada do
provedor real sai sem ele.

### Fila C — o que promete aviso e não avisa

**C1. Os três gatilhos do ADR-013** — preparo concluído, falha terminal de documento, tarefa
atribuída. A caixa de saída e o despachante já existem desde a Entrega 13: falta só quem
dispara. **É a maior razão de valor por linha de código na fila inteira.**

**C2. Canal de entrada por e-mail** — ADR-010. Decidido como MVP e nunca construído. Zero
ocorrências. Vale reabrir a decisão em vez de executá-la em silêncio: o upload atende, e o
canal de e-mail traz superfície de entrada não autenticada.

### Fila D — adiados por decisão, não esquecidos

Não fazer nada aqui é a decisão correta até a condição mudar. Registrado para ninguém
"descobrir a pendência" daqui a três meses e refazer a discussão.

| Item                           | ADR    | Condição para reabrir             |
| ------------------------------ | ------ | --------------------------------- |
| Entrada federada por OIDC      | 014, 4 | Primeira banca com IdP no funil   |
| Autocadastro de escritório     | 014, 5 | Teste gratuito ou autoatendimento |
| Troca de nome curto            | 014, 6 | Sem custo em esperar              |
| Pessoa em dois escritórios     | 014, 7 | Demanda real de cliente           |
| Conector de WhatsApp           | 010    | Depois do MVP                     |
| Teto de recuperação acima de 5 | 009    | Decisão de custo e de contexto    |

### Fila E — dívida fora de ADR

**E1. Senha guardada em `localStorage`** no front. Decidida pelo dono depois de objeção
registrada. **Bloqueio de produção**, não pendência de backlog.

**E2. `pnpm test:integration` não roda nesta máquina** — não há Docker instalado. A suíte que
cobre escrita de checklist, seed e fila só é exercida no CI. Não é defeito do código, mas
muda o que se pode afirmar localmente.

---

## 4. O que decide a próxima sessão

Se a pergunta é **"o que faz a biblioteca valer para o cliente?"** — Fila B, e dentro dela B1 e
B2, que são documento.

Se a pergunta é **"o que faz o produto parecer vivo?"** — C1, os três gatilhos. A fundação está
pronta desde a Entrega 13.

Se a pergunta é **"o que está inconsistente agora?"** — A1 e A2.

As três respostas são legítimas e mutuamente exclusivas em ordem. A escolha é do dono.

---

## Manutenção

Atualizar a tabela da seção 1 quando um ADR novo entrar ou um item aberto fechar. Atualizar a
seção 3 quando a ordem mudar — e dizer por que mudou. Se este documento passar de duas telas,
ele parou de servir para o que foi feito.
