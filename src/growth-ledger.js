import { DurableObject } from "cloudflare:workers";
import { ANALYTICS_TRUTH_VERSION, canonicalGrowthIdentity, normalizeGrowthEvent } from "./growth-contract.js";

const enc = new TextEncoder();
const json = (data, init = {}) => new Response(JSON.stringify(data), {
  ...init,
  headers: { "content-type": "application/json; charset=utf-8", ...(init.headers || {}) }
});

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

async function digest(value) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(JSON.stringify(stable(value)))));
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function bump(record, key) {
  if (!key) return record;
  return { ...record, [key]: (record[key] || 0) + 1 };
}

function continuityCookie(scopeFingerprint, seq) {
  return `growth-v2.${scopeFingerprint.slice(0, 16)}.${seq}`;
}

function emptyAcquisition() {
  return {
    landing_signals: 0,
    identified_landing_signals: 0,
    unidentified_landing_signals: 0,
    unique_growth_identities: 0,
    non_automation_growth_identities: 0,
    automation_growth_identities: 0,
    source_counts: {},
    medium_counts: {},
    content_counts: {},
    referrer_counts: {},
    evidence_counts: {}
  };
}

function emptySummary(scope) {
  return {
    measurement_version: ANALYTICS_TRUTH_VERSION,
    legacy_merged: false,
    scope,
    seq: 0,
    unique_growth_identities: 0,
    unique_visitors: 0,
    counters: {},
    product_counters: {},
    automation_counters: {},
    evidence_counts: {},
    traffic_counts: {},
    acquisition: emptyAcquisition(),
    first_at: null,
    last_at: null,
    recent_events: []
  };
}

function normalizeScope(input = {}) {
  const type = input?.type === "campaign" ? "campaign" : "all";
  const key = type === "campaign" && typeof input?.key === "string" && input.key ? input.key : "all";
  return { type, key };
}

function inferDuplicateSeq(summary, eventFingerprint) {
  const currentSeq = Number.isInteger(summary?.seq) ? summary.seq : 0;
  const recentEvents = Array.isArray(summary?.recent_events) ? summary.recent_events : [];
  for (let index = recentEvents.length - 1; index >= 0; index -= 1) {
    const event = recentEvents[index];
    if (event?.event_fingerprint !== eventFingerprint) continue;
    if (Number.isInteger(event.seq) && event.seq > 0) return event.seq;
    const inferred = currentSeq - (recentEvents.length - 1 - index);
    if (inferred > 0) return inferred;
  }
  return Math.max(currentSeq, 1);
}

