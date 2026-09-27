import upstream from '../src/multisurface-worker.js';
import {
  emitReciprocalTelemetry,
  observeFetchRequest,
  syntheticFetchResponse,
} from './reciprocal-ingress.mjs';

export * from '../src/multisurface-worker.js';

const edge = {
  ...upstream,
  async fetch(request, env, ctx) {
    const observation = await observeFetchRequest(request, env, 'sync-party-game');
    emitReciprocalTelemetry(observation, ctx);
    const hallway = syntheticFetchResponse(observation);
    if (hallway) return hallway;
    if (!upstream.fetch) throw new Error('Sync upstream fetch is unavailable');
    return upstream.fetch.call(upstream, request, env, ctx);
  },
};

export default edge;
