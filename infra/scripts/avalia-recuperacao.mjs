#!/usr/bin/env node
/**
 * Avaliação versionada da recuperação e da resposta fundamentada.
 *
 * O ADR-016 fixou o teto de cinco trechos e disse por escrito o que permitiria reabri-lo: uma
 * avaliação versionada, com perguntas amplas fictícias, medindo cobertura, citações resolvíveis,
 * latência e custo nas alternativas. Este é esse instrumento. Vive no repositório, e não num
 * arquivo temporário, porque medida que ninguém consegue repetir não sustenta decisão nenhuma —
 * quem quiser mexer no teto depois precisa poder comparar contra a mesma régua.
 *
 * O que ele mede, nesta ordem:
 *
 *   1. RECUPERAÇÃO (gratuita) — em que posição do ranking aparece o trecho que contém a resposta.
 *      Separa "o modelo não soube responder" de "o modelo nunca viu a resposta", que pedem
 *      consertos opostos: um é instrução, o outro é teto.
 *   2. CITAÇÕES (gratuita) — se a citação permite reencontrar o texto. Confere campos, intervalo
 *      e o hash do conteúdo contra o trecho exibido. Citação presente não é citação resolvível.
 *   3. RESPOSTA (paga, exige --com-modelo) — cobertura, recusa, latência e custo por resposta.
 *
 * As perguntas são fictícias e o caso é o da demonstração. Nenhum acervo real passa por aqui.
 *
 * Uso:
 *   node infra/scripts/avalia-recuperacao.mjs                 # só as fases gratuitas
 *   node infra/scripts/avalia-recuperacao.mjs --com-modelo    # inclui a fase paga
 *
 * Configuração, toda por ambiente e nenhuma no repositório:
 *   EVAL_API_URL   EVAL_ORG_SLUG   EVAL_EMAIL   EVAL_PASSWORD   EVAL_CASE_ID
 */

import { createHash } from 'node:crypto';

// A saída vai por `process.stdout`, como nos outros scripts de `infra/`: este arquivo roda
// fora de um app e não tem logger, e `console` é proibido pelo lint justamente para que
// ninguém escreva log de produção por engano.
function linha(texto = '') {
  process.stdout.write(`${texto}
`);
}

function exigido(nome) {
  const valor = process.env[nome];
  if (valor === undefined || valor.trim() === '') {
    throw new Error(`Defina ${nome} no ambiente antes de rodar a avaliação.`);
  }
  return valor.trim();
}

const API = exigido('EVAL_API_URL').replace(/\/+$/u, '');
const CASO = exigido('EVAL_CASE_ID');
const comModelo = process.argv.includes('--com-modelo');

/**
 * Perguntas cuja resposta está comprovadamente no acervo.
 *
 * Cada uma declara onde a resposta vive. Sem isso o número que sai daqui é incomparável entre
 * execuções: quem reler daqui a seis meses não sabe se a queda foi do produto ou de alguém que
 * trocou a pergunta.
 */
const RESPONDIVEIS = [
  {
    pergunta: 'Qual a jornada contratual semanal e o salário previstos no contrato de trabalho?',
    achado: /44\s*h|quarenta e quatro/iu,
    onde: 'contrato de trabalho',
  },
  {
    pergunta: 'Em que data ocorreu a admissão do empregado?',
    achado: /03\/02\/2020/u,
    onde: 'contrato, TRCT e ficha de registro',
  },
  {
    pergunta: 'Quantas horas extras a 50% o cartão de ponto de março de 2026 registra?',
    achado: /51[:h]?35/iu,
    onde: 'espelho de ponto',
  },
  {
    pergunta: 'Qual a data de pagamento das verbas rescisórias e qual valor consta como pago?',
    achado: /20\/05\/2026/u,
    onde: 'TRCT',
  },
  {
    pergunta:
      'O holerite de março pagou a mesma quantidade de horas extras que o cartão de ponto registra?',
    achado: /51[:h]?35|12[:h]?00/iu,
    onde: 'holerite confrontado com o ponto',
  },
  {
    pergunta: 'Que média de horas o termo de rescisão adotou para calcular as verbas?',
    achado: /11[:h,.]?00|média de 11|11 horas/iu,
    onde: 'TRCT',
  },
];

/**
 * Perguntas sem resposta no acervo. Aqui acertar é recusar.
 *
 * É a metade que quase nunca se testa e a que o produto vende: um assistente que responde o que
 * não sabe é pior que nenhum, porque o escritório confia na resposta.
 */
