/**
 * Repórter que transforma cada teste reprovado numa anotação do GitHub Actions.
 *
 * O log completo de um job só é acessível a quem tem direito de administrador no repositório.
 * Sem isto, uma falha de CI chega a quem está corrigindo como "exit code 1" e o diagnóstico
 * vira adivinhação — que custa um ciclo de CI por tentativa.
 *
 * Anotação é pública na API de check-runs e aparece no resumo do job, então a mensagem da
 * asserção fica visível para qualquer pessoa que precise agir sobre ela.
 *
 * Roda ao lado do repórter normal: o `spec` continua indo para a saída padrão, este vai para
 * a saída de erro. Nada é substituído.
 */

const NEWLINE = /\r?\n/gu;

/** Anotação é uma linha só: quebras viram `%0A`, e `::` no meio fecharia o comando. */
function escape(value) {
  return String(value).replace(NEWLINE, '%0A').replaceAll('::', '∷');
}

/** Primeira linha do rastro que aponta para um arquivo do repositório, não para o node. */
function originOf(error) {
  const stack = typeof error?.stack === 'string' ? error.stack : '';
  for (const line of stack.split(NEWLINE)) {
    if (line.includes('/test/') || line.includes('\\test\\')) {
      return line.trim();
    }
  }
  return '';
}

function messageOf(error) {
  if (error === undefined || error === null) {
    return 'Falha sem detalhe.';
  }
  // Erro de asserção guarda o detalhe em `cause` — e ele chega DESSERIALIZADO quando o
  // node:test roda o arquivo em outro processo, então `instanceof Error` falhava e o detalhe
  // sumia: a anotação dizia só "test failed", que não diagnostica nada. Lê a forma, não a
  // classe, e desce mais um nível, porque falha de hook embrulha duas vezes.
  const messageLike = (valor) =>
    typeof valor?.message === 'string' && valor.message !== '' ? valor.message : '';
  const detail = messageLike(error.cause) || messageLike(error.cause?.cause);
  const own = typeof error.message === 'string' ? error.message : String(error);
  return detail === '' || own.includes(detail) ? own : `${own} — ${detail}`;
}

export default async function* githubTestAnnotations(source) {
  let failures = 0;
  for await (const event of source) {
    if (event.type !== 'test:fail') {
      continue;
    }
    // Suíte que falha porque um filho falhou não vira anotação própria: repetiria o mesmo
    // erro em todos os níveis e empurraria as falhas reais para fora do limite do GitHub.
    if (event.data.details?.error?.failureType === 'subtestsFailed') {
      continue;
    }
    failures += 1;
    const name = escape(event.data.name);
    const origin = originOf(event.data.details?.error);
    const message = escape(messageOf(event.data.details?.error));
    yield `::error title=${name}::${message}${origin === '' ? '' : ` %0A${escape(origin)}`}\n`;
  }
  if (failures > 0) {
    yield `::error title=Testes reprovados::${failures} teste(s) falharam.\n`;
  }
}
