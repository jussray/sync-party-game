import { DurableObject } from "cloudflare:workers";
import { campaignKey, canonicalGrowthIdentity, normalizeGrowthEvent } from "./growth-contract.js";

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

function continuityCookie(campaignFingerprint, seq) {
  return `growth-v1.${campaignFingerprint.slice(0, 16)}.${seq}`;
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
        return json(await this.record(body));
      } catch (error) {
        return json({ error: error.message || "Invalid growth event" }, { status: 400 });
      }
    }

    if (url.pathname === "/internal/summary" && request.method === "GET") {
      const summary = await this.ctx.storage.get("summary");
      return json(summary || {
        campaign_key: "unattributed",
        campaign_fingerprint: null,
        seq: 0,
        unique_visitors: 0,
        counters: {},
        source_counts: {},
        medium_counts: {},
        content_counts: {},
        first_at: null,
        last_at: null,
        recent_events: []
      });
    }

    return new Response("Not found", { status: 404 });
  }

  async record(input) {
    const normalized = normalizeGrowthEvent({
      ...input,
      event_id: input?.event_id || crypto.randomUUID()
    });
    const key = campaignKey(normalized);
    const at = Date.now();
    const eventFingerprint = await digest(canonicalGrowthIdentity(normalized));
    const campaignFingerprint = await digest({ campaign_key: key });

    const recentIds = (await this.ctx.storage.get("recent_event_ids")) || [];
    const current = (await this.ctx.storage.get("summary")) || {
      campaign_key: key,
      campaign_fingerprint: campaignFingerprint,
      seq: 0,
      unique_visitors: 0,
      counters: {},
      source_counts: {},
      medium_counts: {},
      content_counts: {},
      first_at: at,
      last_at: null,
      recent_events: []
    };

    if (recentIds.includes(normalized.event_id)) {
      const storedReceipt = await this.ctx.storage.get(`receipt:${normalized.event_id}`);
      if (storedReceipt) return { ...storedReceipt, accepted: true, duplicate: true };

      const receiptCampaignFingerprint = current.campaign_fingerprint || campaignFingerprint;
      const duplicateSeq = inferDuplicateSeq(current, eventFingerprint);
      const legacyReceipt = {
        accepted: true,
        duplicate: true,
        seq: duplicateSeq,
        event_fingerprint: eventFingerprint,
        campaign_fingerprint: receiptCampaignFingerprint,
        continuity_cookie: continuityCookie(receiptCampaignFingerprint, duplicateSeq)
      };
      await this.ctx.storage.put(`receipt:${normalized.event_id}`, legacyReceipt);
      return legacyReceipt;
    }

    let uniqueVisitors = current.unique_visitors || 0;
    if (normalized.visitor_id) {
      const visitorFingerprint = await digest({ campaign_key: key, visitor_id: normalized.visitor_id });
      const visitorStorageKey = `visitor:${visitorFingerprint}`;
      const seen = await this.ctx.storage.get(visitorStorageKey);
      if (!seen) {
        await this.ctx.storage.put(visitorStorageKey, true);
        uniqueVisitors += 1;
      }
    }

    const seq = (current.seq || 0) + 1;
    const recentEvents = [
      ...(current.recent_events || []),
      {
        event: normalized.event,
        event_id: normalized.event_id,
        seq,
        at,
        game_seq: normalized.game_seq,
        event_fingerprint: eventFingerprint
      }
    ].slice(-20);

    const summary = {
      ...current,
      campaign_key: key,
      campaign_fingerprint: campaignFingerprint,
      seq,
      unique_visitors: uniqueVisitors,
      counters: bump(current.counters || {}, normalized.event),
      source_counts: bump(current.source_counts || {}, normalized.source),
      medium_counts: bump(current.medium_counts || {}, normalized.medium),
      content_counts: bump(current.content_counts || {}, normalized.content),
      first_at: current.first_at || at,
      last_at: at,
      recent_events: recentEvents
    };

    const continuity_cookie = continuityCookie(campaignFingerprint, seq);
    const receipt = {
      accepted: true,
      duplicate: false,
      seq,
      event_fingerprint: eventFingerprint,
      campaign_fingerprint: campaignFingerprint,
      continuity_cookie
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
