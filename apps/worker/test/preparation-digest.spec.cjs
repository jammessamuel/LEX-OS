const assert = require('node:assert/strict');

const {
  PreparationDigestService,
  describeCases,
} = require('../dist/processing/preparation-digest.service.js');

const DAY = 24 * 60 * 60 * 1_000;
const NOW = new Date('2026-08-27T12:00:00.000Z');

const ORG_A = '00000000-0000-4000-8000-00000000000a';
const ORG_B = '00000000-0000-4000-8000-00000000000b';
const ANA = '00000000-0000-4000-8000-0000000000a1';
const BRUNO = '00000000-0000-4000-8000-0000000000b1';

const config = {
  service: { webOrigin: 'https://lex.example' },
  processing: { reconcileIntervalSeconds: 60 },
};

/**
 * Dobro do cliente Prisma com o mínimo que o serviço toca.
 *
 * Guarda o que foi enfileirado e também as consultas de destinatário, para os casos poderem
 * afirmar isolamento por organização — que é a coisa mais fácil de quebrar sem ninguém notar
 * numa varredura que, por natureza, atravessa todos os inquilinos.
 */
function fakeDatabase({ completions = [], lastDigests = [], users = [] } = {}) {
  const created = [];
  const userLookups = [];
  return {
    created,
    userLookups,
    client: {
      emailOutbox: {
        groupBy: async () =>
          lastDigests.map((row) => ({
            organizationId: row.organizationId,
            userId: row.userId,
            _max: { createdAt: row.createdAt },
          })),
        create: async ({ data }) => {
          created.push(data);
          return { id: `outbox-${created.length}` };
        },
      },
      processingJob: {
        findMany: async (query) => {
          // O serviço tem de pedir só a última etapa concluída, dentro da janela.
          assert.equal(query.where.jobType, 'EMBEDDING');
          assert.equal(query.where.status, 'COMPLETED');
          assert.equal(query.where.case.deletedAt, null);
          return completions;
        },
      },
      user: {
        findFirst: async (query) => {
          userLookups.push(query.where);
          return (
            users.find(
              (user) =>
                user.organizationId === query.where.organizationId &&
                user.id === query.where.id &&
                user.status === query.where.status,
            ) ?? null
          );
        },
      },
    },
  };
}

function completion(organizationId, documentId, internalCode, responsibleUserId, finishedAt) {
  return {
    organizationId,
    documentId,
    finishedAt,
    case: { internalCode, responsibleUserId },
  };
}

function activeUser(organizationId, id, name, email, silenced = []) {
  return { organizationId, id, name, email, status: 'ACTIVE', silencedNotifications: silenced };
}

function service(database) {
  return new PreparationDigestService(database, config);
}

