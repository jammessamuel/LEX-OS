const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { RecordingEmailProvider, renderEmail } = require('../dist/index.js');

const invitation = {
  templateId: 'invitation',
  recipient: { userId: 'u-1', address: 'ana@escritorio.invalid', name: 'Ana Fictícia' },
  data: {
    organizationName: 'Escritório Fictício',
    recipientName: 'Ana Fictícia',
    link: 'https://exemplo.invalid/convite?token=abc',
    expiresAt: '27/08/2026',
  },
};

describe('email templates', () => {
  it('renders the invitation in plain text, with the deadline and the single-use warning', () => {
    const rendered = renderEmail(invitation);

    assert.match(rendered.subject, /Convite para acessar o Escritório Fictício/u);
    assert.match(rendered.text, /uma única vez/u);
    assert.match(rendered.text, /27\/08\/2026/u);
    assert.ok(rendered.text.includes(invitation.data.link));
    // Texto puro é a escolha: HTML abriria a porta para interpolar sem escapar.
    assert.equal(/<[a-z]/iu.test(rendered.text), false);
  });

  it('tells the reader what to do when the reset was not theirs', () => {
    const rendered = renderEmail({
      ...invitation,
      templateId: 'password-reset',
      data: { ...invitation.data, link: 'https://exemplo.invalid/nova-senha?token=abc' },
    });

    assert.match(rendered.subject, /Redefinição de senha/u);
    assert.match(rendered.text, /sua senha atual continua valendo/u);
  });

  it('refuses to render with a missing field instead of sending a broken message', () => {
    assert.throws(
      () => renderEmail({ ...invitation, data: { recipientName: 'Ana Fictícia' } }),
      /organizationName/u,
    );
  });

  it('records instead of sending, so the test can inspect the outbox', async () => {
    const provider = new RecordingEmailProvider();
    const result = await provider.send(invitation);

    assert.equal(result.providerMessageId, null);
    assert.equal(provider.sent.length, 1);
    assert.equal(provider.sent[0].recipient.address, 'ana@escritorio.invalid');
    provider.clear();
    assert.equal(provider.sent.length, 0);
  });
});
