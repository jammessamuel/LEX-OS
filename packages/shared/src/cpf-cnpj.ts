/**
 * Dígito verificador de CPF e CNPJ.
 *
 * Vive aqui, e não dentro da API, porque duas aplicações precisam da mesma regra: o cadastro de
 * pessoa recusa identificador inválido na entrada, e a extração de dados precisa da mesma
 * conferência para não apresentar como CPF uma sequência que só tem o formato de um.
 *
 * O formato sozinho não distingue documento de ruído. Digitalização troca dígito, formulário traz
 * exemplo preenchido, e um número com onze algarismos e pontuação certa passa por CPF em qualquer
 * expressão regular. O dígito verificador é o que separa os dois, e é barato de conferir.
 */

function temDigitosRepetidos(valor: string): boolean {
  return /^(\d)\1+$/u.test(valor);
}

function digitoCpf(digitos: string, posicao: 9 | 10): number {
  let soma = 0;
  for (let indice = 0; indice < posicao; indice += 1) {
    soma += Number(digitos[indice]) * (posicao + 1 - indice);
  }
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}

/** Recebe só os onze algarismos, sem pontuação. */
export function isValidCpf(value: string): boolean {
  return (
    /^\d{11}$/u.test(value) &&
    !temDigitosRepetidos(value) &&
    digitoCpf(value, 9) === Number(value[9]) &&
    digitoCpf(value, 10) === Number(value[10])
  );
}

function digitoCnpj(digitos: string, pesos: readonly number[]): number {
  const soma = pesos.reduce((total, peso, indice) => total + Number(digitos[indice]) * peso, 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/** Recebe só os quatorze algarismos, sem pontuação. */
export function isValidCnpj(value: string): boolean {
  if (!/^\d{14}$/u.test(value) || temDigitosRepetidos(value)) {
    return false;
  }
  const primeirosPesos = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const;
  const segundosPesos = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const;
  return (
    digitoCnpj(value, primeirosPesos) === Number(value[12]) &&
    digitoCnpj(value, segundosPesos) === Number(value[13])
  );
}

/** Os algarismos de um identificador pontuado, para conferir o dígito. */
export function somenteDigitos(value: string): string {
  return value.replace(/\D/gu, '');
}
