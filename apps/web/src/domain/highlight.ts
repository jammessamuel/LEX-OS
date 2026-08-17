/**
 * Realce dos termos pesquisados dentro do trecho recuperado.
 *
 * O trecho vem de documento do cliente e é evidência não confiável: ele nunca pode ir para
 * `v-html`. Por isso esta função devolve segmentos que o template renderiza como texto —
 * marcação escrita dentro do documento aparece na tela como marcação, não é interpretada.
 *
 * O casamento é feito sem acento e sem caixa, e o realce se estende até o fim da palavra,
 * para que "contrat" pinte "contrato". Não é o mesmo radical que o PostgreSQL usa ao
 * indexar; é aproximação de leitura, e por isso a ordem dos resultados continua sendo a do
 * servidor — o realce nunca decide relevância.
 */

export interface ExcerptSegment {
  text: string;
  match: boolean;
}

const WORD = /[\p{L}\p{N}]/u;

/**
 * Cada unidade de código vira exatamente uma, para que o índice do texto dobrado continue
 * casando com o do texto original. Sem isso, o realce sairia deslocado em qualquer trecho
 * com acento.
 */
function fold(value: string): string {
  let folded = '';
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charAt(index);
    const stripped = unit
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();
    folded += stripped.length === 1 ? stripped : unit;
  }
  return folded;
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

/** Termos de uma ou duas letras não informam nada e pintariam o trecho inteiro. */
function termsOf(query: string): string[] {
  const unique = new Set(
    fold(query)
      .split(/[^\p{L}\p{N}]+/u)
      .filter((term) => term.length >= 3),
  );
  return [...unique];
}

interface Range {
  start: number;
  end: number;
}

function rangesFor(folded: string, terms: readonly string[]): Range[] {
  const pattern = new RegExp(terms.map(escapeForRegExp).join('|'), 'gu');
  const found: Range[] = [];

  for (const match of folded.matchAll(pattern)) {
    const start = match.index;
    // Só início de palavra: "ato" não pode acender no meio de "contrato".
    if (start > 0 && WORD.test(folded.charAt(start - 1))) {
      continue;
    }
    let end = start + match[0].length;
    while (end < folded.length && WORD.test(folded.charAt(end))) {
      end += 1;
    }
    found.push({ start, end });
  }

  found.sort((left, right) => left.start - right.start);

  const merged: Range[] = [];
  for (const range of found) {
    const previous = merged.at(-1);
    if (previous !== undefined && range.start <= previous.end) {
      previous.end = Math.max(previous.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

export function highlightExcerpt(excerpt: string, query: string): ExcerptSegment[] {
  const terms = termsOf(query);
  if (terms.length === 0 || excerpt === '') {
    return [{ text: excerpt, match: false }];
  }

  const ranges = rangesFor(fold(excerpt), terms);
  if (ranges.length === 0) {
    return [{ text: excerpt, match: false }];
  }

  const segments: ExcerptSegment[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) {
      segments.push({ text: excerpt.slice(cursor, range.start), match: false });
    }
    segments.push({ text: excerpt.slice(range.start, range.end), match: true });
    cursor = range.end;
  }
  if (cursor < excerpt.length) {
    segments.push({ text: excerpt.slice(cursor), match: false });
  }
  return segments;
}
