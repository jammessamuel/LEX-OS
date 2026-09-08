const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const seedSafetyModule = import('../prisma/seed-safety.ts');

describe('proteção do seed fictício', () => {
  it('aceita apenas destinos PostgreSQL locais sem autorização adicional', async () => {
    const { assertFictionalSeedTarget } = await seedSafetyModule;

    for (const databaseUrl of [
      'postgresql://postgres:senha@localhost:5433/postgres?schema=public',
      'postgres://postgres:senha@127.0.0.1/demo',
      'postgresql://postgres:senha@[::1]:5544/demo',
    ]) {
      assert.doesNotThrow(() => assertFictionalSeedTarget(databaseUrl, {}));
    }
  });

  it('recusa banco remoto quando não há autorização vinculada ao alvo', async () => {
    const { assertFictionalSeedTarget } = await seedSafetyModule;

    assert.throws(
      () => assertFictionalSeedTarget('postgresql://usuario:segredo@db.example:6432/lexos', {}),
      (error) => {
        assert.match(error.message, /refuses remote databases/u);
        assert.doesNotMatch(error.message, /usuario|segredo/u);
        return true;
      },
    );
  });

  it('aceita somente a autorização remota que identifica exatamente o destino', async () => {
    const { assertFictionalSeedTarget } = await seedSafetyModule;
    const databaseUrl = 'postgresql://usuario:segredo@db.example:6432/lexos?schema=public';

    assert.doesNotThrow(() =>
      assertFictionalSeedTarget(databaseUrl, {
        SEED_REMOTE_DATABASE_TARGET: 'db.example:6432/lexos',
      }),
    );
    assert.throws(() =>
      assertFictionalSeedTarget(databaseUrl, {
        SEED_REMOTE_DATABASE_TARGET: 'outro.example:6432/lexos',
      }),
    );
  });

  it('recusa URL inválida, protocolo diferente e nome de banco ausente', async () => {
    const { assertFictionalSeedTarget } = await seedSafetyModule;

    assert.throws(() => assertFictionalSeedTarget('não-é-url', {}), /valid PostgreSQL URL/u);
    assert.throws(
      () => assertFictionalSeedTarget('https://db.example/lexos', {}),
      /postgres or postgresql protocol/u,
    );
    assert.throws(
      () => assertFictionalSeedTarget('postgresql://postgres@localhost', {}),
      /identify a database/u,
    );
  });
});
