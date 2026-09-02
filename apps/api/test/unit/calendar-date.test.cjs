const assert = require('node:assert/strict');
const { describe, it, before } = require('node:test');

/**
 * O defeito que originou isto: `PATCH /documents/:id` com
 * `documentDate: "2020-02-03T00:00:00.000Z"` devolvia 500.
 *
 * O valor passava pela validação — `@IsDateString` aceita ISO completo — e o serviço, que
 * assumia data-só, concatenava o horário de novo. O resultado era
 * `2020-02-03T00:00:00.000ZT00:00:00.000Z`, uma data inválida chegando ao banco.
 *
 * O mesmo código estava escrito em três lugares: data de documento e data de nascimento em duas
 * rotas de pessoa. Foi encontrado preparando uma demonstração, editando a data de um documento.
 */

let parseCalendarDate;

describe('parseCalendarDate', () => {
  before(async () => {
    ({ parseCalendarDate } = await import('../../dist/http/calendar-date.js'));
  });

  it('aceita a data-só que o contrato declara', () => {
    assert.equal(
      parseCalendarDate('2020-02-03', 'documentDate').toISOString(),
      '2020-02-03T00:00:00.000Z',
    );
  });

  it('aceita o ISO completo que a validação deixa passar, em vez de estourar', () => {
    // Este é o caso exato do 500. O campo não guarda hora, mas recusar com erro interno uma
    // entrada que o próprio validador aprovou é defeito nosso, não de quem chamou.
    assert.equal(
      parseCalendarDate('2020-02-03T00:00:00.000Z', 'documentDate').toISOString(),
      '2020-02-03T00:00:00.000Z',
    );
  });

  it('descarta a hora, porque data de documento não tem hora', () => {
    // "03/02/2020 às 14h" não existe num documento: o que existe é o dia impresso nele.
    assert.equal(
      parseCalendarDate('2020-02-03T14:37:11.500Z', 'documentDate').toISOString(),
      '2020-02-03T00:00:00.000Z',
    );
  });

  it('recusa data impossível com 400, e não com erro interno', () => {
    // 2020-02-30 nao existe e o JavaScript rolaria para 1 de marco; 03/02/2020 e formato
    // brasileiro e viraria 2 de marco. Os dois guardariam fato errado com cara de certo.
    for (const ruim of ['2020-02-30', 'ontem', '03/02/2020', '2020-13-01', '2021-02-29', '']) {
      assert.throws(
        () => parseCalendarDate(ruim, 'documentDate'),
        (erro) => {
          assert.equal(erro.status ?? erro.statusCode, 400, `"${ruim}" deveria dar 400`);
          // A mensagem nomeia o campo: quem recebe o erro precisa saber qual corrigir.
          assert.match(erro.message, /documentDate/u);
          return true;
        },
        `"${ruim}" passou`,
      );
    }
  });

  it('nomeia o campo que veio errado, e não um genérico', () => {
    assert.throws(
      () => parseCalendarDate('nao-e-data', 'birthDate'),
      (erro) => {
        assert.match(erro.message, /birthDate/u);
        return true;
      },
    );
  });
});
