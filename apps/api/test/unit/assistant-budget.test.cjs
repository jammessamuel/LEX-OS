const assert = require('node:assert/strict');
const { before, describe, it } = require('node:test');

let semFolgaParaResposta;
let Decimal;

before(async () => {
  ({ semFolgaParaResposta } = await import('../../dist/cases/cases.service.js'));
  ({
    Prisma: { Decimal },
  } = await import('@lex-os/database'));
});

/**
 * O teto por caso só é teto se recusar antes de a despesa existir.
 *
 * O custo de uma resposta só se conhece depois de ela existir, e a restrição do banco exige o
 * gasto dentro do teto: com folga menor que uma resposta, o dinheiro é gasto e não pode ser
 * gravado — foi assim que uma pergunta num caso sem teto virou erro interno depois da chamada
 * ao modelo. Por isso a verificação exige folga para uma resposta inteira, e não folga qualquer.
 *
 * Vive fora do teste de integração porque lá é inalcançável: com o provedor determinístico os
 * preços são zero, a folga exigida é zero, e a recusa que importa só existe com provedor pago.
 */

const decimal = (valor) => new Decimal(valor);

describe('folga do teto de custo para mais uma resposta', () => {
  const caso = (limite, gasto, reservado, folga) =>
    semFolgaParaResposta({
      limite: decimal(limite),
      gasto: decimal(gasto),
      reservado: decimal(reservado),
      folgaExigida: decimal(folga),
    });

  it('recusa o caso sem teto definido, que é onde o erro interno nascia', () => {
    assert.equal(caso('0', '0', '0', '0.87'), true);
  });

  it('recusa quando o que resta não paga uma resposta inteira', () => {
    // Um centavo livre não é folga: a resposta custa mais que isso e o gasto furaria o teto.
    assert.equal(caso('250', '249.99', '0', '0.87'), true);
  });

  it('autoriza quando o que resta paga a resposta', () => {
    assert.equal(caso('250', '10', '0', '0.87'), false);
  });

  it('conta a reserva do preparo junto, porque ela também vai virar gasto', () => {
    // O worker reserva antes de trabalhar. Ignorar a reserva aqui autorizaria uma pergunta que
    // o preparo em andamento já comprometeu.
    assert.equal(caso('250', '200', '49.5', '0.87'), true);
    assert.equal(caso('250', '200', '40', '0.87'), false);
  });

  it('com provedor gratuito nada é recusado, porque nada é gasto', () => {
    // Preço zero é o caso do provedor determinístico. Exigir folga ali recusaria uma pergunta
    // que não custa nada — o teto existe para conter despesa, não para conter uso.
    assert.equal(caso('0', '0', '0', '0'), false);
  });
});
