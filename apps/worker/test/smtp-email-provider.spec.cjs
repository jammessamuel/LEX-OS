const assert = require('node:assert/strict');
const { createServer } = require('node:net');

const { SmtpEmailProvider } = require('../dist/email/smtp-email.provider.js');

/**
 * Servidor SMTP mínimo, só para conferir o que o adaptador escreve na conexão. Ele aceita
 * tudo e guarda a sessão inteira, que é o que os casos inspecionam.
 */
function fakeSmtp() {
  const sessions = [];
  const server = createServer((socket) => {
    let received = '';
    let inData = false;
    socket.write('220 fake ESMTP\r\n');
    socket.on('data', (chunk) => {
      received += chunk.toString('utf8');
      const text = chunk.toString('utf8');
      if (inData) {
        if (received.includes('\r\n.\r\n')) {
          inData = false;
          socket.write('250 2.0.0 Ok: queued as ABCDEF123456\r\n');
        }
        return;
      }
      if (/^EHLO/mu.test(text)) socket.write('250-fake\r\n250 SMTPUTF8\r\n');
      else if (/^MAIL FROM/mu.test(text)) socket.write('250 2.1.0 Ok\r\n');
      else if (/^RCPT TO/mu.test(text)) socket.write('250 2.1.5 Ok\r\n');
      else if (/^DATA/mu.test(text)) {
        inData = true;
        socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
      } else if (/^QUIT/mu.test(text)) {
        socket.write('221 2.0.0 Bye\r\n');
        sessions.push(received);
        socket.end();
      }
    });
    socket.on('close', () => {
      if (!sessions.includes(received)) sessions.push(received);
    });
  });
  return { server, sessions };
}

const message = {
  templateId: 'password-reset',
  recipient: { userId: 'u-1', address: 'ana@escritorio.invalid', name: 'Ana Fictícia' },
  data: {
    organizationName: 'Escritório Fictício',
    recipientName: 'Ana Fictícia',
    link: 'http://localhost:5173/nova-senha?token=abc',
    expiresAt: '20/08/2026 18:00',
  },
};

let harness;
let port;

beforeAll(async () => {
  harness = fakeSmtp();
  await new Promise((resolve) => harness.server.listen(0, '127.0.0.1', resolve));
  port = harness.server.address().port;
});

afterAll(() => {
  harness.server.close();
});

const config = (overrides = {}) => ({
  environment: 'development',
  mail: { host: '127.0.0.1', port, from: 'nao-responda@lexos.invalid' },
  ...overrides,
});

describe('SmtpEmailProvider', () => {
  it('refuses production, like every other mock adapter', () => {
    assert.throws(
      () => new SmtpEmailProvider(config({ environment: 'production' })),
      /cannot run in production/u,
    );
  });

  it('refuses a non-local host, because it speaks no TLS and no authentication', () => {
    assert.throws(
      () =>
        new SmtpEmailProvider({
          environment: 'development',
          mail: { host: 'smtp.exemplo.invalid', port: 587, from: 'x@y.invalid' },
        }),
      /refuses a non-local host/u,
    );
  });

  it('delivers the rendered message and returns the provider identifier', async () => {
    const result = await new SmtpEmailProvider(config()).send(message);

    assert.equal(result.providerMessageId, 'ABCDEF123456');
    const session = harness.sessions.at(-1);
    assert.match(session, /MAIL FROM:<nao-responda@lexos\.invalid>/u);
    assert.match(session, /RCPT TO:<ana@escritorio\.invalid>/u);
  });

  it('encodes an accented subject so it does not arrive broken', async () => {
    await new SmtpEmailProvider(config()).send(message);
    const session = harness.sessions.at(-1);

    // "Redefinição" tem acento: cabeçalho cru chegaria corrompido.
    assert.match(session, /Subject: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=/u);
    assert.match(session, /Content-Transfer-Encoding: base64/u);
  });

  it('sends the body in base64, sidestepping dot-stuffing and line limits', async () => {
    await new SmtpEmailProvider(config()).send(message);
    const session = harness.sessions.at(-1);

    const body = session.slice(
      session.indexOf('base64\r\n\r\n') + 10,
      session.indexOf('\r\n.\r\n'),
    );
    const decoded = Buffer.from(body.replaceAll('\r\n', ''), 'base64').toString('utf8');
    assert.match(decoded, /Ana Fictícia/u);
    assert.ok(decoded.includes(message.data.link));
    // Nenhuma linha do que trafega excede o limite de 998 do SMTP.
    assert.ok(body.split('\r\n').every((line) => line.length <= 998));
  });
});
