import assert from 'node:assert/strict';
import test from 'node:test';

import { invokeProvider, providerStates } from '../src/provider-runtime.js';

const KEY = 'TEST-KEY-NOT-A-REAL-SECRET';
const okFetch = () => {
  const wrapped = async () => { wrapped.calls++; return new Response(JSON.stringify({ id: 'resp_1', output_text: 'ok' }), { status: 200, headers: { 'content-type': 'application/json' } }); };
  wrapped.calls = 0;
  return wrapped;
};

test('muse requires an explicitly configured allow-listed model', async () => {
  assert.equal(providerStates({ MODEL_API_KEY: KEY }).muse.state, 'ABSENT');
  assert.equal(providerStates({ MODEL_API_KEY: KEY, SYNC_MUSE_MODEL: 'muse-spark-9.9' }).muse.state, 'ABSENT');
  assert.equal(providerStates({ MODEL_API_KEY: KEY, SYNC_MUSE_MODEL: 'muse-spark-1.3' }).muse.state, 'INTEGRATED');
  const fetchImpl = okFetch();
  await assert.rejects(() => invokeProvider({ MODEL_API_KEY: KEY }, { provider: 'muse', prompt: 'hi' }, fetchImpl), /not configured/);
  assert.equal(fetchImpl.calls, 0);
});

test('non-standard sensitivity and non-allowlisted source reject pre-network', async () => {
  const env = { MODEL_API_KEY: KEY, SYNC_MUSE_MODEL: 'muse-spark-1.3' };
  const f1 = okFetch();
  await assert.rejects(() => invokeProvider(env, { provider: 'muse', prompt: 'hi', sensitivity: 'crisis' }, f1), /sensitive_context_not_authorized/);
  assert.equal(f1.calls, 0);
  const f2 = okFetch();
  await assert.rejects(() => invokeProvider(env, { provider: 'muse', prompt: 'hi', source: 'user' }, f2), /user_content_not_authorized/);
  assert.equal(f2.calls, 0);
  const ok = await invokeProvider(env, { provider: 'muse', prompt: 'hi' }, okFetch());
  assert.equal(ok.state, 'INTEGRATED');
  assert.equal(ok.evidenceRef, 'provider:meta:resp_1');
});
