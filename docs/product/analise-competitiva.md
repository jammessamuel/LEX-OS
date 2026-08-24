# LEX OS contra o mercado

**Status:** Análise competitiva para decisão de roadmap
**Data:** 2026-08-24
**Base:** 20 concorrentes em três clusters, cruzados com as 49 rotas em produção
**Idioma:** pt-BR, por ser documento de decisão para a sociedade

Vinte concorrentes examinados, e o que eles revelam sobre onde o LEX OS já é superior, onde
ele ainda não entra na sala, e o que dá para entregar nas próximas semanas.

---

## 1. O achado

O mercado brasileiro se divide em dois, e ninguém ocupa o meio.

> "Nenhum desses sistemas entrega IA jurídica com sigilo profissional brasileiro — quando
> oferecem IA embutida, geralmente é um modelo de nuvem por trás, sem contrato específico
> para o Art. 34 do Estatuto da OAB."
>
> — Levantamento comparativo de software jurídico brasileiro, 2026

De um lado, plataformas de **gestão** que fazem prazo, publicação, financeiro e timesheet
muito bem, e tratam IA como recurso colado depois. Do outro, ferramentas de **inteligência**
que fazem jurisprudência e jurimetria sobre bases públicas, e não tocam no acervo do
escritório.

O LEX OS nasceu no meio: inteligência sobre o material **do próprio escritório**, com
procedência resolvível e sigilo verificável. Essa é a posição que ninguém ocupa — e é também
a razão de o produto ainda não conseguir substituir o sistema que a banca já usa.

### Os três clusters

| Cluster                             | Quantos | Quem                                                                            | O que dominam                                                                                           |
| ----------------------------------- | ------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Gestão do escritório**            | 9       | Astrea, ADVBOX, Projuris, CPJ-3C, SAJ ADV, Legal One, Espaider, Easyjur, Benner | Prazos, publicações, andamentos, financeiro, timesheet. É o sistema em que a banca já vive              |
| **Inteligência sobre base pública** | 6       | Turivius, Jusbrasil Pro, Data Lawyer, Judit, Advise, Digesto                    | Jurisprudência, jurimetria, predição, captura de publicações como serviço. Só o que é público           |
| **Referência internacional**        | 5       | Clio, Smokeball, Filevine, Harvey, CoCounsel                                    | Padrão de acabamento e de IA. Não falam PJe nem DJEN, mas é com eles que um sócio compara a experiência |

---

## 2. De / para

Ordenado pelo que decide uma venda, não pelo que é fácil.

As linhas marcadas com **🔴 obrigatório** são requisitos de mercado no Brasil: sem elas, o
escritório não troca o sistema atual pelo nosso, por melhor que o resto seja.

### 2.1 O que já temos, e o mercado não

| Função                                                                              | Quem faz bem                         | Por que importa                                                                                                                                |
| ----------------------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Procedência de cada dado extraído**<br>arquivo, página, trecho, modelo, confiança | Ninguém, no Brasil                   | Nosso diferencial mais defensável. Nenhum concorrente mostra de onde a IA tirou a informação, e é isso que um sócio exige para assinar embaixo |
| **Busca no acervo do escritório**<br>textual e semântica, com citação               | Cluster 2, mas só sobre base pública | Eles pesquisam jurisprudência; nós pesquisamos os autos do cliente                                                                             |
| **Resposta ancorada em fonte**<br>recusa sem fonte autorizada                       | Harvey e CoCounsel, fora do Brasil   | A recusa é a funcionalidade. Concorrente que responde sempre está inventando às vezes, e no jurídico isso é passivo                            |
| **Cronologia dos fatos**<br>com confirmação humana                                  | Filevine, fora do Brasil             | Data respeitando a precisão registrada, e nada vale antes de um humano confirmar                                                               |
| **Checklist documental**<br>o que falta para protocolar                             | Parcial em Projuris e Legal One      | Veredito conta só a exigência obrigatória em falta. Dor real, poucos fazem                                                                     |
| **Isolamento e auditoria**<br>por escritório, sem conteúdo                          | Enterprise do cluster 1              | Teste negativo de vazamento em cada módulo. Passa em due diligence, não só em apresentação                                                     |
| **Segundo fator e administração de acesso**                                         | Legal One, Espaider                  | TOTP próprio com segredo cifrado, papéis que mostram o que permitem. Acima da média nacional                                                   |
| **Teto de custo de IA por caso**                                                    | Ninguém                              | Nenhum concorrente publica quanto a IA custou em cada processo                                                                                 |

