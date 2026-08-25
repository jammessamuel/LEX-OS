# Biblioteca de prompts

**Status:** Implementada na Entrega 16
**Última atualização:** 2026-08-25

Os prompts vivem em `packages/ai-prompts/src/prompts/`, um arquivo por especialidade mais o
genérico. `promptFor(task, legalArea)` escolhe: resolve o apelido da área pelo catálogo de
`packages/shared/src/legal-specialties.ts`, procura o prompt da especialidade, e cai no
genérico — área não catalogada funciona, só sem especialização.

## Estrutura

- `separacao.ts` — a cláusula que separa instrução de conteúdo (ADR-006). Obrigatória em todo
  prompt; um teste falha se faltar.
- `acervo.ts` — blocos comuns a qualquer acervo judicial: imperativo de decisão, natureza das
  peças, prints, carimbo do PJe, imagem ruim.
- `contratos.ts` — schemas de entrada e saída por tarefa. Um só por tarefa, para toda área: o
  validador do worker é um só, e schemas por área não teriam onde divergir visivelmente.
  `apps/worker/test/prompt-schema-drift.spec.cjs` compara schema e validador nos dois sentidos.
- `generico.ts` / `generico-extracao.ts` — os cinco genéricos, `REVIEWED` por decisão do dono
  (2026-08-25): descrevem o comportamento determinístico do mock, sem modelo por trás.
- `trabalhista.ts`, `civel.ts`, `criminal.ts` — os de especialidade, todos `DRAFT`.

## Estados e promoção

`DRAFT` sai de pesquisa automatizada e **não roda em produção**: `promptFor` lança
`UnreviewedPromptError`, no mesmo padrão fail-closed dos provedores mock. Promover a `REVIEWED`
é editar o campo depois de revisão por profissional habilitado — e registrar quem e quando no
commit. Mudar o _texto_ de um prompt já usado exige **versão nova** (a procedência gravada
aponta para a versão que governou cada execução).

## Qualidade por área — leia antes de confiar

| Área        | Pesquisa        | Revisão adversarial                                                     |
| ----------- | --------------- | ----------------------------------------------------------------------- |
| Trabalhista | 30/30 tipos     | **6 lentes**; achou 3 citações fabricadas e 2 teses erradas, corrigidas |
| Cível       | 30/30 tipos     | **nenhuma** — cortada por economia                                      |
| Criminal    | **15/30 tipos** | **nenhuma** — workflow interrompido                                     |

A pesquisa bruta está em `docs/product/pesquisa-prompts/` (grande; não abrir por padrão — as
conclusões já estão nos prompts). Nenhum prompt cita número de súmula ou tema: a revisão
trabalhista mostrou que número fabricado é o erro mais provável e mais caro.

## Limites conhecidos do contrato de saída

Registrados na pesquisa trabalhista e deliberadamente não resolvidos aqui: status `ILLEGIBLE`
(validador aceita só dois dos oito do banco), cobertura de período no checklist, recusa de
cronologia vazia, e teto de três citações por afirmação. Mudar o contrato é outra entrega.
