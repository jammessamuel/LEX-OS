#!/usr/bin/env node
/**
 * Gera o caderno de revisão jurídica a partir da própria biblioteca de prompts.
 *
 * O advogado revisor não lê TypeScript, e um documento transcrito à mão sai de sincronia na
 * primeira alteração — a revisão passaria a valer para um texto que não é mais o que roda.
 * Este gerador resolve os blocos interpolados e emite exatamente o que vai ao modelo.
 *
 * Um caderno por especialidade, cada um autossuficiente. Os blocos comuns aparecem nos três de
 * propósito: foi lendo o bloco comum com olhos de criminalista que apareceu a "contestação"
 * vazando para o processo penal, peça que não existe lá.
 *
 * Uso: node infra/scripts/gera-revisao-juridica.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('../..', import.meta.url));
const { promptLibrary } = await import(
  new URL('../../packages/ai-prompts/dist/index.js', import.meta.url).href
);

const AREAS = [
  ['TRABALHISTA', 'direito e processo do trabalho'],
  ['CIVEL', 'direito civil e processo civil'],
  ['CRIMINAL', 'direito penal e processo penal'],
];

const TAREFAS = new Map([
  ['CLASSIFICATION', 'Classificar o documento'],
  ['ENTITIES', 'Extrair os dados do documento'],
  ['TIMELINE', 'Montar a cronologia do caso'],
  ['CHECKLIST', 'Conferir as exigências documentais'],
  ['GROUNDED_ANSWER', 'Responder pergunta sobre o caso'],
]);

/** Parágrafos que aparecem em mais de uma especialidade são texto compartilhado. */
function paragrafosCompartilhados() {
  const conta = new Map();
  for (const [area] of AREAS) {
    const vistos = new Set();
    for (const prompt of promptLibrary.filter((p) => p.specialty === area)) {
      for (const paragrafo of prompt.template.split(/\n\n+/u)) {
        vistos.add(paragrafo.trim());
      }
    }
    for (const paragrafo of vistos) {
      conta.set(paragrafo, (conta.get(paragrafo) ?? 0) + 1);
    }
  }
  return new Set([...conta].filter(([, n]) => n > 1).map(([texto]) => texto));
}

/** O contrato de saída em português, porque o revisor lê os dois juntos (ADR-015, decisão 3). */
function contratoLegivel(schema) {
  const campos = schema?.properties?.items?.items ?? schema?.properties?.events?.items ?? schema;
  const props = campos?.properties ?? {};
  const obrigatorios = campos?.required ?? [];
  const linhas = obrigatorios
    .filter((nome) => !['schemaVersion', 'provider', 'modelName', 'promptVersion'].includes(nome))
    .map((nome) => {
      const valores = props[nome]?.enum;
      return valores === undefined
        ? `- \`${nome}\``
        : `- \`${nome}\` — só aceita: ${valores.map((v) => `**${v}**`).join(', ')}`;
    });
  return linhas.length === 0 ? '_Sem campos obrigatórios declarados._' : linhas.join('\n');
}

const compartilhados = paragrafosCompartilhados();
const destino = `${raiz}docs/product/revisao-juridica`;
mkdirSync(destino, { recursive: true });

