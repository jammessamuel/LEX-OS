# Minuta — atestado de revisão jurídica dos prompts especializados

**MINUTA NÃO VIGENTE.** O preenchimento exige advogado com inscrição ativa. A assinatura cobre
somente as versões listadas; qualquer versão posterior volta a ser `DRAFT`.

## 1. Revisor

| Campo                                  | Preenchimento |
| -------------------------------------- | ------------- |
| Nome completo como consta na inscrição |               |
| OAB e seccional                        |               |
| Situação ativa conferida em            |               |
| Fonte/registro da conferência          |               |
| Data da revisão                        |               |
| Contato profissional                   |               |

## 2. Artefatos cobertos

| Especialidade | Tarefa            | Identificador                        | Versão                           | Aprovado/ressalva |
| ------------- | ----------------- | ------------------------------------ | -------------------------------- | ----------------- |
| Trabalhista   | Cronologia        | `lex-os.timeline.trabalhista`        | `timeline-trabalhista-v1`        |                   |
| Trabalhista   | Checklist         | `lex-os.checklist.trabalhista`       | `checklist-trabalhista-v1`       |                   |
| Trabalhista   | Resposta ancorada | `lex-os.grounded-answer.trabalhista` | `grounded-answer-trabalhista-v1` |                   |
| Trabalhista   | Classificação     | `lex-os.classification.trabalhista`  | `classification-trabalhista-v1`  |                   |
| Trabalhista   | Entidades         | `lex-os.entities.trabalhista`        | `entities-trabalhista-v1`        |                   |
| Cível         | Cronologia        | `lex-os.timeline.civel`              | `timeline-civel-v1`              |                   |
| Cível         | Checklist         | `lex-os.checklist.civel`             | `checklist-civel-v1`             |                   |
| Cível         | Resposta ancorada | `lex-os.grounded-answer.civel`       | `grounded-answer-civel-v1`       |                   |
| Cível         | Classificação     | `lex-os.classification.civel`        | `classification-civel-v1`        |                   |
| Cível         | Entidades         | `lex-os.entities.civel`              | `entities-civel-v1`              |                   |
| Criminal      | Cronologia        | `lex-os.timeline.criminal`           | `timeline-criminal-v1`           |                   |
| Criminal      | Checklist         | `lex-os.checklist.criminal`          | `checklist-criminal-v1`          |                   |
| Criminal      | Resposta ancorada | `lex-os.grounded-answer.criminal`    | `grounded-answer-criminal-v1`    |                   |
| Criminal      | Classificação     | `lex-os.classification.criminal`     | `classification-criminal-v1`     |                   |
| Criminal      | Entidades         | `lex-os.entities.criminal`           | `entities-criminal-v1`           |                   |

## 3. Escopo da atestação

Declaro ter lido o texto de cada prompt, seu contrato de entrada e saída, exemplos, critérios de
validação, caderno de pesquisa e achados adversariais. A revisão verificou, no mínimo:

- distinção entre alegação, prova, decisão e dado confirmado;
- legislação, súmulas, temas e marcos temporais citados;
- terminologia e fluxo de trabalho da especialidade;
- tratamento de datas, valores, polos e documentos homônimos;
- recusa de parecer, previsão de resultado e afirmação sem fonte;
- suficiência do contrato de saída para expressar o que o prompt manda observar;
- ressalvas e incertezas que exigem revisão humana.

Ressalvas por identificador/versão:

`[preencher; escrever “nenhuma” somente após conferir todos os itens]`

## 4. Declaração

Atesto que os itens marcados “aprovado” podem ser promovidos de `DRAFT` para `REVIEWED` apenas
nas versões indicadas, sem substituir a análise humana do caso, sem autorizar resposta sem fonte
e sem autorizar provedor ou acervo que ainda esteja bloqueado pelos ADR-011 e ADR-012.

Nome: ______________________________________

OAB/UF: ___________________________________

Assinatura: ________________________________ Data: ****/****/________

Referência verificável da assinatura eletrônica: __________________________

## 5. Registro técnico posterior

- [ ] situação da OAB conferida;
- [ ] versão de cada prompt confere com esta tabela;
- [ ] ressalvas foram incorporadas em novas versões e, se houve mudança, revisadas novamente;
- [ ] `reviewStatus`, nome, OAB, data e `reviewedVersion` foram atualizados em mudança separada;
- [ ] testes de recusa sobre acervo real continuam verdes;
- [ ] o documento assinado ficou no arquivo jurídico, não no Git.
