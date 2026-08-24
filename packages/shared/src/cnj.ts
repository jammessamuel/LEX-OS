/**
 * Número único de processo do CNJ (Resolução 65/2008).
 *
 * `NNNNNNN-DD.AAAA.J.TR.OOOO` — sequencial, dígito verificador, ano, segmento do Judiciário,
 * tribunal e órgão de origem.
 *
 * Vive aqui, e não numa validação de DTO, porque a API precisa dele para recusar e a
 * interface precisa dele para avisar antes de a pessoa enviar. Duas cópias divergiriam, e o
 * dígito verificador é exatamente o tipo de código que ninguém revisa duas vezes.
 */

const CNJ_PATTERN = /^(\d{7})-(\d{2})\.(\d{4})\.(\d)\.(\d{2})\.(\d{4})$/u;

/** Segmentos do Judiciário na tabela do CNJ. O 0 não é usado. */
const SEGMENTS: Readonly<Record<string, string>> = {
  '1': 'Supremo Tribunal Federal',
  '2': 'Conselho Nacional de Justiça',
  '3': 'Superior Tribunal de Justiça',
  '4': 'Justiça Federal',
  '5': 'Justiça do Trabalho',
  '6': 'Justiça Eleitoral',
  '7': 'Justiça Militar da União',
  '8': 'Justiça dos Estados e do Distrito Federal',
  '9': 'Justiça Militar Estadual',
};

export interface CnjParts {
  sequential: string;
  checkDigit: string;
  year: string;
  segment: string;
  court: string;
  origin: string;
}

/** Aceita o número com ou sem pontuação: quem copia dos autos cola de qualquer jeito. */
export function normalizeCnj(value: string): string {
  const digits = value.replace(/\D/gu, '');
  if (digits.length !== 20) {
    return value.trim();
  }
  return [
    digits.slice(0, 7),
    '-',
    digits.slice(7, 9),
    '.',
    digits.slice(9, 13),
    '.',
    digits.slice(13, 14),
    '.',
    digits.slice(14, 16),
    '.',
    digits.slice(16, 20),
  ].join('');
}

export function parseCnj(value: string): CnjParts | null {
  const match = CNJ_PATTERN.exec(normalizeCnj(value));
  if (match === null) {
    return null;
  }
  const [, sequential, checkDigit, year, segment, court, origin] = match;
  return {
    sequential: sequential as string,
    checkDigit: checkDigit as string,
    year: year as string,
    segment: segment as string,
    court: court as string,
    origin: origin as string,
  };
}

/**
 * Confere o dígito verificador, e não apenas a forma.
 *
 * Um número com a pontuação certa e um dígito trocado passa em qualquer expressão regular e
 * segue para o resto do sistema como se fosse real — e só aparece quando alguém tenta
 * consultar o processo. O cálculo é o resto de módulo 97 sobre o número sem o dígito, que é
 * a mesma verificação do IBAN e detecta troca de dígito e transposição.
 */
export function isValidCnj(value: string): boolean {
  const parts = parseCnj(value);
  if (parts === null) {
    return false;
  }
  const withoutCheck = `${parts.sequential}${parts.year}${parts.segment}${parts.court}${parts.origin}`;
  const expected = 98n - ((BigInt(withoutCheck) * 100n) % 97n);
  return String(expected).padStart(2, '0') === parts.checkDigit;
}

/** Segmento por extenso, para a tela não mostrar um dígito solto. */
export function cnjSegmentName(value: string): string | null {
  const parts = parseCnj(value);
  return parts === null ? null : (SEGMENTS[parts.segment] ?? null);
}
