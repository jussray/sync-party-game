import test from 'node:test';
import assert from 'node:assert/strict';
import { invokeProvider, providerStates } from '../src/provider-runtime.js';

test('provider states expose no secret values', () => {
  const states = providerStates({
    OPENAI_API_KEY: 'openai-secret',
    ANTHROPIC_API_KEY: 'anthropic-secret',
    MODEL_API_KEY: 'muse-secret'
  });
  assert.equal(states.openai.state, 'INTEGRATED');
  assert.equal(states.anthropic.state, 'INTEGRATED');
  assert.equal(states.muse.state, 'INTEGRATED');
  assert.doesNotMatch(JSON.stringify(states), /secret/);
});

test('OpenAI invocation returns provider evidence', async () => {
  const fetchMock = async (url, init) => {
    assert.equal(String(url), 'https://api.openai.com/v1/responses');
    assert.equal(init.headers.authorization, 'Bearer openai-key');
    assert.doesNotMatch(String(init.body), /openai-key/);
    return new Response(JSON.stringify({ id: 'resp_sync_1', output_text: 'sync result' }), { status: 200 });
  };
  const result = await invokeProvider({ OPENAI_API_KEY: 'openai-key' }, { provider: 'openai', prompt: 'review this round' }, fetchMock);
  assert.equal(result.evidenceRef, 'provider:openai:resp_sync_1');
  assert.equal(result.authority, 'none');
});

test('restricted context is rejected before provider use', async () => {
  await assert.rejects(() => invokeProvider({ MODEL_API_KEY: 'muse-key' }, {
    provider: 'muse', prompt: 'private context', sensitivity: 'restricted'
  }, async () => { throw new Error('should not run'); }), /restricted context/);
});
