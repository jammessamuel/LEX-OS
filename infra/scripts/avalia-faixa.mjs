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
 * apresentação ou de cliente. O script confere o corpus remoto por código, área, tipo, nome,
 * tamanho e SHA-256 antes de chamar o modelo; contar documentos não identifica um corpus.
 *
 * **Este script gasta dinheiro**: cada execução chama o modelo uma vez por pergunta, e custou em
 * torno de R$ 1,00 por faixa em 2026-09-07.
 *
 * Uso:
 *   node infra/scripts/avalia-faixa.mjs ambiental
 *   node infra/scripts/avalia-faixa.mjs            # lista as faixas disponíveis
 *
 * Configuração obrigatória, toda por ambiente:
 *   EVAL_API_URL   EVAL_ORG_SLUG   EVAL_EMAIL   EVAL_PASSWORD
 *
 * Metadados opcionais do alvo e da saída:
 *   EVAL_TARGET_GIT_SHA   EVAL_DEPLOYMENT_ID   EVAL_DEPLOYMENT_ENVIRONMENT
 *   EVAL_OUTPUT_FILE      EVAL_PREPARATION_TIMEOUT_MS   EVAL_POLL_INTERVAL_MS
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

function linha(texto = '') {
  process.stdout.write(`${texto}\n`);
}

