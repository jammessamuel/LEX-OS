# Avaliação da recuperação e da resposta fundamentada

**Medida em 2026-09-06 e reexecutada em 2026-09-07**, contra o caso `RT-2026-0008` do ambiente de
demonstração, com o adaptador real de modelo e `CASE_ARCHIVE=fictional`. A segunda execução é a
que traz custo e latência do teto de oito já no ar, e a que encontrou o defeito que subir o teto
causou. Instrumento:
`infra/scripts/avalia-recuperacao.mjs`, versionado ao lado deste documento.

O ADR-016 fixou o teto de cinco trechos e disse, por escrito, o que permitiria reabri-lo:

> O teto pode ser reaberto quando existir uma avaliação versionada com perguntas amplas
> fictícias, medindo cobertura, citações resolvíveis, latência e custo nas alternativas. Até lá,
> permanecer em cinco é decisão, não pendência.

Este documento é essa avaliação. Ele entregou a medida que o ADR nomeou como condição, e o dono
decidiu sobre ela no mesmo dia: o
[ADR-017](../decisions/decisoes.md#adr-017-ampliar-a-recuperação-do-assistente-para-oito-trechos)
levou o teto de cinco para **oito trechos**, que passam a ser teto e padrão. Os números abaixo são
os que sustentaram essa decisão.

## Como está montada

Onze perguntas em duas metades, porque as duas metades falham de formas diferentes:

- **Seis perguntas respondíveis**, cuja resposta está comprovadamente num documento do acervo. O
  documento que a contém está declarado no script, junto da expressão que a reconhece.
- **Cinco perguntas sem resposta no acervo**, onde acertar é recusar. É a metade que quase nunca
  se testa e a que o produto vende: um assistente que responde o que não sabe é pior que nenhum,
  porque o escritório confia na resposta.

O script separa três medidas, e a separação é o ponto. Recuperação e resposta falham parecido e
pedem consertos opostos — se o trecho nunca entrou no contexto, o problema é o teto; se entrou e
a resposta não o usou, o problema é a instrução. Medir só o resultado final confunde as duas.

## O que foi medido

### Recuperação — em que posição aparece o trecho que contém a resposta

| Posição | Pergunta                                     | Onde vive a resposta   |
| ------- | -------------------------------------------- | ---------------------- |
| 1       | Jornada semanal e salário                    | contrato de trabalho   |
| 1       | Data de admissão                             | contrato, TRCT e ficha |
| 3       | Horas extras a 50% no ponto de março         | espelho de ponto       |
| **6**   | **Data de pagamento das verbas rescisórias** | **TRCT**               |
| 3       | Holerite pagou o que o ponto registra?       | holerite × ponto       |
| 1       | Média de horas adotada na rescisão           | TRCT                   |

Cobertura da recuperação por teto: **5/6 em três**, **5/6 em cinco**, **6/6 em oito**.

A data de pagamento — "Pagamento efetuado em 20/05/2026", que está no TRCT e que a extração
identificou — cai na posição 6. **O teto de cinco não a alcança.** Não é falha do modelo: ele
nunca viu o trecho.

### Resposta — cobertura, latência e custo nas alternativas

| Teto  | Cobertura | Custo por resposta     | Latência mediana | Pior caso  |
| ----- | --------- | ---------------------- | ---------------- | ---------- |
| 3     | 3/6       | R$ 0,1190              | 6.612 ms         | 13.433 ms  |
| 5     | 5/6       | R$ 0,1424              | 7.455 ms         | 19.053 ms  |
| 8 \*  | 6/6       | R$ 0,2217 — projetado  | não medida       | não medida |
| **8** | **6/6**   | **R$ 0,1590 — medido** | **9.483 ms**     | 19.386 ms  |

A última linha é de **2026-09-07**, com o teto de oito já no ar. As três primeiras são de
2026-09-06 e ficam onde estão: apagá-las esconderia que a decisão foi tomada sobre uma projeção
errada.

**A projeção errou para mais, em 39%.** Ela escalou o custo total pela razão de crescimento dos
trechos — as posições 6 a 8 acrescentam 56% ao contexto das cinco primeiras, e eu apliquei esses
56% à conta inteira. Os trechos são a parte menor da entrada, porque o prompt da especialidade
domina, então escalar o todo pelo crescimento de uma parte inflou o número. O acréscimo real de
cinco para oito é **R$ 0,0166 por resposta, ou 12%**.

A latência é o que faltava e agora existe: mediana de 9.483 ms para responder, contra 7.455 ms em
cinco, com pior caso de 19.386 ms — acréscimo real de 27%, o preço de olhar mais material.

Recusar é bem mais barato e mais rápido: R$ 0,0951 e 3.541 ms de mediana. Por isso as duas metades
passaram a ser medidas separadas no instrumento — a média sobre todas as perguntas **cai** quanto
mais o assistente recusa, o que faria um teto pior parecer mais econômico.

\* Como se projetou, em 06/09: o contrato então recusava `limit` acima de cinco, e a chamada não
existia. O custo veio do tamanho medido dos trechos nas posições 6 a 8 — em média 716, 690 e 762
caracteres. A cobertura de 6/6 vinha da posição medida, e essa parte era fato: com oito trechos o
TRCT entra, e a execução de 07/09 confirmou que ele entra **e é respondido**.

Há um resultado que merece leitura cuidadosa. Em três trechos a recuperação já entregava 5 de 6
respostas **em mãos**, mas só 3 de 6 respostas **saíram com o dado**. Ou seja: em dois casos o
modelo tinha o trecho e mesmo assim não enunciou o número. Passar de três para cinco não apenas
alcança mais trechos — dá corroboração suficiente para o modelo afirmar o que já estava lá.
Cobertura de recuperação e cobertura de resposta não são a mesma medida, e tratá-las como uma só
teria escondido esse efeito.

### Citações resolvíveis

Sessenta citações conferidas, das seis consultas:

- campos completos (caso, documento, extração, página, deslocamentos, hash): **60/60**
- intervalo bem formado, com fim depois do início: **60/60**
- hash do conteúdo batendo com o texto exibido: **60/60**

Citação presente não é citação resolvível, e a diferença é a que decide se um advogado consegue
voltar ao ponto do documento. Aqui as três conferências passam. É a medida mais tranquila das
quatro, e a única que estava boa antes de ser medida.

## O que a avaliação encontrou de errado

**O padrão eram três trechos, não cinco.** O DTO nascia com `limit = 3` e a tela mandava `limit: 3`
fixo no corpo da requisição — a mesma política escrita em dois lugares, e os dois discordando do
ADR-016, que diz cinco. A economia era de R$ 0,023 por resposta; o custo eram dois dos seis fatos
que o escritório pediu. Corrigido: o padrão passou a cinco e a tela deixou de repetir o número.

**O assistente não conseguia recusar.** Três das cinco perguntas sem resposta voltaram como
`ANSWER` dizendo, no próprio texto, que os trechos não continham a informação — e a tela exibia
isso como resposta fundamentada, com citação ao lado. A causa estava no contrato: `GROUNDED_OUTPUT`
exigia ao menos uma afirmação enquanto a instrução mandava, com todas as letras, devolver lista
vazia sem sustentação. O modelo que obedecesse derrubava a chamada; o que "funcionava" era o que
desobedecia. Corrigido: lista vazia passou a ser recusa, com procedência preservada e custo
debitado, porque o modelo rodou.

**A busca semântica não contribui nada, e nada diz.** Em todas as seis consultas o modo `HYBRID`
devolveu resultado idêntico ao `LEXICAL`, posição por posição; o modo `SEMANTIC` sozinho devolveu
zero resultados em cinco das seis. A causa é aritmética: o embedding determinístico é um saco de
tokens com hash em 16 dimensões, e o filtro da busca exige similaridade de cosseno ≥ 0,65. Medido
sobre trechos com a cara dos documentos do caso, a maior similaridade que uma pergunta alcança é
**0,505** — só texto praticamente idêntico passa do limiar.

Não é dedução: cada resultado carrega `matchedBy`, que diz por qual metade ele foi encontrado.
Nas seis consultas em modo híbrido, **73 dos 74 trechos vieram só do léxico** e um único veio
das duas metades — enquanto a resposta continuava declarando `mode: HYBRID`, que é apenas o eco
do que foi pedido. O dado que denuncia a degradação já existe no contrato; ninguém o mostra. A
tela recebe `matchedBy` em `apps/web/src/api/types.ts` e não o exibe em lugar nenhum.

Isso é consequência do mock, e o mock é a decisão vigente. O defeito não é o valor baixo: é que
o limiar de 0,65 está fixo no SQL como se fosse universal, quando similaridade só significa algo
dentro de um espaço vetorial específico. E é que a interface oferece "híbrida" e entrega lexical
sem que ninguém consiga notar. **Nenhum dos dois foi corrigido aqui** — o primeiro pede que o
limiar passe a ser propriedade do descritor de embedding, o segundo pede que a resposta diga o que
cada metade contribuiu. Ficam registrados.

## O que isto autoriza, e o que não autoriza

Autoriza a decisão sobre o teto a deixar de ser intuição. Os números estão acima, o instrumento
está no repositório e a execução é repetível.

**O teto foi para oito, e por ADR.** A troca foi aceita porque a pergunta que faltava tem resposta
literal no acervo: com teto cinco o sistema guardava o TRCT e não o entregava, e silêncio sobre
documento que existe parece ausência de prova. O registro é o
[ADR-017](../decisions/decisoes.md#adr-017-ampliar-a-recuperação-do-assistente-para-oito-trechos).

Medido em 07/09, custa **R$ 0,1590 por resposta** contra R$ 0,1424 em cinco — 12% a mais, e não os
56% que a projeção anunciava. O erro foi na direção conservadora: aprovou-se a troca achando-a mais
cara do que é.

**Uma coisa a decisão quebrou, e o eval seguinte encontrou.** O bloco compartilhado dos prompts
dizia "cada afirmação cita no máximo cinco trechos, e você recebe no máximo cinco". A segunda
metade deixou de ser verdade com o teto de oito, e o modelo passou a citar mais de cinco numa
afirmação só — que o parser recusa. A pergunta do TRCT devolvia `502` com `limit=8` e respondia com
`limit=5`. Corrigido no mesmo dia, e fica a lição: **subir o teto exige reler o que os prompts
afirmam sobre o tamanho da entrada.**

Também não autoriza tratar 6/6 como meta. Seis perguntas fictícias sobre um caso trabalhista não
representam o acervo de um escritório. O que esta avaliação estabelece é uma régua, não um
veredito sobre o produto.

## Como repetir

```
EVAL_API_URL=...    EVAL_ORG_SLUG=...   EVAL_EMAIL=...
EVAL_PASSWORD=...   EVAL_CASE_ID=...
node infra/scripts/avalia-recuperacao.mjs                # fases gratuitas
node infra/scripts/avalia-recuperacao.mjs --com-modelo   # inclui a fase paga
```

A configuração é toda de ambiente e nenhuma do repositório. As duas primeiras fases não chamam
modelo e não custam nada; a terceira chama, debita o teto do caso e por isso exige a opção
explícita. Ao mudar as perguntas, mude também a data no topo deste documento: um número desta
tabela só é comparável com outro medido sobre a mesma lista.
