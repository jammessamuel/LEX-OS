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

/**
 * As linhas de stderr que parecem o começo de um erro, por arquivo.
 *
 * Erro no carregamento do módulo e rejeição solta não chegam no evento de falha: o node marca o
 * arquivo com a mensagem literal "test failed" e manda o erro verdadeiro como `test:stderr`. Uma
 * rodada inteira de diagnóstico foi gasta contra uma anotação que só dizia isso — o conserto é o
 * relator juntar as duas metades que o node separa.
 */
function looksLikeError(line) {
  return /^[A-Za-z.]*Error[:\s]|^AssertionError|error TS\d|^Unhandled|throw |^PrismaClient/u.test(
    line.trim(),
  );
}

export default async function* githubTestAnnotations(source) {
  let failures = 0;
  /** Por arquivo: { matched: linhas com cara de erro, tail: últimas linhas não vazias }. */
  const capturedByFile = new Map();
  // O evento de falha e o de stderr podem trazer o MESMO arquivo com grafias diferentes —
  // relativo numa ponta, absoluto na outra, separador de outra plataforma. Chavear pelo nome
  // base é o que faz os dois lados se encontrarem.
  const keyOf = (file) => {
    const value = String(file ?? '');
    return value === '' ? '' : (value.split(/[\\/]/u).pop() ?? '');
  };
  const bucketOf = (file) => {
    const key = keyOf(file);
    let bucket = capturedByFile.get(key);
    if (bucket === undefined) {
      bucket = { matched: [], tail: [] };
      capturedByFile.set(key, bucket);
    }
    return bucket;
  };
  for await (const event of source) {
    // A rejeição solta chega como diagnóstico ("A resource generated asynchronous
    // activity…"), não como stderr — os dois canais entram no mesmo balde.
    if (event.type === 'test:stderr' || event.type === 'test:diagnostic') {
      const bucket = bucketOf(event.data.file);
      for (const raw of String(event.data.message ?? '').split(NEWLINE)) {
        const line = raw.trim();
        if (line === '') {
          continue;
        }
        if (looksLikeError(line) && bucket.matched.length < 3) {
          bucket.matched.push(line);
        }
        bucket.tail.push(line);
        if (bucket.tail.length > 5) {
          bucket.tail.shift();
        }
      }
      continue;
    }
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
    let message = messageOf(event.data.details?.error);
    if (message === 'test failed') {
      // Se nenhuma linha teve cara de erro (processo morto por sinal, saída truncada), as
      // últimas linhas cruas ainda dizem mais que nada. O balde sem arquivo cobre eventos
      // que chegam sem essa marcação.
      const own = capturedByFile.get(keyOf(event.data.file));
      const loose = capturedByFile.get('');
      const captured =
        [own?.matched, loose?.matched, own?.tail, loose?.tail].find(
          (lines) => lines !== undefined && lines.length > 0,
        ) ?? [];
      if (captured.length > 0) {
        message = `${message} — ${captured.join(' · ')}`;
      }
    }
    message = escape(message);
    yield `::error title=${name}::${message}${origin === '' ? '' : ` %0A${escape(origin)}`}\n`;
  }
  if (failures > 0) {
    yield `::error title=Testes reprovados::${failures} teste(s) falharam.\n`;
  }
}
