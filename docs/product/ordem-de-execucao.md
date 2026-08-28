# Ordem de execução — estado por ADR e o que vem a seguir

**Data:** 2026-08-28
**Para que serve:** não se perder. Dezesseis ADRs decidiram coisas ao longo de meses; algumas
viraram código, outras esperam, e algumas esperam sem que ninguém lembre por quê. Este
documento diz, de cada uma, o que está de pé — e monta **uma** ordem de execução que atravessa
todas.

Estado verificado no código em 2026-08-28, não deduzido dos ADRs.

---

## 1. Onde estamos, ADR por ADR

| ADR     | Decisão                        | Construído                                                            | Aberto                                                                           |
| ------- | ------------------------------ | --------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **001** | Monólito modular, 2 raízes     | ✅ `apps/api` e `apps/worker`, fronteiras respeitadas                 | —                                                                                |
| **002** | PostgreSQL + Prisma            | ✅ PG 18, Prisma 7.9.1 com `adapter-pg`, 19 migrações                 | —                                                                                |
| **003** | Armazenamento de objetos       | ✅ Adaptador S3/MinIO, URL assinada, worker só escreve                | —                                                                                |
| **004** | Multi-tenancy por organização  | ✅ `organization_id` em toda leitura e escrita, testes negativos      | —                                                                                |
| **005** | pgvector                       | ✅ Busca híbrida, embeddings versionados                              | —                                                                                |
| **006** | IA agnóstica de provedor       | ✅ Portas + mocks fail-closed · ✅ Adaptador real atrás da porta      | Contrato padrão proíbe treino; aceite empresarial e demais portões do 012 pendem |
| **007** | Trabalho em segundo plano      | ✅ BullMQ, `processing_job`, nada pesado em handler HTTP              | —                                                                                |
| **008** | Nomenclatura técnica em inglês | ✅ Código, rotas e colunas                                            | —                                                                                |
| **009** | Assistente fundamentado        | ✅ Recusa sem fonte autorizada, citação obrigatória                   | — Teto de 5 fontes mantido deliberadamente pelo ADR-016                          |
| **010** | Canais de entrada              | ✅ Upload                                                             | Superado pelo ADR-016; e-mail passou a conector futuro                           |
| **011** | Modelo de custo                | ✅ Cotação, teto por caso, agregação por organização, termos escritos | —                                                                                |
| **012** | Retenção, legal hold, LGPD     | ✅ Sem purga · ✅ Legal hold · ✅ Suboperadores                       | Transferência, região única e responsável nomeado                                |
| **013** | Notificações internas          | ✅ Caixa de saída + despachante (Entrega 13) · ✅ Os três gatilhos    | —                                                                                |
| **014** | Identidade e acesso            | ✅ Itens 1, 2 (Entrega 13) e 3 — TOTP (Entrega 14). Item 8 sem código | Itens 4–7 adiados **por decisão**, não por esquecimento                          |
| **015** | Biblioteca de prompts          | ✅ Itens 1, 3, 4, 5, 6, 7 · ✅ Item 2 (mecanismo)                     | 15 dos 20 prompts seguem `DRAFT` — falta quem assina                             |
| **016** | Encerramento seguro do MVP     | ✅ Escopo fechado · ✅ senha fora do `localStorage`                   | Condições externas permanecem falhando fechado                                   |

**Leitura rápida:** a fila de engenharia do MVP fechou. O que sobra não é código disfarçado:
aceite empresarial e transferência internacional (012), decisão sobre região única (012),
responsável por titulares (012) e assinatura profissional dos prompts (015). Conectores futuros
exigem novo incremento.

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
inteiro. Agora a condição é `CASE_ARCHIVE`, com vocabulário explícito — `fictional` ou `real` — e
**sem padrão**. Como os portões externos continuam abertos, a versão atual vai além: o carregador
recusa `real` em qualquer ambiente antes de abrir API ou worker. A guarda independente do pacote
de prompts continua testada para a futura liberação.

