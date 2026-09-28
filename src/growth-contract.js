const TOKEN = /^[A-Za-z0-9._:/-]{1,160}$/;
const VISITOR_ID = /^[A-Za-z0-9._:-]{8,160}$/;

export const GROWTH_EVENTS = Object.freeze([
  "landing_view",
  "play_intent",
  "room_created",
  "room_joined",
  "game_started",
  "game_finished",
  "rematch_started"
]);

export const PUBLIC_GROWTH_EVENTS = Object.freeze([
  "landing_view",
  "play_intent"
]);

const EVENT_SET = new Set(GROWTH_EVENTS);
const PUBLIC_EVENT_SET = new Set(PUBLIC_GROWTH_EVENTS);

function string(value, max = 160) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function token(value, max = 160) {
  const raw = string(value, max);
  if (!raw) return null;
  const normalized = raw
    .toLowerCase()
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._:/-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^[-./:]+|[-./:]+$/g, "");
  return normalized && TOKEN.test(normalized) ? normalized : null;
}

function id(value) {
  const raw = string(value, 160);
  return raw && VISITOR_ID.test(raw) ? raw : null;
}

function referrerHost(value) {
  const raw = string(value, 500);
  if (!raw) return null;
  try {
    const url = raw.includes("://") ? new URL(raw) : new URL(`https://${raw}`);
    return token(url.hostname, 160);
  } catch {
    return null;
  }
}

export function normalizeGrowthContext(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  return {
    campaign_id: token(source.campaign_id ?? source.utm_campaign, 120),
    source: token(source.source ?? source.utm_source, 80),
    medium: token(source.medium ?? source.utm_medium, 80),
    content: token(source.content ?? source.utm_content, 120),
    referrer_host: referrerHost(source.referrer_host ?? source.referrer)
  };
}

export function normalizeGrowthEnvelope(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  return {
    visitor_id: id(source.visitor_id),
    session_id: id(source.session_id),
    ...normalizeGrowthContext(source)
  };
}

export function campaignKey(input = {}) {
  const normalized = "campaign_id" in input ? input : normalizeGrowthEnvelope(input);
  return normalized.campaign_id || "unattributed";
}

export function normalizeGrowthEvent(input = {}, { publicOnly = false } = {}) {
  const source = input && typeof input === "object" ? input : {};
  const event = token(source.event, 40);
  if (!event || !EVENT_SET.has(event)) throw new Error("Unknown growth event");
  if (publicOnly && !PUBLIC_EVENT_SET.has(event)) throw new Error("Growth event is server-authoritative");

  const envelope = normalizeGrowthEnvelope(source.growth ?? source.context ?? source);
  const eventId = id(source.event_id);
  const gameSeq = Number.isInteger(source.game_seq) && source.game_seq >= 0 ? source.game_seq : null;

  return {
    event,
    event_id: eventId,
    visitor_id: envelope.visitor_id,
    session_id: envelope.session_id,
    campaign_id: envelope.campaign_id,
    source: envelope.source,
    medium: envelope.medium,
    content: envelope.content,
    referrer_host: envelope.referrer_host,
    game_seq: gameSeq
  };
}

export function canonicalGrowthIdentity(record) {
  return {
    event: record.event,
    event_id: record.event_id,
    visitor_id: record.visitor_id,
    session_id: record.session_id,
    campaign_id: record.campaign_id,
    source: record.source,
    medium: record.medium,
    content: record.content,
    referrer_host: record.referrer_host,
    game_seq: record.game_seq
  };
}