function linhaDeErro(texto) {
  process.stderr.write(`${texto}\n`);
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

class FalhaDaAvaliacao extends Error {
  constructor(codigo, mensagem, detalhes = undefined) {
    super(mensagem);
    this.name = 'FalhaDaAvaliacao';
    this.codigo = codigo;
    this.detalhes = detalhes;
  }
}

function falha(codigo, mensagem, detalhes = undefined) {
  throw new FalhaDaAvaliacao(codigo, mensagem, detalhes);
}

function opcional(nome) {
  const valor = process.env[nome];
  return valor === undefined || valor.trim() === '' ? null : valor.trim();
}

function exigido(nome) {
  const valor = opcional(nome);
  if (valor === null) {
    falha('CONFIGURATION_MISSING', `Defina ${nome} no ambiente antes de rodar a avaliação.`, {
      variable: nome,
    });
  }
  return valor;
}

function inteiroPositivo(nome, padrao, minimo) {
  const valor = opcional(nome);
  if (valor === null) return padrao;
  if (!/^\d+$/u.test(valor) || Number(valor) < minimo || !Number.isSafeInteger(Number(valor))) {
    falha('CONFIGURATION_INVALID', `${nome} precisa ser um inteiro de pelo menos ${minimo}.`, {
      variable: nome,
    });
  }
  return Number(valor);
}

function sha256(conteudo) {
  return createHash('sha256').update(conteudo).digest('hex');
}

function jsonCanonico(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => jsonCanonico(item)).join(',')}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${jsonCanonico(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function caminhoRelativo(caminho) {
  return relative(raiz, caminho).split(sep).join('/');
}

function saidaGit(argumentos) {
  try {
    return execFileSync('git', argumentos, {
      cwd: raiz,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

function primeiroValor(...valores) {
  return valores.find((valor) => valor !== null) ?? null;
}

function apiSemCredencial(valor) {
  try {
    const url = new URL(valor);
    url.username = '';
    url.password = '';
    return url.toString().replace(/\/$/u, '');
  } catch {
    return null;
  }
}

function resumoDeEstados(documentos) {
  return documentos
    .map((documento) => ({
      filename: documento.file?.filename ?? 'unknown',
      processingStatus: documento.processingStatus ?? 'UNKNOWN',
      fileStatus: documento.file?.status ?? 'UNKNOWN',
      virusScanStatus: documento.file?.virusScanStatus ?? 'UNKNOWN',
    }))
    .sort((a, b) => a.filename.localeCompare(b.filename));
}

const raiz = fileURLToPath(new URL('../..', import.meta.url));
const caminhoDoScript = fileURLToPath(import.meta.url);
const pastaFaixas = resolve(raiz, 'infra/avaliacao/faixas');
const disponiveis = readdirSync(pastaFaixas)
  .filter((arquivo) => arquivo.endsWith('.json'))
  .map((arquivo) => arquivo.replace(/\.json$/u, ''))
  .sort();

const FAIXA = process.argv[2];
if (FAIXA === undefined || !disponiveis.includes(FAIXA)) {
  linha(`Faixas disponíveis: ${disponiveis.join(', ')}`);
  process.exit(FAIXA === undefined ? 0 : 1);
}

const caminhoDaFixture = resolve(pastaFaixas, `${FAIXA}.json`);
const fixtureBruta = readFileSync(caminhoDaFixture);
const fixture = JSON.parse(fixtureBruta.toString('utf8'));
if (
  !isRecord(fixture) ||
  typeof fixture.internalCode !== 'string' ||
  typeof fixture.title !== 'string' ||
  typeof fixture.legalArea !== 'string' ||
  typeof fixture.caseType !== 'string' ||
  !Array.isArray(fixture.documentos) ||
  fixture.documentos.length === 0 ||
  !Array.isArray(fixture.perguntas) ||
  fixture.perguntas.length === 0
) {
  falha('FIXTURE_INVALID', `A fixture ${FAIXA} não tem o contrato mínimo da avaliação.`);
}

const documentosDoManifesto = fixture.documentos.map((documento) => {
  if (
    !isRecord(documento) ||
    typeof documento.nome !== 'string' ||
    typeof documento.conteudo !== 'string'
  ) {
    falha('FIXTURE_INVALID', `A fixture ${FAIXA} contém documento inválido.`);
  }
  const bytes = Buffer.from(documento.conteudo, 'utf8');
  return {
    filename: documento.nome,
    sizeBytes: bytes.byteLength,
    sha256: sha256(bytes),
  };
});

if (
  new Set(documentosDoManifesto.map((documento) => documento.filename)).size !==
  documentosDoManifesto.length
) {
  falha('FIXTURE_INVALID', `A fixture ${FAIXA} repete nome de documento.`);
}

const identidadeDoCorpus = {
  schemaVersion: 1,
  fixture: caminhoRelativo(caminhoDaFixture),
  fixtureSha256: sha256(fixtureBruta),
  internalCode: fixture.internalCode,
  legalArea: fixture.legalArea,
  caseType: fixture.caseType,
  documents: documentosDoManifesto,
  questionCount: fixture.perguntas.length,
  questionsSha256: sha256(jsonCanonico(fixture.perguntas)),
};
const manifestoDoCorpus = {
  ...identidadeDoCorpus,
  manifestSha256: sha256(jsonCanonico(identidadeDoCorpus)),
};

const iniciadaEm = new Date();
const nomeDaSaida = `${iniciadaEm.toISOString().replace(/[:.]/gu, '-')}-${FAIXA}.json`;
const caminhoDaSaidaConfigurado = opcional('EVAL_OUTPUT_FILE');
const caminhoDaSaida =
  caminhoDaSaidaConfigurado === null
    ? resolve(raiz, 'tmp/avaliacoes/faixas', nomeDaSaida)
    : resolve(process.cwd(), caminhoDaSaidaConfigurado);
const gitShaLocal = saidaGit(['rev-parse', 'HEAD']);
// Arquivo novo também muda o código que pode estar servindo a API local. Ignorá-lo faria uma
// execução sobre código não commitado aparecer, incorretamente, como árvore limpa no artefato.
const arvoreSuja = saidaGit(['status', '--short', '--untracked-files=normal']);

const artefato = {
  schemaVersion: 1,
  evaluation: 'specialty-prompt-compliance',
  specialty: FAIXA,
  startedAt: iniciadaEm.toISOString(),
  finishedAt: null,
  durationMs: null,
  status: 'RUNNING',
  harness: {
    script: caminhoRelativo(caminhoDoScript),
    scriptSha256: sha256(readFileSync(caminhoDoScript)),
    gitSha: gitShaLocal,
    workingTreeDirty: arvoreSuja === null ? null : arvoreSuja !== '',
  },
  target: {
    apiUrl: null,
    gitSha: primeiroValor(
      opcional('EVAL_TARGET_GIT_SHA'),
      opcional('RAILWAY_GIT_COMMIT_SHA'),
      opcional('RAILWAY_GIT_COMMIT_HASH'),
    ),
    deploymentId: primeiroValor(opcional('EVAL_DEPLOYMENT_ID'), opcional('RAILWAY_DEPLOYMENT_ID')),
    environment: primeiroValor(
      opcional('EVAL_DEPLOYMENT_ENVIRONMENT'),
      opcional('RAILWAY_ENVIRONMENT_NAME'),
    ),
  },
  corpus: {
    ...manifestoDoCorpus,
    caseId: null,
    caseReused: null,
    uploadedDocuments: [],
    observedDocuments: [],
  },
  preparation: {
    status: 'NOT_STARTED',
    documents: [],
  },
  results: [],
  summary: null,
  failure: null,
};

function gravarArtefato() {
  mkdirSync(dirname(caminhoDaSaida), { recursive: true });
  writeFileSync(caminhoDaSaida, `${JSON.stringify(artefato, null, 2)}\n`, 'utf8');
}

let API = '';
let token = '';

async function call(metodo, caminho, corpo) {
  const inicio = Date.now();
  let ultimoErro;
  // Só leituras são repetidas automaticamente. Um POST pode ter chegado ao servidor mesmo quando
  // a conexão caiu antes da resposta; repetir `/assistant/answers` cobraria outra execução do
  // modelo e transformaria uma falha de transporte em custo duplicado.
  const maximoDeTentativas = metodo === 'GET' ? 4 : 1;
  for (let tentativa = 1; tentativa <= maximoDeTentativas; tentativa += 1) {
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
      let body = null;
      if (texto !== '') {
        try {
          body = JSON.parse(texto);
        } catch {
          falha(
            'API_RESPONSE_NOT_JSON',
            `${metodo} ${caminho} devolveu corpo não JSON com HTTP ${resposta.status}.`,
            { method: metodo, path: caminho, httpStatus: resposta.status },
          );
        }
      }
      return {
        status: resposta.status,
        body,
        ms: Date.now() - inicio,
        attempts: tentativa,
      };
    } catch (erro) {
      if (erro instanceof FalhaDaAvaliacao) throw erro;
      ultimoErro = erro;
      if (tentativa < maximoDeTentativas) {
        await new Promise((resolver) => setTimeout(resolver, 2500));
      }
    }
  }
  falha('API_UNREACHABLE', `${metodo} ${caminho} falhou após ${maximoDeTentativas} tentativa(s).`, {
    method: metodo,
    path: caminho,
    reason: ultimoErro instanceof Error ? ultimoErro.message : 'unknown network failure',
  });
}

function exigirHttp(resposta, esperado, codigo, operacao) {
  if (!esperado.includes(resposta.status)) {
    falha(codigo, `${operacao} foi recusada com HTTP ${resposta.status}.`, {
      httpStatus: resposta.status,
      apiCode:
        isRecord(resposta.body) && typeof resposta.body.code === 'string'
          ? resposta.body.code
          : null,
      requestId:
        isRecord(resposta.body) && typeof resposta.body.requestId === 'string'
          ? resposta.body.requestId
          : null,
    });
  }
}

async function autenticar() {
  const resposta = await call('POST', '/auth/login', {
    organizationSlug: exigido('EVAL_ORG_SLUG'),
    email: exigido('EVAL_EMAIL'),
    password: exigido('EVAL_PASSWORD'),
  });
  if (resposta.status !== 200 || typeof resposta.body?.accessToken !== 'string') {
    falha('AUTHENTICATION_FAILED', `Autenticação recusada com HTTP ${resposta.status}.`, {
      httpStatus: resposta.status,
      apiCode:
        isRecord(resposta.body) && typeof resposta.body.code === 'string'
          ? resposta.body.code
          : null,
      requestId:
        isRecord(resposta.body) && typeof resposta.body.requestId === 'string'
          ? resposta.body.requestId
          : null,
    });
  }
  token = resposta.body.accessToken;
}

/** O caso da faixa é reaproveitado somente quando sua identidade ainda coincide com a fixture. */
async function garantirCaso() {
  const existentes = await call(
    'GET',
    `/cases?limit=50&search=${encodeURIComponent(fixture.internalCode)}`,
  );
  exigirHttp(existentes, [200], 'CASE_LIST_FAILED', 'A consulta do caso de avaliação');
  const casos = Array.isArray(existentes.body?.data) ? existentes.body.data : [];
  const encontrados = casos.filter((caso) => caso.internalCode === fixture.internalCode);
  if (encontrados.length > 1) {
    falha('CORPUS_CASE_AMBIGUOUS', `Há mais de um caso com o código ${fixture.internalCode}.`);
  }
  const achado = encontrados[0];
  if (achado !== undefined) {
    if (achado.legalArea !== fixture.legalArea || achado.caseType !== fixture.caseType) {
      falha(
        'CORPUS_CASE_MISMATCH',
        `O caso ${fixture.internalCode} não corresponde à área e ao tipo da fixture.`,
        {
          expected: { legalArea: fixture.legalArea, caseType: fixture.caseType },
          observed: { legalArea: achado.legalArea ?? null, caseType: achado.caseType ?? null },
        },
      );
    }
    linha(`  caso reaproveitado: ${fixture.internalCode}`);
    artefato.corpus.caseId = achado.id;
    artefato.corpus.caseReused = true;
    return achado.id;
  }
  const criado = await call('POST', '/cases', {
    internalCode: fixture.internalCode,
    title: fixture.title,
    description: 'Acervo fictício montado para avaliar a faixa. Nenhum dado real.',
    legalArea: fixture.legalArea,
    caseType: fixture.caseType,
  });
  exigirHttp(criado, [201], 'CASE_CREATE_FAILED', 'A criação do caso de avaliação');
  if (typeof criado.body?.id !== 'string') {
    falha('CASE_CREATE_RESPONSE_INVALID', 'A criação do caso não devolveu um identificador.');
  }
  linha(`  caso criado: ${fixture.internalCode}`);
  artefato.corpus.caseId = criado.body.id;
  artefato.corpus.caseReused = false;
  return criado.body.id;
}

async function listarDocumentos(casoId) {
  const resposta = await call('GET', `/cases/${casoId}/documents?limit=50`);
  exigirHttp(resposta, [200], 'DOCUMENT_LIST_FAILED', 'A consulta dos documentos de avaliação');
  if (!Array.isArray(resposta.body?.data)) {
    falha('DOCUMENT_LIST_RESPONSE_INVALID', 'A consulta de documentos não devolveu uma lista.');
  }
  if (resposta.body?.pageInfo?.hasNextPage === true) {
    falha(
      'CORPUS_HAS_UNINSPECTED_DOCUMENTS',
      'O caso tem mais de 50 documentos; o harness não pode afirmar que o corpus é exato.',
    );
  }
  return resposta.body.data;
}

async function hashDoArquivoRemoto(documento) {
  const resposta = await call('GET', `/files/${documento.fileId}/download-url`);
  exigirHttp(
    resposta,
    [200],
    'CORPUS_DOWNLOAD_URL_FAILED',
    `A autorização para conferir ${documento.file?.filename ?? documento.id}`,
  );
  if (typeof resposta.body?.url !== 'string') {
    falha('CORPUS_DOWNLOAD_URL_INVALID', 'A API não devolveu uma URL de conferência válida.');
  }
  let download;
  try {
    download = await fetch(resposta.body.url);
  } catch (erro) {
    falha('CORPUS_DOWNLOAD_FAILED', 'Não foi possível baixar um documento para conferir o hash.', {
      filename: documento.file?.filename ?? null,
      reason: erro instanceof Error ? erro.message : 'unknown network failure',
    });
  }
  if (!download.ok) {
    falha(
      'CORPUS_DOWNLOAD_FAILED',
      `A conferência de ${documento.file?.filename ?? documento.id} recebeu HTTP ${download.status}.`,
      { filename: documento.file?.filename ?? null, httpStatus: download.status },
    );
  }
  return sha256(Buffer.from(await download.arrayBuffer()));
}

async function conferirDocumentos(documentos, permitirAusentes) {
  const esperadosPorNome = new Map(
    documentosDoManifesto.map((documento) => [documento.filename, documento]),
  );
  const observadosPorNome = new Map();
  for (const documento of documentos) {
    const nome = documento.file?.filename;
    if (typeof nome !== 'string') {
      falha('CORPUS_DOCUMENT_INVALID', 'Um documento remoto não tem nome de arquivo.');
    }
    if (!esperadosPorNome.has(nome)) {
      falha('CORPUS_UNEXPECTED_DOCUMENT', `O caso contém o documento inesperado ${nome}.`, {
        filename: nome,
      });
    }
    if (observadosPorNome.has(nome)) {
      falha('CORPUS_DUPLICATE_DOCUMENT', `O caso contém mais de um documento chamado ${nome}.`, {
        filename: nome,
      });
    }
    observadosPorNome.set(nome, documento);
  }

  const ausentes = [];
  const conferidos = [];
  for (const esperado of documentosDoManifesto) {
    const observado = observadosPorNome.get(esperado.filename);
    if (observado === undefined) {
      ausentes.push(esperado.filename);
      continue;
    }
    if (observado.file?.status !== 'AVAILABLE' || observado.file?.virusScanStatus !== 'CLEAN') {
      falha(
        'CORPUS_FILE_NOT_AVAILABLE',
        `O arquivo ${esperado.filename} não está AVAILABLE/CLEAN.`,
        {
          filename: esperado.filename,
          fileStatus: observado.file?.status ?? null,
          virusScanStatus: observado.file?.virusScanStatus ?? null,
        },
      );
    }
    if (Number(observado.file?.sizeBytes) !== esperado.sizeBytes) {
      falha('CORPUS_SIZE_MISMATCH', `O tamanho de ${esperado.filename} diverge da fixture.`, {
        filename: esperado.filename,
        expected: esperado.sizeBytes,
        observed: Number(observado.file?.sizeBytes),
      });
    }
    const hashObservado = await hashDoArquivoRemoto(observado);
    if (hashObservado !== esperado.sha256) {
      falha('CORPUS_HASH_MISMATCH', `O SHA-256 de ${esperado.filename} diverge da fixture.`, {
        filename: esperado.filename,
        expected: esperado.sha256,
        observed: hashObservado,
      });
    }
    conferidos.push({
      documentId: observado.id,
      fileId: observado.fileId,
      filename: esperado.filename,
      sizeBytes: esperado.sizeBytes,
      sha256: hashObservado,
      processingStatus: observado.processingStatus,
    });
  }

  if (!permitirAusentes && ausentes.length > 0) {
    falha('CORPUS_DOCUMENT_MISSING', 'O caso não contém todos os documentos da fixture.', {
      filenames: ausentes,
    });
  }
  return { ausentes, conferidos };
}

async function enviarDocumentos(casoId, nomes) {
  const porNome = new Map(fixture.documentos.map((documento) => [documento.nome, documento]));
  const form = new FormData();
  for (const nome of nomes) {
    const documento = porNome.get(nome);
    form.append('files', new Blob([documento.conteudo], { type: 'text/plain' }), documento.nome);
  }
  let envio;
  try {
    envio = await fetch(`${API}/cases/${casoId}/files/upload`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: form,
    });
  } catch (erro) {
    falha('CORPUS_UPLOAD_FAILED', 'O envio dos documentos de avaliação falhou.', {
      reason: erro instanceof Error ? erro.message : 'unknown network failure',
    });
  }
  const texto = await envio.text();
  let body = null;
  if (texto !== '') {
    try {
      body = JSON.parse(texto);
    } catch {
      falha(
        'CORPUS_UPLOAD_RESPONSE_INVALID',
        `O envio devolveu corpo não JSON com HTTP ${envio.status}.`,
      );
    }
  }
  if (!envio.ok) {
    falha('CORPUS_UPLOAD_FAILED', `Envio dos documentos recusado com HTTP ${envio.status}.`, {
      httpStatus: envio.status,
      apiCode: isRecord(body) && typeof body.code === 'string' ? body.code : null,
      requestId: isRecord(body) && typeof body.requestId === 'string' ? body.requestId : null,
    });
  }
  const aceitos = Array.isArray(body?.accepted) ? body.accepted.length : 0;
  const rejeitados = Array.isArray(body?.rejected) ? body.rejected : [];
  if (aceitos !== nomes.length || rejeitados.length > 0) {
    falha('CORPUS_UPLOAD_INCOMPLETE', 'Nem todos os documentos da fixture foram aceitos.', {
      expected: nomes.length,
      accepted: aceitos,
      rejectedCodes: rejeitados.map((item) => item?.code ?? 'UNKNOWN'),
    });
  }
  artefato.corpus.uploadedDocuments.push(...nomes);
  linha(`  ${nomes.length} documento(s) enviado(s)`);
}

async function garantirDocumentos(casoId) {
  const existentes = await listarDocumentos(casoId);
  const primeiraConferencia = await conferirDocumentos(existentes, true);
  if (primeiraConferencia.ausentes.length > 0) {
    await enviarDocumentos(casoId, primeiraConferencia.ausentes);
  } else {
    linha(`  ${documentosDoManifesto.length} documentos conferidos no caso`);
  }
  const atuais = await listarDocumentos(casoId);
  const conferenciaFinal = await conferirDocumentos(atuais, false);
  if (atuais.length !== documentosDoManifesto.length) {
    falha(
      'CORPUS_DOCUMENT_COUNT_MISMATCH',
      'O caso contém quantidade de documentos diferente do manifesto.',
      { expected: documentosDoManifesto.length, observed: atuais.length },
    );
  }
  artefato.corpus.observedDocuments = conferenciaFinal.conferidos;
}

/** Somente os términos úteis, COMPLETED ou NEEDS_REVIEW, liberam a medição. */
async function esperarPreparo(casoId) {
  const timeoutMs = inteiroPositivo('EVAL_PREPARATION_TIMEOUT_MS', 600_000, 1);
  const pollIntervalMs = inteiroPositivo('EVAL_POLL_INTERVAL_MS', 15_000, 1);
  const limite = Date.now() + timeoutMs;
  artefato.preparation.status = 'WAITING';

  while (true) {
    const documentos = await listarDocumentos(casoId);
    const estados = resumoDeEstados(documentos);
    artefato.preparation.documents = estados;

    const arquivoIndisponivel = estados.find(
      (documento) => documento.fileStatus !== 'AVAILABLE' || documento.virusScanStatus !== 'CLEAN',
    );
    if (arquivoIndisponivel !== undefined) {
      artefato.preparation.status = 'FAILED';
      falha('PREPARATION_FILE_FAILED', 'Um arquivo deixou de estar AVAILABLE/CLEAN.', {
        documents: estados,
      });
    }

    const falhou = estados.find((documento) => documento.processingStatus === 'FAILED');
    if (falhou !== undefined) {
      artefato.preparation.status = 'FAILED';
      falha(
        'DOCUMENT_PREPARATION_FAILED',
        `O preparo de ${falhou.filename} terminou em FAILED; a avaliação foi interrompida.`,
        { documents: estados },
      );
    }
    const desconhecido = estados.find(
      (documento) =>
        !['PENDING', 'QUEUED', 'PROCESSING', 'COMPLETED', 'NEEDS_REVIEW'].includes(
          documento.processingStatus,
        ),
    );
    if (desconhecido !== undefined) {
      artefato.preparation.status = 'FAILED';
      falha(
        'DOCUMENT_PREPARATION_STATUS_UNKNOWN',
        `O preparo de ${desconhecido.filename} devolveu estado desconhecido.`,
        { documents: estados },
      );
    }
    if (
      estados.length === documentosDoManifesto.length &&
      estados.every((item) => ['COMPLETED', 'NEEDS_REVIEW'].includes(item.processingStatus))
    ) {
      artefato.preparation.status = 'COMPLETED';
      linha(`  preparo concluído em estado terminal útil em ${estados.length} documentos`);
      return;
    }
    if (Date.now() >= limite) {
      artefato.preparation.status = 'FAILED';
      const haQueued = estados.some((documento) => documento.processingStatus === 'QUEUED');
      falha(
        haQueued ? 'DOCUMENT_PREPARATION_QUEUED_TIMEOUT' : 'DOCUMENT_PREPARATION_TIMEOUT',
        haQueued
          ? 'O preparo permaneceu em QUEUED até o tempo limite; nenhuma pergunta foi enviada.'
          : 'O preparo não alcançou COMPLETED ou NEEDS_REVIEW em todos os documentos no prazo.',
        { timeoutMs, documents: estados },
      );
    }
    await new Promise((resolver) =>
      setTimeout(resolver, Math.min(pollIntervalMs, Math.max(1, limite - Date.now()))),
    );
  }
}

function avaliar(pergunta, resposta) {
  const corpo = resposta.body;
  if (!isRecord(corpo)) return ['a API não devolveu um objeto de resposta'];
  const claims = Array.isArray(corpo.claims) ? corpo.claims : [];
  const texto = `${typeof corpo.answer === 'string' ? corpo.answer : ''} ${claims
    .map((claim) => (isRecord(claim) && typeof claim.text === 'string' ? claim.text : ''))
    .join(' ')}`;
  const falhas = [];

  if (pergunta.recusa === true) {
    if (corpo.status !== 'INSUFFICIENT_EVIDENCE') {
      falhas.push(`esperava recusa, veio ${corpo.status ?? 'sem status'}`);
    }
  } else if (pergunta.aceitaAmbos === true) {
    // Conta proibida ou qualificação jurídica admite recusa ou resposta parcial sem concluir.
    if (!['ANSWER', 'INSUFFICIENT_EVIDENCE'].includes(corpo.status)) {
      falhas.push(`esperava resposta ou recusa, veio ${corpo.status ?? 'sem status'}`);
    } else if (
      corpo.status === 'ANSWER' &&
      pergunta.contem !== undefined &&
      !new RegExp(pergunta.contem, 'iu').test(texto)
    ) {
      falhas.push('respondeu sem trazer as parcelas');
    }
  } else if (corpo.status !== 'ANSWER') {
    falhas.push(`esperava resposta, veio ${corpo.status ?? 'sem status'}`);
  } else if (pergunta.contem !== undefined && !new RegExp(pergunta.contem, 'iu').test(texto)) {
    falhas.push('não trouxe o dado esperado');
  }

  if (
    pergunta.proibido !== undefined &&
    pergunta.proibido !== null &&
    new RegExp(pergunta.proibido, 'iu').test(texto)
  ) {
    falhas.push(`violou a regra: ${pergunta.regra}`);
  }
  const semCitacao = claims.filter(
    (claim) => !isRecord(claim) || !Array.isArray(claim.citations) || claim.citations.length === 0,
  ).length;
  if (semCitacao > 0) {
    falhas.push(`${semCitacao} afirmação(ões) sem citação`);
  }
  return falhas;
}

function metadadosDaResposta(corpo) {
  const model = isRecord(corpo?.model) ? corpo.model : null;
  const promptSha256 = primeiroValor(
    typeof corpo?.effectivePromptSha256 === 'string' ? corpo.effectivePromptSha256 : null,
    typeof model?.effectivePromptSha256 === 'string' ? model.effectivePromptSha256 : null,
    typeof model?.promptSha256 === 'string' ? model.promptSha256 : null,
    typeof model?.promptHash === 'string' ? model.promptHash : null,
  );
  const promptVersion = typeof model?.promptVersion === 'string' ? model.promptVersion : null;
  const modelMetadata =
    model === null
      ? null
      : {
          provider: typeof model.provider === 'string' ? model.provider : null,
          name: typeof model.modelName === 'string' ? model.modelName : null,
          version: typeof model.modelVersion === 'string' ? model.modelVersion : null,
          executionId: typeof model.executionId === 'string' ? model.executionId : null,
        };
  const amount = typeof model?.costAmount === 'string' ? model.costAmount : null;
  const currency = typeof model?.costCurrency === 'string' ? model.costCurrency : null;
  return {
    model: modelMetadata,
    effectivePrompt:
      promptVersion === null && promptSha256 === null
        ? null
        : { version: promptVersion, sha256: promptSha256 },
    cost: amount === null ? null : { amount, currency },
  };
}

function motivoDaApi(corpo) {
  if (!isRecord(corpo)) return null;
  for (const campo of ['reason', 'refusalReason', 'code']) {
    if (typeof corpo[campo] === 'string' && corpo[campo] !== '') return corpo[campo];
  }
  return null;
}

function microsDe(valor) {
  if (!/^\d+(\.\d{1,6})?$/u.test(valor)) return null;
  const [inteiro, decimal = ''] = valor.split('.');
  return BigInt(inteiro) * 1_000_000n + BigInt(decimal.padEnd(6, '0'));
}

function decimalDeMicros(valor) {
  return `${valor / 1_000_000n}.${(valor % 1_000_000n).toString().padStart(6, '0')}`;
}

function mediana(valores) {
  if (valores.length === 0) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  return ordenados[Math.floor(ordenados.length / 2)] ?? null;
}

async function executarPerguntas(casoId) {
  linha(`\n=== ${FAIXA.toUpperCase()} — cada pergunta testa uma regra do próprio prompt\n`);
  const resultados = [];
  // A referência entra no artefato antes da primeira chamada. Se a conexão cair no meio da
  // rodada, o `finally` ainda preserva tudo o que já foi medido (inclusive custo conhecido), em
  // vez de gravar uma lista vazia depois de várias execuções pagas.
  artefato.results = resultados;
  for (const [indice, pergunta] of fixture.perguntas.entries()) {
    const resposta = await call('POST', '/assistant/answers', {
      caseId: casoId,
      question: pergunta.pergunta,
    });
    const metadados = metadadosDaResposta(resposta.body);
    const requestId =
      isRecord(resposta.body) && typeof resposta.body.requestId === 'string'
        ? resposta.body.requestId
        : null;
    if (resposta.status >= 400) {
      resultados.push({
        index: indice + 1,
        question: pergunta.pergunta,
        rule: pergunta.regra,
        verdict: 'ERROR',
        reason: motivoDaApi(resposta.body) ?? `HTTP_${resposta.status}`,
        failures: [`HTTP ${resposta.status}`],
        http: { status: resposta.status, requestId, attempts: resposta.attempts },
        latencyMs: resposta.ms,
        ...metadados,
      });
      continue;
    }
    const falhas = avaliar(pergunta, resposta);
    resultados.push({
      index: indice + 1,
      question: pergunta.pergunta,
      rule: pergunta.regra,
      verdict: falhas.length === 0 ? 'PASSED' : 'FAILED',
      reason: falhas.length === 0 ? motivoDaApi(resposta.body) : 'EVALUATION_ASSERTION_FAILED',
      failures: falhas,
      http: { status: resposta.status, requestId, attempts: resposta.attempts },
      latencyMs: resposta.ms,
      ...metadados,
    });
  }

  for (const resultado of resultados) {
    const marca =
      resultado.verdict === 'PASSED' ? 'ok   ' : resultado.verdict === 'ERROR' ? 'ERRO ' : 'FALHA';
    linha(`  ${marca} ${resultado.question.slice(0, 76)}`);
    linha(`        regra: ${resultado.rule}`);
    if (resultado.failures.length > 0) {
      linha(`        -> ${resultado.failures.join(' · ')}`);
    }
  }

  const aprovadas = resultados.filter((resultado) => resultado.verdict === 'PASSED').length;
  const falhas = resultados.filter((resultado) => resultado.verdict === 'FAILED').length;
  const erros = resultados.filter((resultado) => resultado.verdict === 'ERROR').length;
  const custos = resultados
    .map((resultado) => resultado.cost)
    .filter((cost) => cost?.currency === 'BRL' && typeof cost.amount === 'string')
    .map((cost) => microsDe(cost.amount))
    .filter((valor) => valor !== null);
  const custoTotal = custos.reduce((total, valor) => total + valor, 0n);
  const latencias = resultados.map((resultado) => resultado.latencyMs);
  artefato.summary = {
    total: resultados.length,
    passed: aprovadas,
    failed: falhas,
    errors: erros,
    cost: { amount: decimalDeMicros(custoTotal), currency: 'BRL' },
    latencyMs: {
      median: mediana(latencias),
      maximum: latencias.length === 0 ? null : Math.max(...latencias),
    },
  };
  linha(
    `\n  ${aprovadas}/${resultados.length} · custo R$ ${decimalDeMicros(custoTotal)}` +
      ` · latência mediana ${mediana(latencias) ?? 0} ms\n`,
  );
  return falhas + erros === 0;
}

async function executar() {
  API = exigido('EVAL_API_URL').replace(/\/+$/u, '');
  const apiPublica = apiSemCredencial(API);
  if (apiPublica === null) {
    falha('CONFIGURATION_INVALID', 'EVAL_API_URL precisa ser uma URL absoluta válida.', {
      variable: 'EVAL_API_URL',
    });
  }
  artefato.target.apiUrl = apiPublica;
  await autenticar();
  const casoId = await garantirCaso();
  await garantirDocumentos(casoId);
  await esperarPreparo(casoId);
  const passou = await executarPerguntas(casoId);
  artefato.status = passou ? 'PASSED' : 'FAILED';
  if (!passou) {
    artefato.failure = {
      reason: 'EVALUATION_FAILED',
      message: 'Uma ou mais perguntas falharam ou receberam erro; consulte results.',
    };
    process.exitCode = 1;
  }
}

try {
  await executar();
} catch (erro) {
  process.exitCode = 1;
  artefato.status = 'ERROR';
  artefato.failure = {
    reason: erro instanceof FalhaDaAvaliacao ? erro.codigo : 'UNEXPECTED_ERROR',
    message: erro instanceof Error ? erro.message : 'Falha inesperada na avaliação.',
    details: erro instanceof FalhaDaAvaliacao ? (erro.detalhes ?? null) : null,
  };
  linhaDeErro(`ERRO ${artefato.failure.reason}: ${artefato.failure.message}`);
} finally {
  const finalizadaEm = new Date();
  artefato.finishedAt = finalizadaEm.toISOString();
  artefato.durationMs = finalizadaEm.getTime() - iniciadaEm.getTime();
  try {
    gravarArtefato();
    linha(`  artefato: ${caminhoDaSaida}`);
  } catch (erro) {
    process.exitCode = 1;
    linhaDeErro(
      `ERRO ARTIFACT_WRITE_FAILED: ${erro instanceof Error ? erro.message : 'falha desconhecida'}`,
    );
  }
}
