const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

describe('AppController', () => {
  it('describes the API bootstrap without exposing product behavior', async () => {
    const { AppController } = await import('../../dist/app.controller.js');
    const controller = new AppController();

    assert.deepEqual(controller.getServiceInfo(), {
      name: 'lex-os-api',
      status: 'operational',
    });
  });
});