const SEM_RESPOSTA = [
  { pergunta: 'Qual o valor da causa atribuído na petição inicial?', onde: 'não há petição' },
  { pergunta: 'Qual a data da audiência inicial designada pela vara?', onde: 'não há designação' },
  {
    pergunta: 'Quantos dependentes o reclamante declarou para fins de imposto de renda?',
    onde: 'dado plausível e ausente — testa a tentação de completar',
  },
  {
    pergunta: 'Quantas horas extras o cartão de ponto de abril de 2026 registra?',
    onde: 'só existe o ponto de março; responder com março seria trocar o período',
  },
  {
    pergunta: 'O empregado teve alguma advertência disciplinar registrada?',
    onde: 'ausência não prova fato negativo',
  },
];

let token = '';

async function call(metodo, caminho, corpo) {
  const inicio = Date.now();
  let ultimoErro;
  for (let tentativa = 0; tentativa < 4; tentativa += 1) {
    try {
      const resposta = await fetch(API + caminho, {
        method: metodo,
        headers: {
          'content-type': 'application/json',
          ...(token === '' ? {} : { authorization: `Bearer ${token}` }),
        },
        ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
      });
      const texto = await resposta.text();
      return {
        status: resposta.status,
        body: texto === '' ? null : JSON.parse(texto),
        ms: Date.now() - inicio,
      };
    } catch (erro) {
      ultimoErro = erro;
      await new Promise((resolver) => setTimeout(resolver, 2500));
    }
  }
  throw ultimoErro;
}

async function autenticar() {
  const resposta = await call('POST', '/auth/login', {
    organizationSlug: exigido('EVAL_ORG_SLUG'),
    email: exigido('EVAL_EMAIL'),
    password: exigido('EVAL_PASSWORD'),
  });
  if (resposta.status !== 200 || typeof resposta.body?.accessToken !== 'string') {
    // A credencial nunca entra na mensagem: só o que aconteceu.
    throw new Error(`Autenticação recusada com HTTP ${resposta.status}.`);
  }
  token = resposta.body.accessToken;
}

async function faseRecuperacao() {
  linha('\n=== 1. RECUPERAÇÃO — posição do trecho que contém a resposta\n');
  const posicoes = [];
  for (const item of RESPONDIVEIS) {
    const resposta = await call('POST', '/search', {
      query: item.pergunta,
      mode: 'HYBRID',
      caseId: CASO,
      limit: 25,
    });
    const resultados = resposta.body?.results ?? [];
    const indice = resultados.findIndex((resultado) => item.achado.test(resultado.excerpt ?? ''));
    const posicao = indice === -1 ? null : indice + 1;
    posicoes.push(posicao);
    linha(
      `  ${(posicao === null ? '—' : String(posicao)).padStart(3)}  ${item.pergunta.slice(0, 72)}`,
    );
    linha(`       (${item.onde})`);
  }

  linha(`\n  quantas das ${RESPONDIVEIS.length} perguntas teriam o trecho em mãos:`);
  for (const limite of [3, 5, 8, 10]) {
    const alcancadas = posicoes.filter((posicao) => posicao !== null && posicao <= limite).length;
    const nota = limite === 5 ? '   <- teto do ADR-016' : '';
    linha(`    limite ${String(limite).padStart(2)}: ${alcancadas}/${posicoes.length}${nota}`);
  }
  return posicoes;
}

async function faseCitacoes() {
  linha('\n=== 2. CITAÇÕES — a citação permite reencontrar o texto?\n');
  let total = 0;
  let completas = 0;
  let intervalos = 0;
  let hashes = 0;
  for (const item of RESPONDIVEIS) {
    const resposta = await call('POST', '/search', {
      query: item.pergunta,
      mode: 'HYBRID',
      caseId: CASO,
      limit: 10,
    });
    for (const resultado of resposta.body?.results ?? []) {
      const citacao = resultado.citation ?? {};
      total += 1;
      if (
        typeof citacao.caseId === 'string' &&
        typeof citacao.documentId === 'string' &&
        typeof citacao.extractionId === 'string' &&
        typeof citacao.contentHash === 'string' &&
        typeof citacao.pageNumber === 'number' &&
        typeof citacao.startOffset === 'number' &&
        typeof citacao.endOffset === 'number'
      ) {
        completas += 1;
      }
      if (
        typeof citacao.startOffset === 'number' &&
        typeof citacao.endOffset === 'number' &&
        citacao.endOffset > citacao.startOffset
      ) {
        intervalos += 1;
      }
      const hash = createHash('sha256')
        .update(resultado.excerpt ?? '', 'utf8')
        .digest('hex');
      if (hash === citacao.contentHash) {
        hashes += 1;
      }
    }
  }
  linha(`  campos completos      : ${completas}/${total}`);
  linha(`  intervalo bem formado : ${intervalos}/${total}`);
  linha(`  hash bate com o texto : ${hashes}/${total}`);
  return { total, hashes };
}

