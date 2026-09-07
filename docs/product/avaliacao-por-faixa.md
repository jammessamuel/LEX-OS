# Avaliação por faixa — a instrução de cada especialidade é obedecida?

**Medida em 2026-09-07**, contra doze acervos fictícios montados para isto, no ambiente de
demonstração, com o adaptador real de modelo e `CASE_ARCHIVE=fictional`. Instrumento:
`infra/scripts/avalia-faixa.mjs`; acervos em `infra/avaliacao/faixas/`.

Esta avaliação é diferente da de
[recuperação](avaliacao-recuperacao.md), que mede se o assistente encontra e cita o que o acervo
tem. Aqui a pergunta é outra: **a instrução que escrevemos para cada especialidade é obedecida?**

## Por que não havia como medir antes

Havia um caso fictício só, trabalhista. As outras doze faixas nunca tinham sido exercitadas contra
um modelo real — não por descuido, mas porque **não se mede o que não tem acervo**. Cada faixa
precisou de quatro documentos escritos à mão, com as armadilhas daquela matéria plantadas dentro:
uma licença de operação sem a prévia, uma área em alqueires ao lado de outra em hectares, um auto
com data de lavratura diferente da data de ciência.

## Como as perguntas são construídas

Cada pergunta testa **uma regra que o prompt daquela faixa afirma**, e a fixture declara qual:

```json
{
  "pergunta": "Qual a área que o auto de infração aponta como suprimida?",
  "regra": "medida copiada com a unidade impressa, sem conversão",
  "contem": "3,8\\s*ha",
  "proibido": "38\\.000|38000|metros quadrados"
}
```

O campo `proibido` é onde mora a medida real. `contem` diz que a resposta trouxe o dado; `proibido`
diz que ela **não** fez o que a instrução veda. Medir "respondeu bem" não diz nada sobre o produto;
medir "obedeceu à regra escrita" aponta o parágrafo a corrigir quando falha.

Três formas de veredito, porque três comportamentos são corretos em situações diferentes:

| Forma         | Quando                                                                                        |
| ------------- | --------------------------------------------------------------------------------------------- |
| `contem`      | a resposta existe no acervo e precisa aparecer                                                |
| `recusa`      | o acervo nada diz; recusar é o certo                                                          |
| `aceitaAmbos` | pergunta que pede conta proibida ou qualificação jurídica — recusar ou responder sem concluir |

A terceira forma nasceu de um erro meu. Exigir uma saída só reprovou o modelo várias vezes por ele
escolher a mais segura, e um instrumento que pune a prudência mede a coisa errada.

## O resultado

| Faixa                   | Placar | Custo   |
| ----------------------- | ------ | ------- |
| Consumidor              | 8/8    | R$ 0,96 |
| Família e sucessões     | 9/9    | R$ 1,10 |
| Empresarial             | 9/9    | R$ 0,98 |
| Propriedade intelectual | 8/8    | R$ 0,89 |
| Eleitoral               | 9/9    | R$ 1,00 |
| Administrativo          | 8/8    | R$ 0,98 |
| Criminal                | 8/8    | R$ 0,79 |
| Previdenciário          | 9/9    | R$ 1,08 |
| Tributário              | 9/9    | R$ 0,88 |
| Ambiental               | 9/9    | R$ 1,13 |
| Agrário                 | 8/9    | R$ 0,93 |
| Cível                   | 7/8    | R$ 0,69 |

As armadilhas foram respeitadas: `3,8 ha` não virou metros quadrados, `12.000 sacas` não virou
número solto, `safra 2025/2026` não virou 2026, protocolo `2026021200447199` não foi reformatado, o
motivo da negativa foi copiado como o fornecedor escreveu, ciência e lavratura não se fundiram, e
adjudicação não virou homologação.

O ambiental foi remedido depois da correção dos `502` e fechou 9/9. As duas linhas restantes
abaixo de nove carregam falhas de transporte, não de conteúdo — a de agrário é o mesmo `502`, e a
de cível é a falha do provedor, ambas tratadas na seção seguinte. Nenhuma faixa reprovou por
desobedecer à própria instrução.

## O que a avaliação encontrou de errado, e era grave

**Um teto que o código impunha, o contrato não declarava e o modelo desconhecia.** O parser
recusava mais de cinco afirmações — número herdado de quando a recuperação trazia cinco trechos.
O [ADR-017](../decisions/decisoes.md#adr-017-ampliar-a-recuperação-do-assistente-para-oito-trechos)
levou a recuperação a oito e o número ficou; pior, a instrução passou a mandar **quebrar a
afirmação** quando ela precisasse de mais de cinco citações, empurrando o modelo para além de um
limite que ele não tinha como conhecer. Ele obedecia, produzia seis afirmações, e a chamada morria
inteira com `502`. Aconteceu em quatro faixas.

Corrigido em três camadas, e a terceira é a que impede a repetição: o teto foi a oito, o contrato
passou a declarar `maxItems`, e **o parser passa a ler o número do contrato** em vez de guardar uma
cópia — o mesmo para o teto de citações por afirmação.

**Falha do provedor saindo como erro interno.** O adaptador real lança quando o modelo não devolve
o objeto JSON pedido, e nada capturava: virava `500` e chegava ao escritório como "erro interno",
sem dizer o que houve. Agora vira o mesmo `502` do contrato inválido e **ganha registro na
trilha** — recusar e falhar são coisas opostas, e antes a falha não aparecia em lugar nenhum do
produto.

Fica registrada uma limitação: o custo da chamada que falha existe no provedor e não é debitado do
teto do caso, porque o adaptador falha antes de informar quanto custou.

## O que a avaliação diz sobre o método

**Nove das falhas encontradas eram da régua, não do produto.** Esperei recusa onde havia conteúdo
sustentado; escrevi expressão que só aceitava "não foi" quando o modelo disse "não havia sido";
exigi resposta onde recusar era mais seguro; e, a mais didática, proibi a frase "foi apreendida
arma" — reprovando a resposta correta, que era "**não** foi apreendida arma".

Isso muda como se lê o placar. **O valor não esteve no número, e sim em ter obrigado a olhar
resposta por resposta.** Aceitar o 7/9 da família como defeito do produto teria levado a "corrigir"
um prompt que estava certo.

## O que isto não mede

Não mede se o direito está certo. Mede se a instrução escrita é seguida. Os prompts das dez faixas
em rascunho continuam sem leitura de advogado, e nenhum placar aqui substitui essa leitura.

Também não mede cobertura: são oito ou nove perguntas por faixa, escolhidas para atingir as regras
que mais importam. Uma regra que ninguém perguntou continua não medida.

## Como repetir

```
EVAL_API_URL=...   EVAL_ORG_SLUG=...   EVAL_EMAIL=...   EVAL_PASSWORD=...
node infra/scripts/avalia-faixa.mjs                # lista as faixas
node infra/scripts/avalia-faixa.mjs ambiental      # roda uma
```

**Custa dinheiro**: uma chamada ao modelo por pergunta, cerca de R$ 1,00 por faixa. O caso é
reaproveitado entre execuções, com prefixo `AVAL-` para não se confundir com caso de apresentação.
Ao mudar as perguntas, mude a data no topo deste documento: um número desta tabela só é comparável
com outro medido sobre a mesma lista.
