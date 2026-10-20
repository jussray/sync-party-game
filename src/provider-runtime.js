const MAX_RESPONSE_BYTES = 64 * 1024;
const TIMEOUT_MS = 60_000;

const PROVIDERS = Object.freeze({
  openai: { key: 'OPENAI_API_KEY', model: 'SYNC_OPENAI_MODEL', defaultModel: 'gpt-5.6-sol', url: 'https://api.openai.com/v1/responses' },
  anthropic: { key: 'ANTHROPIC_API_KEY', model: 'SYNC_ANTHROPIC_MODEL', defaultModel: 'claude-sonnet-5', url: 'https://api.anthropic.com/v1/messages' },
  muse: { key: 'MODEL_API_KEY', model: 'SYNC_MUSE_MODEL', defaultModel: 'muse-spark-1.3', url: 'https://api.meta.ai/v1/responses' }
});

function configFor(env, provider) {
  const config = PROVIDERS[provider];
  if (!config) throw new Error('unsupported provider');
  const key = typeof env?.[config.key] === 'string' ? env[config.key].trim() : '';
  const override = typeof env?.[config.model] === 'string' ? env[config.model].trim() : '';
  return { ...config, key, modelName: override || config.defaultModel };
}

export function providerStates(env = {}) {
  return Object.fromEntries(Object.keys(PROVIDERS).map((provider) => {
    const config = configFor(env, provider);
    return [provider, { state: config.key ? 'INTEGRATED' : 'ABSENT', model: config.modelName }];
  }));
}

async function boundedJson(response, provider) {
  const declared = Number(response.headers.get('content-length') || 0);
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) throw new Error(`${provider} response too large`);
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) throw new Error(`${provider} response too large`);
  try { return JSON.parse(text); } catch { throw new Error(`${provider} returned invalid JSON`); }
}

function validId(value) {
  const id = typeof value === 'string' ? value.trim() : '';
  return id && id.length <= 200 && /^[A-Za-z0-9._:-]+$/.test(id) ? id : null;
}

function outputText(provider, body) {
  if (provider === 'anthropic') {
    return (Array.isArray(body?.content) ? body.content : [])
      .filter((block) => block?.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text.trim()).filter(Boolean).join('\n');
  }
  if (typeof body?.output_text === 'string' && body.output_text.trim()) return body.output_text.trim();
  const parts = [];
  for (const item of Array.isArray(body?.output) ? body.output : []) {
    for (const block of Array.isArray(item?.content) ? item.content : []) {
      if (typeof block?.text === 'string' && block.text.trim()) parts.push(block.text.trim());
    }
  }
  return parts.join('\n');
}

export async function invokeProvider(env, input, fetchImpl = fetch) {
  const provider = String(input?.provider || '').trim().toLowerCase();
  const prompt = String(input?.prompt || '').trim();
  const sensitivity = String(input?.sensitivity || 'standard').trim().toLowerCase();
  if (!prompt || prompt.length > 12000) throw new Error('prompt must be 1..12000 characters');
  if (sensitivity === 'restricted') throw new Error('restricted context is not authorized for external providers');
  const config = configFor(env, provider);
  if (!config.key) throw new Error(`${provider} provider is not configured`);

  const headers = provider === 'anthropic'
    ? { 'x-api-key': config.key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }
    : { authorization: `Bearer ${config.key}`, 'content-type': 'application/json' };
  const body = provider === 'anthropic'
    ? { model: config.modelName, max_tokens: 1200, messages: [{ role: 'user', content: prompt }] }
    : { model: config.modelName, input: prompt, store: false, max_output_tokens: 1200 };

  let response;
  try {
    response = await fetchImpl(config.url, { method: 'POST', headers, body: JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new Error(`${provider} provider request failed`);
  }
  if (!response.ok) throw new Error(`${provider} provider failed with HTTP ${response.status}`);
  const parsed = await boundedJson(response, provider);
  const responseId = validId(parsed?.id);
  if (!responseId) throw new Error(`${provider} provider returned invalid response identity`);
  const text = outputText(provider, parsed);
  if (!text) throw new Error(`${provider} provider returned no usable text`);
  return {
    state: 'INTEGRATED',
    provider,
    model: config.modelName,
    responseId,
    evidenceRef: `provider:${provider === 'muse' ? 'meta' : provider}:${responseId}`,
    authority: 'none',
    text
  };
}
