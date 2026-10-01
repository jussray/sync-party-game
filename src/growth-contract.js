const TOKEN = /^[A-Za-z0-9._:/-]{1,160}$/;
const VISITOR_ID = /^[A-Za-z0-9._:-]{8,160}$/;

export const ANALYTICS_TRUTH_VERSION = "analytics-truth-v2";

export const GROWTH_EVENTS = Object.freeze([
  "landing_view",
  "play_intent",
  "room_created",
  "room_joined",
  "game_started",
  "game_finished",
  "rematch_started",
  "player_game_started",
  "player_game_finished",
  "player_rematch_started"
]);

export const PUBLIC_GROWTH_EVENTS = Object.freeze([
  "landing_view",
  "play_intent"
]);

export const EVIDENCE_CLASSES = Object.freeze([
  "browser_signal",
  "automation_likely",
  "unverified_client",
  "server_authoritative"
]);

export const TRAFFIC_CLASSES = Object.freeze([
  "browser_signal",
  "automation_likely",
  "unverified_client"
]);

const EVENT_SET = new Set(GROWTH_EVENTS);
const PUBLIC_EVENT_SET = new Set(PUBLIC_GROWTH_EVENTS);
const EVIDENCE_SET = new Set(EVIDENCE_CLASSES);
const TRAFFIC_SET = new Set(TRAFFIC_CLASSES);

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

export function classifyClientTraffic(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const userAgent = string(source.user_agent ?? source.userAgent, 500).toLowerCase();
  const secFetchSite = string(source.sec_fetch_site ?? source.secFetchSite, 80).toLowerCase();
  const secChUa = string(source.sec_ch_ua ?? source.secChUa, 500).toLowerCase();

  const automationPattern = /(bot\b|crawler|spider|headless|playwright|lighthouse|selenium|phantomjs|scrapy|python-requests|httpclient|curl\/|wget\/|google-inspectiontool|facebookexternalhit|slackbot|discordbot)/i;
  if (automationPattern.test(userAgent) || automationPattern.test(secChUa)) return "automation_likely";

  const browserPattern = /(mozilla\/|applewebkit\/|chrome\/|chromium\/|safari\/|firefox\/|edg\/)/i;
  if (browserPattern.test(userAgent) || secChUa || ["same-origin", "same-site", "cross-site", "none"].includes(secFetchSite)) {
    return "browser_signal";
  }

  return "unverified_client";
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
  const trafficClass = string(source.traffic_class, 40);
  return {
    visitor_id: id(source.visitor_id),
    session_id: id(source.session_id),
    ...normalizeGrowthContext(source),
    traffic_class: TRAFFIC_SET.has(trafficClass) ? trafficClass : null
  };
}

export function campaignKey(input = {}) {
  const normalized = "campaign_id" in input ? input : normalizeGrowthEnvelope(input);
  return normalized.campaign_id || "unattributed";
}

export function normalizeGrowthEvent(input = {}, options = {}) {
  const source = input && typeof input === "object" ? input : {};
  const { publicOnly = false, evidenceClass = null, preserveEvidence = false } = options;
  const event = token(source.event, 40);
  if (!event || !EVENT_SET.has(event)) throw new Error("Unknown growth event");
  if (publicOnly && !PUBLIC_EVENT_SET.has(event)) throw new Error("Growth event is server-authoritative");

  const envelope = normalizeGrowthEnvelope(source.growth ?? source.context ?? source);
  const eventId = id(source.event_id);
  const gameSeq = Number.isInteger(source.game_seq) && source.game_seq >= 0 ? source.game_seq : null;

  let trafficClass = envelope.traffic_class || "unverified_client";
  let evidence;
  if (preserveEvidence) {
    const candidateEvidence = string(source.evidence_class, 40);
    evidence = EVIDENCE_SET.has(candidateEvidence) ? candidateEvidence : "unverified_client";
    const candidateTraffic = string(source.traffic_class, 40);
    if (TRAFFIC_SET.has(candidateTraffic)) trafficClass = candidateTraffic;
  } else if (publicOnly) {
    const candidate = string(evidenceClass, 40);
    trafficClass = TRAFFIC_SET.has(candidate) ? candidate : "unverified_client";
    evidence = trafficClass;
  } else {
    evidence = "server_authoritative";
  }

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
    evidence_class: evidence,
    traffic_class: trafficClass,
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
    evidence_class: record.evidence_class,
    traffic_class: record.traffic_class,
    game_seq: record.game_seq
  };
}