### 2.2 O que falta e trava adoção

| Função                                                    | Situação     | Quem faz bem                    | O que falta, concretamente                                                                                                                                                   |
| --------------------------------------------------------- | ------------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Captura de publicações e intimações**<br>DJEN e diários | 🔴 Não temos | Astrea, Advise, Judit, Projuris | Monitorar nome e OAB, capturar a publicação e vinculá-la ao caso. É a primeira coisa que um escritório abre de manhã. Exige decidir entre DJEN direto ou provedor de recorte |
| **Prazos processuais**<br>dias úteis, suspensões, recesso | 🔴 Parcial   | Todos do cluster 1              | Temos tarefas com vencimento e alerta de atraso. Falta a contagem que importa e a agenda que mostra a semana                                                                 |
| **Número CNJ e vínculo com o processo**                   | 🔴 Não temos | Todos do cluster 1              | O caso tem código interno, área e tipo — não o número do processo. Um advogado percebe isso nos primeiros trinta segundos                                                    |
| **Andamentos automáticos**<br>movimentação dos tribunais  | 🔴 Não temos | Astrea, Advise, Digesto, Judit  | Depende do número CNJ existir primeiro, e usa a mesma integração da captura de publicações                                                                                   |

### 2.3 O que falta e vale considerar

| Função                          | Situação  | Quem faz bem                     | Recomendação                                                                                                                       |
| ------------------------------- | --------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Exportar o dossiê**           | Não temos | Parcial em Filevine              | **Construir.** Nosso diferencial virando algo que se manda por e-mail ao cliente                                                   |
| **Portal do cliente**           | Não temos | Projuris, Legal One, Clio        | **Construir depois.** Aproveita quase tudo que existe, com permissão restrita e sem expor procedência de IA                        |
| **Aplicativo móvel**            | Parcial   | Astrea, ADVBOX, Clio             | A interface é responsiva e passa no Playwright em celular. Falta o que o advogado quer no telefone: prazo do dia e notificação     |
| **Assinatura eletrônica**       | Não temos | Integração comum em todos        | **Integrar.** Barato, esperado, e some da lista de objeções assim que existe                                                       |
| **Modelos de peça e montagem**  | Não temos | Looplex, Smokeball, Clio         | **Decidir.** Coerente com a tese, mas depende de decisão sobre gerar texto jurídico                                                |
| **Timesheet e horas**           | Não temos | ADVBOX, Smokeball, Clio          | **Decidir posicionamento antes de código.** Se somos a plataforma central, precisa; se convivemos com o sistema de gestão, integra |
| **Financeiro**                  | Não temos | ADVBOX, Projuris, CPJ-3C         | **Integrar, não construir.** Maior módulo do cluster 1 e o mais distante da nossa tese                                             |
| **Jurisprudência e jurimetria** | Não temos | Turivius, Jusbrasil, Data Lawyer | **Integrar, nunca competir.** Mercado ocupado por especialistas fortes, e não é onde nosso diferencial vive                        |

---

## 3. Três coisas para entregar agora

Escolhidas por uma regra só: aproveitam o que já está construído e mudam a percepção de quem
abre o produto.

### 1. Número CNJ, tribunal e vara no caso

