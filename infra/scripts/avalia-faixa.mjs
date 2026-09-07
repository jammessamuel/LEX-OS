#!/usr/bin/env node
/**
 * Avaliação versionada de UMA faixa da biblioteca de prompts.
 *
 * `avalia-recuperacao.mjs` mede o teto de recuperação e a resposta fundamentada sobre um caso
 * trabalhista. Este mede outra coisa: se a instrução de cada especialidade é OBEDECIDA. As doze
 * faixas restantes nunca tinham sido medidas porque não havia acervo — e não se mede o que não
 * tem caso. Este script monta o caso, sobe os documentos, espera o preparo e pergunta.
 *
 * As perguntas não são genéricas de propósito. Cada uma testa **uma regra que o prompt daquela
 * faixa afirma**: se o prompt diz "nunca converta a unidade", a pergunta pede a área e o veredito
 * confere se a unidade veio como impressa. Medir "respondeu bem" não diz nada sobre o produto;
 * medir "obedeceu à regra escrita" diz tudo, e aponta o parágrafo a corrigir quando falha.
 *
 * O acervo é fictício e vive dentro de cada fixture, em `infra/avaliacao/faixas/`. Nenhum dado
 * real passa por aqui, e o caso criado leva prefixo `AVAL-` para não se confundir com caso de
 * apresentação ou de cliente.
 *
 * **Este script gasta dinheiro**: cada execução chama o modelo uma vez por pergunta, e custou em
 * torno de R$ 1,00 por faixa em 2026-09-07.
 *
 * Uso:
 *   node infra/scripts/avalia-faixa.mjs ambiental
 *   node infra/scripts/avalia-faixa.mjs            # lista as faixas disponíveis
 *
 * Configuração, toda por ambiente:
 *   EVAL_API_URL   EVAL_ORG_SLUG   EVAL_EMAIL   EVAL_PASSWORD
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function linha(texto = '') {
  process.stdout.write(`${texto}\n`);
}

function exigido(nome) {
  const valor = process.env[nome];
  if (valor === undefined || valor.trim() === '') {
    throw new Error(`Defina ${nome} no ambiente antes de rodar a avaliação.`);
  }
  return valor.trim();
}

const raiz = fileURLToPath(new URL('../..', import.meta.url));
const pastaFaixas = `${raiz}infra/avaliacao/faixas`;
const disponiveis = readdirSync(pastaFaixas)
  .filter((arquivo) => arquivo.endsWith('.json'))
  .map((arquivo) => arquivo.replace(/\.json$/u, ''));

const FAIXA = process.argv[2];
if (FAIXA === undefined || !disponiveis.includes(FAIXA)) {
  linha(`Faixas disponíveis: ${disponiveis.join(', ')}`);
  process.exit(FAIXA === undefined ? 0 : 1);
}

const API = exigido('EVAL_API_URL').replace(/\/+$/u, '');
const fixture = JSON.parse(readFileSync(`${pastaFaixas}/${FAIXA}.json`, 'utf8'));

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
    throw new Error(`Autenticação recusada com HTTP ${resposta.status}.`);
  }
  token = resposta.body.accessToken;
}

/** O caso da faixa, reaproveitado entre execuções para não multiplicar acervo na organização. */
async function garantirCaso() {
  const existentes = await call('GET', '/cases?limit=50');
  const achado = (existentes.body?.data ?? []).find(
    (caso) => caso.internalCode === fixture.internalCode,
  );
  if (achado !== undefined) {
    linha(`  caso reaproveitado: ${fixture.internalCode}`);
    return achado.id;
  }
  const criado = await call('POST', '/cases', {
    internalCode: fixture.internalCode,
    title: fixture.title,
    description: 'Acervo fictício montado para avaliar a faixa. Nenhum dado real.',
    legalArea: fixture.legalArea,
    caseType: fixture.caseType,
  });
  if (criado.status >= 400) {
    throw new Error(`Não foi possível criar o caso: HTTP ${criado.status}.`);
  }
  linha(`  caso criado: ${fixture.internalCode}`);
  return criado.body.id;
}

async function garantirDocumentos(casoId) {
  const existentes = await call('GET', `/cases/${casoId}/documents?limit=50`);
  if ((existentes.body?.data ?? []).length >= fixture.documentos.length) {
    linha(`  ${fixture.documentos.length} documentos já no caso`);
    return;
  }
  const form = new FormData();
  for (const documento of fixture.documentos) {
    form.append('files', new Blob([documento.conteudo], { type: 'text/plain' }), documento.nome);
  }
  const envio = await fetch(`${API}/cases/${casoId}/files/upload`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: form,
  });
  if (!envio.ok) {
    throw new Error(`Envio dos documentos recusado com HTTP ${envio.status}.`);
  }
  linha(`  ${fixture.documentos.length} documentos enviados`);
}