Ganhou alcance junto com o A0: antes a guarda cobria uma das cinco tarefas, agora cobre as cinco.

**Antes do próximo deploy:** `CASE_ARCHIVE=fictional` precisa existir nos serviços `api` e
`worker` da Railway, e no seu `.env` local. Sem ela o processo falha na partida — de propósito.

**A2. Faixa cível ao nível das outras duas** — Entrega 16 · **FEITO 2026-08-26**
Família e sucessões inteiras ausentes: sete dos trinta tipos levantados, zero documentos no
prompt. Endereço não é entidade. Número CNJ não é extraído — e a Entrega 15 se chama "o caso
carrega o número do processo". Mais quatorze achados da lente de prática.
Dezessete achados aplicados. A faixa deixou de ser a menor: classificação foi de 904 para
1.379 palavras, entidades de 1.077 para 1.739, checklist de 1.169 para 1.838 — o maior das três.
Família, sucessões e saúde suplementar ganharam exigência documental própria; endereço, número
CNJ, veículo por chassi, cartório da matrícula e as colunas do extrato de birô entraram na
extração; disponibilização × publicação, certidão de fato negativo, óbito e a armadilha do índice
de juntadas entraram na cronologia. E saiu do bloco comum a exceção da verdade, que é peça
criminal e ocupava a linha das inversões cíveis que aparecem toda semana.

**A3. `REVIEWED` com nome, OAB e data** — ADR-015 item 2 · **MECANISMO FEITO 2026-08-26**
Quinze dos vinte estão `DRAFT`; os cinco genéricos permanecem `REVIEWED` somente para descrever
o comportamento determinístico do mock. Sem essa separação, promover seria trocar uma palavra.
O registro existe e a guarda o usa. Toda atestação carrega quem assinou, em que qualidade —
advogado ou dono —, com qual inscrição, em que data e **contra qual versão do texto**. Esse
último campo é o que mais trabalha: alterar um prompt sobe a versão, a atestação deixa de casar,
e o prompt volta sozinho a precisar de revisão. Uma assinatura não cobre um texto reescrito
depois dela.

Os cinco genéricos ficaram registrados pelo que são: aprovados pelo dono por descreverem o
comportamento do mock, com `oab: null` e a situação declarada — o registro não finge inscrição
que não existe. As quinze de especialidade continuam `DRAFT` porque falta o nome de quem assina.

**A4. Contrato de entrada do checklist** — ADR-015 item 3 · **FEITO 2026-08-26**
A entrada é `{ documentTypeCode, items: [{ id, documentTypeCode }] }`. Não vai o enunciado da
exigência nem o texto do documento: o prompt não tem como saber que o item 3 pede "matrícula
atualizada", e o que sobra é comparar duas strings — o que o mock já faz sem modelo.
Ao abrir o contrato apareceu que a fome era das **quatro** tarefas que leem documento, não só do
checklist: classificação e entidades não recebiam argumento nenhum. As quatro passam a receber o
texto com aviso de truncamento; o checklist recebe o enunciado de cada exigência; a classificação
recebe o catálogo que mandava respeitar. Com isso os quatro P0 estão fechados.

### Fila B — os portões do provedor real

Os controles técnicos e os registros internos foram fechados. O adaptador pode ser exercitado
com acervo fictício; acervo real continua bloqueado pelas condições externas do ADR-012.

**B1. Lista de suboperadores versionada** — ADR-012 · **REVISADA 2026-08-28**
[`docs/legal/suboperadores.md`](../legal/suboperadores.md). Os dois efetivamente ligados são
Railway e Anthropic, ambos apenas sobre acervo fictício. A Vercel saiu da lista ativa por não haver
deployment comprovado. Railway roda o projeto em Amsterdam; os contratos padrão ainda declaram
operações, armazenamento ou backups em outras regiões.

