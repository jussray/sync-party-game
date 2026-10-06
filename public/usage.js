const $ = (selector) => document.querySelector(selector);

const ui = {
  growthKey: $("#growthKey"),
  campaign: $("#campaign"),
  loadButton: $("#loadButton"),
  status: $("#status"),
  results: $("#results"),
  measurementMeta: $("#measurementMeta"),
  scopeMeta: $("#scopeMeta"),
  firstSeen: $("#firstSeen"),
  lastSeen: $("#lastSeen"),
  sequenceMeta: $("#sequenceMeta"),
  identities: $("#identities"),
  landingSignals: $("#landingSignals"),
  browserSignals: $("#browserSignals"),
  automationSignals: $("#automationSignals"),
  unverifiedSignals: $("#unverifiedSignals"),
  roomsCreated: $("#roomsCreated"),
  playersJoined: $("#playersJoined"),
  gamesStarted: $("#gamesStarted"),
  gamesFinished: $("#gamesFinished"),
  rematches: $("#rematches"),
  participantStarts: $("#participantStarts"),
  participantFinishes: $("#participantFinishes"),
  participantRematches: $("#participantRematches"),
  sourceBreakdown: $("#sourceBreakdown"),
  mediumBreakdown: $("#mediumBreakdown"),
  referrerBreakdown: $("#referrerBreakdown"),
  acquisitionEvidence: $("#acquisitionEvidence")
};

function count(record, key) {
  const value = Number(record?.[key] || 0);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function fmtTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function setStatus(message, kind = "") {
  ui.status.textContent = message;
  ui.status.classList.remove("good", "bad");
  if (kind) ui.status.classList.add(kind);
}

function pairs(record = {}) {
  return Object.entries(record)
    .filter(([, value]) => Number(value) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]));
}

function renderBreakdown(target, record, empty = "No classified signals yet.") {
  const items = pairs(record);
  target.innerHTML = items.length
    ? items.map(([key, value]) => `<li><span>${escapeHtml(key)}</span><strong>${Number(value)}</strong></li>`).join("")
    : `<li class="empty">${empty}</li>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function render(summary) {
  const product = summary?.product_counters || {};
  const traffic = summary?.traffic_counts || {};
  const acquisition = summary?.acquisition || {};
  const acquisitionEvidence = acquisition?.evidence_counts || {};

  ui.identities.textContent = String(Number(summary?.unique_growth_identities || 0));
  ui.landingSignals.textContent = String(count(acquisition, "landing_signals"));
  ui.browserSignals.textContent = String(count(traffic, "browser_signal"));
  ui.automationSignals.textContent = String(count(traffic, "automation_likely"));
  ui.unverifiedSignals.textContent = String(count(traffic, "unverified_client"));

  ui.roomsCreated.textContent = String(count(product, "room_created"));
  ui.playersJoined.textContent = String(count(product, "room_joined"));
  ui.gamesStarted.textContent = String(count(product, "game_started"));
  ui.gamesFinished.textContent = String(count(product, "game_finished"));
  ui.rematches.textContent = String(count(product, "rematch_started"));
  ui.participantStarts.textContent = String(count(product, "player_game_started"));
  ui.participantFinishes.textContent = String(count(product, "player_game_finished"));
  ui.participantRematches.textContent = String(count(product, "player_rematch_started"));

  renderBreakdown(ui.sourceBreakdown, acquisition.source_counts, "No attributable source identities yet.");
  renderBreakdown(ui.mediumBreakdown, acquisition.medium_counts, "No attributable medium identities yet.");
  renderBreakdown(ui.referrerBreakdown, acquisition.referrer_counts, "No attributable referrer identities yet.");
  renderBreakdown(ui.acquisitionEvidence, acquisitionEvidence, "No landing evidence yet.");

  ui.measurementMeta.textContent = `measurement: ${summary?.measurement_version || "unknown"} · legacy merged: ${summary?.legacy_merged === true ? "yes" : "no"}`;
  ui.scopeMeta.textContent = `scope: ${summary?.scope?.type || "unknown"}${summary?.scope?.key ? ` / ${summary.scope.key}` : ""}`;
  ui.firstSeen.textContent = `first signal: ${fmtTime(summary?.first_at)}`;
  ui.lastSeen.textContent = `last signal: ${fmtTime(summary?.last_at)}`;
  ui.sequenceMeta.textContent = `events: ${Number(summary?.seq || 0)}`;
  ui.results.hidden = false;

  const authoritativeUse = count(product, "room_created") + count(product, "room_joined") + count(product, "game_started") + count(product, "game_finished") + count(product, "rematch_started");
  if (authoritativeUse > 0) {
    setStatus("SERVER VERIFIED product activity is recorded. Automation-likely activity is excluded from these product counters.", "good");
  } else if (count(acquisition, "landing_signals") > 0) {
    setStatus("Traffic signals are recorded, but no non-automation server-authoritative product activity is recorded in this scope yet.", "good");
  } else {
    setStatus("No Analytics Truth V2 signals are recorded in this scope yet. Legacy data is intentionally not merged.", "good");
  }
}

async function loadUsage() {
  const key = ui.growthKey.value.trim();
  if (!key) {
    setStatus("Paste the configured growth read key first.", "bad");
    return;
  }

  const campaign = ui.campaign.value.trim();
  const query = campaign ? `?campaign=${encodeURIComponent(campaign)}` : "";

  ui.loadButton.disabled = true;
  ui.loadButton.textContent = "Loading…";
  setStatus("Reading Analytics Truth V2…");

  try {
    const response = await fetch(`/api/growth/summary${query}`, {
      headers: { accept: "application/json", "x-growth-read-key": key },
      cache: "no-store"
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 401) throw new Error("That read key was rejected.");
      if (response.status === 503) throw new Error("Growth analytics are not configured in the deployed runtime yet.");
      throw new Error(body.error || `Usage lookup failed (${response.status}).`);
    }

    render(body);
  } catch (error) {
    ui.results.hidden = true;
    setStatus(error.message || "Usage lookup failed.", "bad");
  } finally {
    ui.loadButton.disabled = false;
    ui.loadButton.textContent = "Load truth";
  }
}

ui.loadButton.addEventListener("click", loadUsage);
ui.growthKey.addEventListener("keydown", (event) => { if (event.key === "Enter") loadUsage(); });
ui.campaign.addEventListener("keydown", (event) => { if (event.key === "Enter") loadUsage(); });