**Esforço:** 1 a 2 dias · **Risco:** nenhum · **Destrava:** andamentos e publicações depois

Hoje o caso tem código interno e nada mais. Um advogado abre a tela, não vê o número do
processo, e conclui que o sistema não é sério — antes de ver qualquer coisa boa. É campo,
validação do formato CNJ, exibição e busca. Nenhuma integração ainda.

### 2. Agenda de prazos

**Esforço:** 2 a 3 dias · **Risco:** baixo · **Destrava:** o hábito diário de uso

As tarefas já têm data de vencimento, prioridade, origem no checklist e cálculo de atraso.
Falta a tela que um sócio abre às oito da manhã: a semana, o que vence hoje, o que já venceu —
e a contagem no painel. É montagem sobre dado que já existe.

### 3. Exportar o dossiê do caso

**Esforço:** 3 a 5 dias · **Risco:** médio, é geração de documento · **Destrava:** a demonstração comercial

Um documento único com a cronologia confirmada, o checklist e a procedência de cada dado
extraído — arquivo, página, trecho. Transforma nosso diferencial em algo que o cliente recebe
por e-mail, e vende o produto numa reunião sem exigir que ninguém entre no sistema.

---

## 4. A decisão que trava tudo o mais

**Captura de publicações é o que decide adoção**, e não é ajuste: é entrega, e depende de uma
escolha comercial antes da técnica — falar com o DJEN diretamente, ou contratar um provedor de
recorte já pronto.

Enquanto isso não existir, o LEX OS é o **segundo** sistema do escritório: excelente no que
faz, mas convivendo com o Astrea ou o Projuris que continua sendo "o sistema". Com isso, ele
passa a ser o **primeiro** — e toda a nossa vantagem passa a valer em cima de um acervo que
chega sozinho.

---

## 5. Onde já somos superiores

**Procedência resolvível.** Todo dado que a IA identificou aponta para o arquivo, a página e o
trecho de origem, com modelo e confiança. Os outros mostram o resultado e pedem confiança.

**Recusa fundamentada.** Sem fonte autorizada, o sistema diz que não sabe. É a diferença entre
uma ferramenta que um sócio assina embaixo e uma que ele precisa conferir por inteiro.

**Sigilo verificável.** Isolamento por escritório com teste negativo em cada módulo, e auditoria
que registra o que houve sem guardar conteúdo jurídico.

**Custo de IA por processo.** Medição por execução e teto rígido por caso, antes de qualquer
provedor real. Ninguém no mercado nacional publica esse número.

---

## Método e fontes

Levantamento de 20 concorrentes em três clusters, cruzado com as 49 rotas em produção do LEX OS
em 2026-08-24. As situações refletem o que está no ar, não o que está planejado.

- Comparativos brasileiros de software jurídico de 2026, para os clusters 1 e 2:
  [SquadZ](https://asquadz.ai/blog/softwares-gestao-juridica-comparativo/) ·
  [iaLocus](https://ialocus.com.br/blog/post-sistema-advocacia-lgpd-cpj-astrea-projuris-2026.html) ·
  [Seasy](https://seasy.host/2026/04/02/advbox-vs-astrea-vs-projuris-adv-software-juridico-2026/)
- Captura de publicações e intimações:
  [Projuris](https://www.projuris.com.br/blog/monitoramento-de-publicacoes/) ·
  [Advise](https://advise.com.br/)
- Panorama legaltech brasileiro:
  [Inspira](https://www.inspire-se.co/en/recursos/blog/players-legaltech-brasil-2026) ·
  [Turivius](https://turivius.com/)
- Referência internacional:
  [My Legal Academy](https://mylegalacademy.com/kb/case-management-software-comparison-2026) ·
  [AI Vortex](https://www.aivortex.io/legal/guides/clio-duo-vs-harvey/)
- Inventário do LEX OS extraído do contrato OpenAPI publicado em produção.