**B2. Termos de tratamento registrados** — ADR-011, verificação 4 · **FEITO 2026-08-27**
[`docs/legal/termos-de-tratamento.md`](../legal/termos-de-tratamento.md). Não é o contrato: é o
registro técnico do que o sistema faz, para quem redigir o contrato saber o que está descrevendo.
Ele registra a localização real e separa duas exigências que antes estavam misturadas: a
transferência precisa de base legal e mecanismo da ANPD, e a regra interna de região única exige
compromisso adicional dos fornecedores ou novo ADR. Também não há responsável nomeado pelo
atendimento a titular.
**B3. Agregação de custo por organização, provedor e modelo** — ADR-011, v. 3 · **FEITO 2026-08-27**
`GET /processing-costs` soma somente execuções concluídas da organização no período e abre o
resultado por provedor, modelo, tipo de job ou caso, sempre dentro do tenant.
**B4. Custo do assistente debitando o orçamento do caso** — ADR-011 · **FEITO 2026-08-27**
Cada resposta concluída debita o valor exato no caso. Ao alcançar o teto, o caso entra em
`LIMIT_REACHED` e a pergunta seguinte é recusada antes de novo gasto; a transição é auditada.
**B5. Legal hold** — ADR-012 · **FEITO 2026-08-27**

A marca vive no caso, e a guarda que de fato impede está no **filtro do repositório**, não no
serviço: retenção tem de valer para todo chamador, inclusive um futuro caminho administrativo ou
de reconciliação, e condição no filtro não se esquece de chamar. Alcança caso, documento e pessoa
que participe de caso retido.

O estado indeterminado que o ADR-012 manda recusar foi tornado **impossível de existir**: uma
restrição de banco obriga data, autor e motivo a entrarem e saírem juntos. A consulta de hold
falha fechada — caso que não pôde ser lido conta como retido.

Na tela, o botão de excluir continua à vista, desabilitado, com o motivo na dica. Sumir com
ele não explicaria nada a quem procura por que não consegue excluir.

Migração aplicada e validada localmente e na Railway em 2026-08-28; a suíte de integração cobre a
restrição de banco e os caminhos de exclusão.

**Ordem interna:** B1 e B2 são documento, não código, e destravam a conversa comercial — vêm
primeiro. B3 e B4 são o mesmo trabalho de agregação. B5 é o maior e o mais tarde, mas nada do
provedor real sai sem ele.

### Fila C — o que promete aviso e não avisa

**C1. Os três gatilhos do ADR-013** — **FECHADO 2026-08-27**
A caixa de saída e o despachante existiam desde a Entrega 13 e nada disparava. Agora disparam a
**falha terminal de documento** e a **tarefa atribuída**, com conteúdo mínimo: código interno do
caso, o que aconteceu em linguagem de gente, e um link. Não viaja título de documento, teor
extraído, nome de parte, mensagem técnica do erro nem título de tarefa — este último ficou de
fora por decisão desta rodada, porque em caso jurídico costuma descrever a peça que falta.

A falha avisa só na tentativa terminal, e não consulta preferência nenhuma: o opt-out é por
gatilho e a falha não está na lista. A coluna guarda o que foi **desligado**, não o que foi
ligado, para conta nova nascer recebendo. Tarefa atribuída a si mesmo não avisa. Os dois avisos
são enfileirados fora da transação do fato.

**O terceiro gatilho** — resumo diário de preparo concluído · **FEITO 2026-08-27**
Varredura periódica no worker, e não gancho no fim da esteira: vinte documentos terminando junto
renderiam vinte e-mails, e a decisão manda agrupar.

A marca de água é a própria caixa de saída — o `createdAt` do último resumo de cada pessoa.
Nenhuma tabela de estado nova: a linha que prova o envio é a mesma que diz até onde já se
contou, então reiniciar o worker não reenvia nem pula período. Conclusão que já entrou num
resumo não entra no seguinte.