export class GrowthLedger extends DurableObject {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/internal/event" && request.method === "POST") {
      try {
        const body = await request.json();
        return json(await this.record(body?.event ?? body, { scope: body?.scope }));
      } catch (error) {
        return json({ error: error.message || "Invalid growth event" }, { status: 400 });
      }
    }

    if (url.pathname === "/internal/summary" && request.method === "GET") {
      const summary = await this.ctx.storage.get("summary");
      const scope = normalizeScope({ type: url.searchParams.get("scope"), key: url.searchParams.get("key") });
      return json(summary || emptySummary(scope));
    }

    return new Response("Not found", { status: 404 });
  }

  async record(input, { scope: rawScope } = {}) {
    const normalized = normalizeGrowthEvent({
      ...input,
      event_id: input?.event_id || crypto.randomUUID()
    }, { preserveEvidence: true });
    const scope = normalizeScope(rawScope);
    const at = Date.now();
    const eventFingerprint = await digest(canonicalGrowthIdentity(normalized));
    const scopeFingerprint = await digest({ measurement_version: ANALYTICS_TRUTH_VERSION, scope });

    const recentIds = (await this.ctx.storage.get("recent_event_ids")) || [];
    const current = (await this.ctx.storage.get("summary")) || emptySummary(scope);

    if (recentIds.includes(normalized.event_id)) {
      const storedReceipt = await this.ctx.storage.get(`receipt:${normalized.event_id}`);
      if (storedReceipt) return { ...storedReceipt, accepted: true, duplicate: true };

      const duplicateSeq = inferDuplicateSeq(current, eventFingerprint);
      const legacyReceipt = {
        accepted: true,
        duplicate: true,
        measurement_version: ANALYTICS_TRUTH_VERSION,
        scope,
        seq: duplicateSeq,
        event_fingerprint: eventFingerprint,
        scope_fingerprint: scopeFingerprint,
        evidence_class: normalized.evidence_class,
        traffic_class: normalized.traffic_class,
        continuity_cookie: continuityCookie(scopeFingerprint, duplicateSeq)
      };
      await this.ctx.storage.put(`receipt:${normalized.event_id}`, legacyReceipt);
      return legacyReceipt;
    }

    let uniqueIdentities = current.unique_growth_identities || current.unique_visitors || 0;
    if (normalized.visitor_id) {
      const visitorFingerprint = await digest({ scope, visitor_id: normalized.visitor_id });
      const visitorStorageKey = `visitor:${visitorFingerprint}`;
      const seen = await this.ctx.storage.get(visitorStorageKey);
      if (!seen) {
        await this.ctx.storage.put(visitorStorageKey, true);
        uniqueIdentities += 1;
      }
    }

    const isAutomation = normalized.traffic_class === "automation_likely";
    let acquisition = current.acquisition || emptyAcquisition();
    if (normalized.event === "landing_view") {
      acquisition = {
        ...acquisition,
        landing_signals: (acquisition.landing_signals || 0) + 1,
        evidence_counts: bump(acquisition.evidence_counts || {}, normalized.evidence_class)
      };

      if (normalized.visitor_id) {
        const acquisitionFingerprint = await digest({ scope, visitor_id: normalized.visitor_id, lane: "acquisition" });
        const acquisitionStorageKey = `acquisition:${acquisitionFingerprint}`;
        const seenAcquisition = await this.ctx.storage.get(acquisitionStorageKey);
        if (!seenAcquisition) {
          await this.ctx.storage.put(acquisitionStorageKey, true);
          acquisition = {
            ...acquisition,
            identified_landing_signals: (acquisition.identified_landing_signals || 0) + 1,
            unique_growth_identities: (acquisition.unique_growth_identities || 0) + 1,
            non_automation_growth_identities: (acquisition.non_automation_growth_identities || 0) + (isAutomation ? 0 : 1),
            automation_growth_identities: (acquisition.automation_growth_identities || 0) + (isAutomation ? 1 : 0),
            source_counts: isAutomation ? (acquisition.source_counts || {}) : bump(acquisition.source_counts || {}, normalized.source),
            medium_counts: isAutomation ? (acquisition.medium_counts || {}) : bump(acquisition.medium_counts || {}, normalized.medium),
            content_counts: isAutomation ? (acquisition.content_counts || {}) : bump(acquisition.content_counts || {}, normalized.content),
            referrer_counts: isAutomation ? (acquisition.referrer_counts || {}) : bump(acquisition.referrer_counts || {}, normalized.referrer_host)
          };
        }
      } else {
        acquisition = {
          ...acquisition,
          unidentified_landing_signals: (acquisition.unidentified_landing_signals || 0) + 1
        };
      }
    }

    const seq = (current.seq || 0) + 1;
    const isProductEvidence = normalized.evidence_class === "server_authoritative" && !isAutomation;
    const recentEvents = [
      ...(current.recent_events || []),
      {
        event: normalized.event,
        seq,
        at,
        game_seq: normalized.game_seq,
        evidence_class: normalized.evidence_class,
        traffic_class: normalized.traffic_class,
        event_fingerprint: eventFingerprint
      }
    ].slice(-20);

    const summary = {
      ...current,
      measurement_version: ANALYTICS_TRUTH_VERSION,
      legacy_merged: false,
      scope,
      seq,
      unique_growth_identities: uniqueIdentities,
      unique_visitors: uniqueIdentities,
      counters: bump(current.counters || {}, normalized.event),
      product_counters: isProductEvidence ? bump(current.product_counters || {}, normalized.event) : (current.product_counters || {}),
      automation_counters: isAutomation ? bump(current.automation_counters || {}, normalized.event) : (current.automation_counters || {}),
      evidence_counts: bump(current.evidence_counts || {}, normalized.evidence_class),
      traffic_counts: bump(current.traffic_counts || {}, normalized.traffic_class),
      acquisition,
      first_at: current.first_at || at,
      last_at: at,
      recent_events: recentEvents
    };

    const receipt = {
      accepted: true,
      duplicate: false,
      measurement_version: ANALYTICS_TRUTH_VERSION,
      scope,
      seq,
      event_fingerprint: eventFingerprint,
      scope_fingerprint: scopeFingerprint,
      evidence_class: normalized.evidence_class,
      traffic_class: normalized.traffic_class,
      continuity_cookie: continuityCookie(scopeFingerprint, seq)
    };
    const nextRecentIds = [...recentIds, normalized.event_id].slice(-256);
    const evictedIds = recentIds.filter((eventId) => !nextRecentIds.includes(eventId));

    await this.ctx.storage.put({
      summary,
      recent_event_ids: nextRecentIds,
      [`receipt:${normalized.event_id}`]: receipt
    });
    if (evictedIds.length) {
      await this.ctx.storage.delete(evictedIds.map((eventId) => `receipt:${eventId}`));
    }

    return receipt;
  }
}