const ABERTURA = (area, materia, palavras) => `# Revisão jurídica — ${materia}

> **Este documento foi gerado a partir do código em ${new Date().toISOString().slice(0, 10)}.**
> Não o edite: as correções voltam como anotação, e quem altera o texto é quem mexe na
> biblioteca. Regenerar com \`node infra/scripts/gera-revisao-juridica.mjs\`.

## O que é isto

O LEX OS lê os documentos de um processo e propõe cinco coisas: que tipo de documento é cada
arquivo, que dados estão nele, que fatos datados compõem a cronologia, quais exigências
documentais do caso estão atendidas, e o que os documentos respondem a uma pergunta.

Cada uma dessas cinco tarefas é conduzida por uma **instrução** escrita em português, que vai ao
modelo junto com o documento. As cinco instruções de ${materia} estão abaixo, na íntegra e
exatamente como o sistema as usa — **${palavras} palavras**.

Nenhuma delas foi lida por advogado. Foram escritas a partir de pesquisa automatizada e passaram
por três revisões adversariais, também automatizadas, que acharam erros graves — inclusive três
citações legais **fabricadas** numa das faixas. É por isso que este caderno existe: enquanto
ninguém assinar, estas instruções só rodam sobre material fictício, e o sistema recusa usá-las
sobre acervo de cliente.

## O que procurar

Quatro perguntas, parágrafo a parágrafo:

1. **Isto é direito vigente?** Todo número de artigo, súmula ou tema. Uma citação errada aqui
   vira erro repetido em cada documento processado.
2. **Isto descreve o acervo como ele chega?** Não como deveria chegar. Digitalização ruim, PDF
   com trinta documentos dentro, a mesma peça juntada três vezes, print de conversa.
3. **Isto manda concluir onde deveria mandar registrar?** O sistema propõe; quem decide é o
   advogado. Instrução que leva o modelo a emitir juízo é defeito, não estilo.
4. **O que a instrução manda observar cabe na saída?** Cada tarefa vem com o **contrato de
   saída** ao lado. Instrução que manda ver o que a saída não transmite é instrução defeituosa —
   e o conserto é no contrato, não no texto.

## Como anotar

Marque o parágrafo e escreva o que está errado e por quê. Se souber a redação certa, escreva.
Se for caso de faltar alguma coisa, diga qual e onde entraria. Não é preciso propor texto:
apontar o erro basta, e é mais rápido.

Parágrafos marcados **[COMUM]** valem também para as outras especialidades — vale conferir se o
que está dito serve à sua. Foi assim que se descobriu uma peça de processo civil citada no
caderno criminal.

## Como assinar

Ao final há um bloco de encerramento. Preencha nome, número de inscrição na Ordem com a
seccional, e a data. Sem os três, o sistema mantém as instruções como rascunho e continua
recusando usá-las sobre acervo real — a assinatura não é formalidade, é o que destrava.

---

`;

const ENCERRAMENTO = (area) => `

---

## Encerramento

Preencha ao terminar. Enquanto estiver em branco, as cinco instruções de ${area.toLowerCase()}
permanecem marcadas como rascunho.

| Campo | |
| --- | --- |
| Nome completo | |
| Inscrição na Ordem (com seccional) | |
| Data da revisão | |
| Versão revisada | as impressas em cada tarefa acima |

**Parecer** — marque um:

- [ ] **Aprovo** as cinco instruções como estão.
- [ ] **Aprovo com as correções anotadas.** Reviso de novo depois de aplicadas.
- [ ] **Não aprovo.** As anotações explicam o que impede.

Observações:

<br><br><br><br>
`;

for (const [area, materia] of AREAS) {
  const prompts = TAREFAS.keys()
    .map((tarefa) => promptLibrary.find((p) => p.specialty === area && p.task === tarefa))
    .filter((p) => p !== undefined)
    .toArray();

  const palavras = prompts.reduce((s, p) => s + p.template.split(/\s+/u).length, 0);
  const secoes = prompts.map((prompt) => {
    const corpo = prompt.template
      .split(/\n\n+/u)
      .map((paragrafo) => {
        const texto = paragrafo.trim();
        const marca = compartilhados.has(texto) ? '**[COMUM]** ' : '';
        return `${marca}${texto}`;
      })
      .join('\n\n');

    return `## ${TAREFAS.get(prompt.task)}

\`${prompt.version}\` · identificador \`${prompt.identifier}\`

### A instrução

${corpo}

### O que a saída comporta

Esta tarefa só consegue devolver os campos abaixo. Se a instrução acima mandar observar alguma
coisa que não cabe aqui, é a saída que precisa mudar.

${contratoLegivel(prompt.outputSchema)}
`;
  });

  const arquivo = `${destino}/${area.toLowerCase()}.md`;
  writeFileSync(
    arquivo,
    `${ABERTURA(area, materia, palavras.toLocaleString('pt-BR'))}${secoes.join('\n---\n\n')}${ENCERRAMENTO(materia)}`,
    'utf8',
  );
  process.stdout.write(`${arquivo} · ${prompts.length} tarefas · ${palavras} palavras
`);
}