describe('resumo diário de preparação concluída', () => {
  it('agrupa as conclusões do dia num único aviso por responsável', async () => {
    const database = fakeDatabase({
      completions: [
        completion(ORG_A, 'doc-1', 'CIV-0001', ANA, new Date(NOW.getTime() - 3 * 60 * 60 * 1_000)),
        completion(ORG_A, 'doc-2', 'CIV-0001', ANA, new Date(NOW.getTime() - 2 * 60 * 60 * 1_000)),
        completion(ORG_A, 'doc-3', 'CIV-0009', ANA, new Date(NOW.getTime() - 1 * 60 * 60 * 1_000)),
      ],
      users: [activeUser(ORG_A, ANA, 'Ana', 'ana@exemplo.invalid')],
    });

    assert.equal(await service(database).digestOnce(NOW), 1);
    assert.equal(database.created.length, 1);

    const row = database.created[0];
    assert.equal(row.templateId, 'preparation-digest');
    assert.equal(row.organizationId, ORG_A);
    assert.equal(row.userId, ANA);
    assert.equal(row.recipient, 'ana@exemplo.invalid');
    assert.equal(row.payload.documentCount, '3');
    assert.equal(row.payload.caseCodes, 'CIV-0001, CIV-0009');
    assert.equal(row.payload.link, 'https://lex.example/painel');
  });

  it('não deixa a carga levar nada além do conteúdo mínimo do ADR-013', async () => {
    const database = fakeDatabase({
      completions: [completion(ORG_A, 'doc-1', 'CIV-0001', ANA, new Date(NOW.getTime() - DAY / 2))],
      users: [activeUser(ORG_A, ANA, 'Ana', 'ana@exemplo.invalid')],
    });

    await service(database).digestOnce(NOW);

    // Contagem, códigos de caso, nome de quem recebe e link. Nada mais: título de documento,
    // teor extraído ou nome de parte entrando aqui é vazamento por e-mail.
    assert.deepEqual(Object.keys(database.created[0].payload).sort(), [
      'caseCodes',
      'documentCount',
      'link',
      'recipientName',
    ]);
  });

  it('separa responsáveis e organizações em avisos distintos', async () => {
    const database = fakeDatabase({
      completions: [
        completion(ORG_A, 'doc-1', 'CIV-0001', ANA, new Date(NOW.getTime() - DAY / 2)),
        completion(ORG_B, 'doc-2', 'TRA-0002', BRUNO, new Date(NOW.getTime() - DAY / 2)),
      ],
      users: [
        activeUser(ORG_A, ANA, 'Ana', 'ana@exemplo.invalid'),
        activeUser(ORG_B, BRUNO, 'Bruno', 'bruno@exemplo.invalid'),
      ],
    });

    assert.equal(await service(database).digestOnce(NOW), 2);

    // Cada destinatário é procurado dentro da própria organização: a varredura atravessa
    // inquilinos, a consulta nunca.
    for (const lookup of database.userLookups) {
      const expected = lookup.id === ANA ? ORG_A : ORG_B;
      assert.equal(lookup.organizationId, expected);
    }
    const codes = database.created.map((row) => row.payload.caseCodes).sort();
    assert.deepEqual(codes, ['CIV-0001', 'TRA-0002']);
  });

  it('cala quem recebeu resumo há menos de um dia', async () => {
    const database = fakeDatabase({
      completions: [completion(ORG_A, 'doc-1', 'CIV-0001', ANA, new Date(NOW.getTime() - 60_000))],
      lastDigests: [
        {
          organizationId: ORG_A,
          userId: ANA,
          createdAt: new Date(NOW.getTime() - 6 * 60 * 60 * 1_000),
        },
      ],
      users: [activeUser(ORG_A, ANA, 'Ana', 'ana@exemplo.invalid')],
    });

    assert.equal(await service(database).digestOnce(NOW), 0);
    assert.equal(database.created.length, 0);
  });

  it('não repete no dia seguinte o que já entrou no resumo anterior', async () => {
    const ontem = new Date(NOW.getTime() - 30 * 60 * 60 * 1_000);
    const database = fakeDatabase({
      completions: [
        // Já contado: terminou antes do último resumo.
        completion(ORG_A, 'doc-1', 'CIV-0001', ANA, new Date(ontem.getTime() - 60_000)),
        // Novo: terminou depois dele.
        completion(ORG_A, 'doc-2', 'CIV-0002', ANA, new Date(ontem.getTime() + 60_000)),
      ],
      lastDigests: [{ organizationId: ORG_A, userId: ANA, createdAt: ontem }],
      users: [activeUser(ORG_A, ANA, 'Ana', 'ana@exemplo.invalid')],
    });

    assert.equal(await service(database).digestOnce(NOW), 1);
    assert.equal(database.created[0].payload.documentCount, '1');
    assert.equal(database.created[0].payload.caseCodes, 'CIV-0002');
  });

  it('respeita quem desligou este aviso', async () => {
    const database = fakeDatabase({
      completions: [completion(ORG_A, 'doc-1', 'CIV-0001', ANA, new Date(NOW.getTime() - DAY / 2))],
      users: [activeUser(ORG_A, ANA, 'Ana', 'ana@exemplo.invalid', ['preparation-digest'])],
    });

    assert.equal(await service(database).digestOnce(NOW), 0);
    assert.equal(database.created.length, 0);
  });

  it('não avisa quem não está mais ativo', async () => {
    const database = fakeDatabase({
      completions: [completion(ORG_A, 'doc-1', 'CIV-0001', ANA, new Date(NOW.getTime() - DAY / 2))],
      users: [],
    });

    assert.equal(await service(database).digestOnce(NOW), 0);
  });

  it('ignora conclusão de caso sem responsável', async () => {
    const database = fakeDatabase({
      completions: [
        completion(ORG_A, 'doc-1', 'CIV-0001', null, new Date(NOW.getTime() - DAY / 2)),
      ],
      users: [activeUser(ORG_A, ANA, 'Ana', 'ana@exemplo.invalid')],
    });

    assert.equal(await service(database).digestOnce(NOW), 0);
  });

  it('não derruba a rodada quando um enfileiramento falha', async () => {
    const database = fakeDatabase({
      completions: [
        completion(ORG_A, 'doc-1', 'CIV-0001', ANA, new Date(NOW.getTime() - DAY / 2)),
        completion(ORG_B, 'doc-2', 'TRA-0002', BRUNO, new Date(NOW.getTime() - DAY / 2)),
      ],
      users: [
        activeUser(ORG_A, ANA, 'Ana', 'ana@exemplo.invalid'),
        activeUser(ORG_B, BRUNO, 'Bruno', 'bruno@exemplo.invalid'),
      ],
    });
    const original = database.client.emailOutbox.create;
    let first = true;
    database.client.emailOutbox.create = async (args) => {
      if (first) {
        first = false;
        throw new Error('conexão caiu');
      }
      return original(args);
    };

    assert.equal(await service(database).digestOnce(NOW), 1);
    assert.equal(database.created.length, 1);
  });

  it('silencia quando não houve preparação nenhuma', async () => {
    const database = fakeDatabase({
      users: [activeUser(ORG_A, ANA, 'Ana', 'ana@exemplo.invalid')],
    });
    assert.equal(await service(database).digestOnce(NOW), 0);
  });
});

describe('lista de casos no corpo do aviso', () => {
  it('lista os códigos em ordem quando cabem', () => {
    assert.equal(describeCases(new Set(['CIV-0002', 'CIV-0001'])), 'CIV-0001, CIV-0002');
  });

  it('corta a lista e diz quantos ficaram de fora', () => {
    const codes = new Set(
      Array.from({ length: 13 }, (_, index) => `CIV-${String(index).padStart(4, '0')}`),
    );
    const described = describeCases(codes);
    assert.ok(described.endsWith(' e mais 3 casos'), described);
    assert.equal(described.startsWith('CIV-0000, CIV-0001'), true);
  });

  it('concorda o singular quando sobra um só', () => {
    const codes = new Set(
      Array.from({ length: 11 }, (_, index) => `CIV-${String(index).padStart(4, '0')}`),
    );
    assert.ok(describeCases(codes).endsWith(' e mais 1 caso'));
  });
});