async function faseResposta() {
  linha('\n=== 3. RESPOSTA — cobertura, recusa, latência e custo (chama o modelo)\n');
  const linhas = [];
  for (const item of [...RESPONDIVEIS, ...SEM_RESPOSTA]) {
    const esperaResposta = item.achado !== undefined;
    const resposta = await call('POST', '/assistant/answers', {
      caseId: CASO,
      question: item.pergunta,
    });
    if (resposta.status >= 400) {
      linhas.push({
        ...item,
        veredito: 'ERRO',
        detalhe: `HTTP ${resposta.status}`,
        custo: 0,
        ms: resposta.ms,
      });
      continue;
    }
    const corpo = resposta.body;
    const afirmacoes = corpo.claims ?? [];
    const texto = `${corpo.answer ?? ''} ${afirmacoes.map((afirmacao) => afirmacao.text).join(' ')}`;
    const falhas = [];
    if (esperaResposta) {
      if (corpo.status !== 'ANSWER') {
        falhas.push(`esperava resposta, veio ${corpo.status}`);
      } else if (!item.achado.test(texto)) {
        falhas.push('respondeu sem o dado que sustenta a pergunta');
      }
    } else if (corpo.status !== 'INSUFFICIENT_EVIDENCE') {
      // Declarar a ausência dentro de uma resposta fundamentada é meio certo e inteiramente
      // enganoso: a tela exibe a recusa como achado, com citação ao lado.
      const declarou =
        /não contêm|não há informação|não mencionam|não consta|não tratam|não especificam/iu.test(
          texto,
        );
      falhas.push(
        declarou
          ? 'declarou a ausência no texto, mas devolveu como resposta fundamentada'
          : `esperava recusa, veio ${corpo.status}`,
      );
    }
    const semCitacao = afirmacoes.filter(
      (afirmacao) => (afirmacao.citations ?? []).length === 0,
    ).length;
    if (semCitacao > 0) {
      falhas.push(`${semCitacao} afirmação(ões) sem citação`);
    }

    linhas.push({
      ...item,
      veredito: falhas.length === 0 ? 'PASSOU' : 'FALHOU',
      detalhe: falhas.join(' · '),
      custo: Number(corpo.model?.costAmount ?? 0),
      ms: resposta.ms,
    });
  }

  for (const linha of linhas) {
    const marca =
      linha.veredito === 'PASSOU' ? 'ok   ' : linha.veredito === 'ERRO' ? 'ERRO ' : 'FALHA';
    linha(`  ${marca} ${linha.pergunta.slice(0, 74)}`);
    if (linha.detalhe !== '') {
      linha(`        -> ${linha.detalhe}`);
    }
  }

  const validas = linhas.filter((linha) => linha.veredito !== 'ERRO');
  const latencias = validas.map((linha) => linha.ms).sort((a, b) => a - b);
  const custo = validas.reduce((total, linha) => total + linha.custo, 0);
  const aprovadas = linhas.filter((linha) => linha.veredito === 'PASSOU').length;
  linha(
    `\n  ${aprovadas}/${linhas.length} · custo R$ ${custo.toFixed(4)}` +
      ` · latência mediana ${latencias[Math.floor(latencias.length / 2)] ?? 0} ms` +
      ` · pior ${latencias.at(-1) ?? 0} ms`,
  );
}

await autenticar();
const posicoes = await faseRecuperacao();
const citacoes = await faseCitacoes();
if (comModelo) {
  await faseResposta();
} else {
  linha('\n=== 3. RESPOSTA — não executada');
  linha('  A fase paga chama o modelo e debita o teto do caso. Rode com --com-modelo.');
}

const foraDoTeto = posicoes.filter((posicao) => posicao === null || posicao > 5).length;
if (foraDoTeto > 0) {
  linha(
    `\n  ATENÇÃO: ${foraDoTeto} pergunta(s) com resposta no acervo têm o trecho fora do teto de cinco.`,
  );
}
linha(
  `\n  citações resolvíveis: ${citacoes.hashes}/${citacoes.total} conferem pelo hash do conteúdo.\n`,
);