/** Sem texto extraído não há o que perguntar; o preparo é assíncrono e precisa ser esperado. */
async function esperarPreparo(casoId) {
  for (let tentativa = 0; tentativa < 40; tentativa += 1) {
    const documentos = await call('GET', `/cases/${casoId}/documents?limit=50`);
    const lista = documentos.body?.data ?? [];
    const prontos = lista.filter(
      (documento) =>
        documento.processingStatus !== 'PENDING' && documento.processingStatus !== 'PROCESSING',
    );
    if (lista.length > 0 && prontos.length === lista.length) {
      linha(`  preparo concluído em ${prontos.length} documentos`);
      return;
    }
    await new Promise((resolver) => setTimeout(resolver, 15000));
  }
  linha(
    '  ATENÇÃO: o preparo não concluiu no tempo esperado; as respostas podem estar incompletas',
  );
}

function avaliar(pergunta, resposta) {
  const corpo = resposta.body;
  const texto = `${corpo.answer ?? ''} ${(corpo.claims ?? []).map((c) => c.text).join(' ')}`;
  const falhas = [];

  if (pergunta.recusa === true) {
    if (corpo.status !== 'INSUFFICIENT_EVIDENCE') {
      falhas.push(`esperava recusa, veio ${corpo.status}`);
    }
  } else if (pergunta.aceitaAmbos === true) {
    // Pergunta que pede um número que o prompt proíbe calcular, ou que pede uma qualificação
    // jurídica, tem duas saídas defensáveis: recusar inteiro, ou responder com o que os
    // documentos trazem sem fazer a conta nem concluir. Exigir uma só era régua estreita, e
    // reprovou o modelo várias vezes por ele escolher a mais segura. O que importa medir aqui é
    // o que NÃO pode aparecer, e disso o `proibido` cuida nos dois casos.
    if (
      corpo.status === 'ANSWER' &&
      pergunta.contem !== undefined &&
      !new RegExp(pergunta.contem, 'iu').test(texto)
    ) {
      falhas.push('respondeu sem trazer as parcelas');
    }
  } else {
    if (corpo.status !== 'ANSWER') {
      falhas.push(`esperava resposta, veio ${corpo.status}`);
    } else if (pergunta.contem !== undefined && !new RegExp(pergunta.contem, 'iu').test(texto)) {
      falhas.push('não trouxe o dado esperado');
    }
  }

  // A regra do prompt vive aqui: o que a resposta não pode conter. É o que mede obediência.
  if (
    pergunta.proibido !== undefined &&
    pergunta.proibido !== null &&
    new RegExp(pergunta.proibido, 'iu').test(texto)
  ) {
    falhas.push(`violou a regra: ${pergunta.regra}`);
  }
  const semCitacao = (corpo.claims ?? []).filter((c) => (c.citations ?? []).length === 0).length;
  if (semCitacao > 0) {
    falhas.push(`${semCitacao} afirmação(ões) sem citação`);
  }
  return falhas;
}

await autenticar();
const casoId = await garantirCaso();
await garantirDocumentos(casoId);
await esperarPreparo(casoId);

linha(`\n=== ${FAIXA.toUpperCase()} — cada pergunta testa uma regra do próprio prompt\n`);
const resultados = [];
for (const pergunta of fixture.perguntas) {
  const resposta = await call('POST', '/assistant/answers', {
    caseId: casoId,
    question: pergunta.pergunta,
  });
  if (resposta.status >= 400) {
    resultados.push({
      ...pergunta,
      veredito: 'ERRO',
      detalhe: `HTTP ${resposta.status}`,
      custo: 0,
    });
    continue;
  }
  const falhas = avaliar(pergunta, resposta);
  resultados.push({
    ...pergunta,
    veredito: falhas.length === 0 ? 'PASSOU' : 'FALHOU',
    detalhe: falhas.join(' · '),
    custo: Number(resposta.body.model?.costAmount ?? 0),
    resposta: (resposta.body.answer ?? '').slice(0, 200),
  });
}

for (const resultado of resultados) {
  const marca =
    resultado.veredito === 'PASSOU' ? 'ok   ' : resultado.veredito === 'ERRO' ? 'ERRO ' : 'FALHA';
  linha(`  ${marca} ${resultado.pergunta.slice(0, 76)}`);
  linha(`        regra: ${resultado.regra}`);
  if (resultado.detalhe !== '') {
    linha(`        -> ${resultado.detalhe}`);
  }
  if (resultado.veredito === 'FALHOU' && resultado.resposta) {
    linha(`        resposta: ${resultado.resposta}`);
  }
}

const aprovadas = resultados.filter((r) => r.veredito === 'PASSOU').length;
const custo = resultados.reduce((total, r) => total + r.custo, 0);
linha(`\n  ${aprovadas}/${resultados.length} · custo R$ ${custo.toFixed(4)}\n`);