Concluir `EMBEDDING` é o que define preparo concluído: é a última etapa da esteira, a que leva o
documento a `NEEDS_REVIEW`. O aviso se desliga, ao contrário da falha. Sete dias de piso para
quem nunca recebeu, para instalação parada não mandar o mês inteiro; e a varredura é represada
em uma hora, porque o laço do worker bate a cada cinco segundos e `finished_at` não é indexado.

**C2. Canal de entrada por e-mail — ENCERRADO POR DECISÃO EM 2026-08-28.**

O ADR-016 supera somente esta parte do ADR-010: upload permanece a entrada do MVP e e-mail vira
conector futuro. Não construir uma porta não autenticada sem demanda, provedor de caixa e modelo
de associação a tenant é a decisão; não é item esquecido.

### Fila D — adiados por decisão, não esquecidos

Não fazer nada aqui é a decisão correta até a condição mudar. Registrado para ninguém
"descobrir a pendência" daqui a três meses e refazer a discussão.

| Item                           | ADR    | Condição para reabrir             |
| ------------------------------ | ------ | --------------------------------- |
| Entrada federada por OIDC      | 014, 4 | Primeira banca com IdP no funil   |
| Autocadastro de escritório     | 014, 5 | Teste gratuito ou autoatendimento |
| Troca de nome curto            | 014, 6 | Sem custo em esperar              |
| Pessoa em dois escritórios     | 014, 7 | Demanda real de cliente           |
| Conectores de e-mail/WhatsApp  | 016    | Novo incremento e demanda real    |
| Teto de recuperação acima de 5 | 016    | Avaliação de qualidade/custo      |

### Fila E — dívida fora de ADR

**E1. Senha guardada em `localStorage` — FECHADO 2026-08-28.** O ADR-016 retirou a opção. A
preferência guarda somente campos de conveniência e saneia registros legados na primeira leitura.

**E2. Integração sem Docker local — FECHADO 2026-08-28.** Docker está disponível nesta máquina;
os gates de integração voltam a ser obrigatórios também localmente.

---

## 4. O que decide a próxima sessão

As três perguntas que esta seção fazia foram todas respondidas. A Fila A fechou em 26/08, a
Fila B foi conferida novamente em 28/08, e o C1 fechou em 27/08. **A fila de código está vazia** — e isso não é figura de
linguagem: não sobrou item nesta lista que uma sessão consiga executar sozinha.

O que resta exige ato externo verificável; autorização genérica de engenharia não o substitui:

| O que falta                                                                        | ADR      | Quem decide          | O que destrava                        |
| ---------------------------------------------------------------------------------- | -------- | -------------------- | ------------------------------------- |
| Aceite dos termos/DPA em organização da SAMUEL DEV LTDA e configuração de retenção | 012      | Sociedade, comercial | Evidência contratual do provedor      |
| Cláusulas-padrão da ANPD e decisão sobre a incompatibilidade com região única      | 012      | Sociedade, jurídico  | Qualquer acervo de cliente brasileiro |
| Responsável e canal público nomeados para atendimento a titular                    | 012      | Sociedade            | Procedimento de titular completo      |
| Assinatura das 15 versões por advogado com OAB ativa                               | 015, i.2 | Advogado             | A biblioteca deixar de ser rascunho   |

O pacote de execução e as minutas estão em
[`docs/legal/pacote-liberacao-acervo-real.md`](../legal/pacote-liberacao-acervo-real.md).
`CASE_ARCHIVE=fictional` continua obrigatório em API e worker, local e Railway. A configuração é
uma trava operacional, não autorização para inserir acervo real.

**A ordem mudou porque a lista acabou.** Enquanto nenhuma dessas decisões cair, o que sobra para
uma sessão é manutenção de documento e dívida que ninguém levantou ainda. Vale mais dizer isso do
que inventar fila.

---

## Manutenção

Atualizar a tabela da seção 1 quando um ADR novo entrar ou um item aberto fechar. Atualizar a
seção 3 quando a ordem mudar — e dizer por que mudou. Se este documento passar de duas telas,
ele parou de servir para o que foi feito.
