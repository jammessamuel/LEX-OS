import { HttpStatus } from '@nestjs/common';

import { ApiException } from './api-exception.js';

/**
 * Data de calendário, sem hora.
 *
 * Data de documento e data de nascimento não têm hora do dia: o documento traz "03/02/2020", e
 * inventar meia-noite em algum fuso é escolha do sistema, não informação da pessoa. Por isso o
 * contrato declara `format: 'date'` e guarda meia-noite em UTC.
 *
 * Existe porque o mesmo defeito estava escrito em três lugares. Todos faziam
 * `new Date(\`${valor}T00:00:00.000Z\`)`, concatenando sem conferir — e `@IsDateString` aceita
 * ISO completo, então `2020-02-03T00:00:00.000Z` passava pela validação, virava
 * `2020-02-03T00:00:00.000ZT00:00:00.000Z`, e chegava ao banco como data inválida. O resultado
 * era 500 numa requisição que o próprio contrato dizia aceitar.
 */
const APENAS_DATA = /^(\d{4})-(\d{2})-(\d{2})$/u;
const ISO_COMPLETO =
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})?$/u;

function recusa(field: string): never {
  // 400 e não 500: o valor veio de quem chamou, e a mensagem tem de dizer qual campo.
  throw new ApiException(
    HttpStatus.BAD_REQUEST,
    'INVALID_CALENDAR_DATE',
    `O campo ${field} não é uma data válida no formato AAAA-MM-DD.`,
  );
}

export function parseCalendarDate(value: string, field: string): Date {
  const partes = APENAS_DATA.exec(value);

  if (partes !== null) {
    const [, ano, mes, dia] = partes.map(Number) as [number, number, number, number];
    const data = new Date(Date.UTC(ano, mes - 1, dia));
    // Ida e volta, porque o JavaScript não recusa dia inexistente: ele rola para frente, e
    // "2020-02-30" viraria 1 de março sem avisar ninguém. Num documento de processo isso é um
    // fato errado guardado com aparência de certo.
    if (
      data.getUTCFullYear() !== ano ||
      data.getUTCMonth() !== mes - 1 ||
      data.getUTCDate() !== dia
    ) {
      recusa(field);
    }
    return data;
  }

  // Fora do formato do contrato, só ISO 8601 é aceito, e nada mais. `new Date` sozinho
  // interpretaria "03/02/2020" como 2 de março — silenciosamente trocando o mês de quem
  // escreveu a data no formato brasileiro, que é como todo mundo escreve por aqui.
  if (!ISO_COMPLETO.test(value)) {
    recusa(field);
  }
  const data = new Date(value);
  if (Number.isNaN(data.getTime())) {
    recusa(field);
  }
  // Normaliza para meia-noite em UTC: o dia é o dado, a hora é ruído que o fuso de quem
  // chamou introduziria na comparação e na exibição.
  return new Date(
    Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate(), 0, 0, 0, 0),
  );
}
