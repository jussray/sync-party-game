const $ = (selector) => document.querySelector(selector);

const ui = {
  growthKey: $("#growthKey"),
  campaign: $("#campaign"),
  loadButton: $("#loadButton"),
  status: $("#status"),
  results: $("#results"),
  uniqueVisitors: $("#uniqueVisitors"),
  landingViews: $("#landingViews"),
  playIntent: $("#playIntent"),
  roomsCreated: $("#roomsCreated"),
  roomsJoined: $("#roomsJoined"),
  gamesStarted: $("#gamesStarted"),
  gamesFinished: $("#gamesFinished"),
  rematches: $("#rematches"),
  funnelLanding: $("#funnelLanding"),
  funnelPlay: $("#funnelPlay"),
  funnelCreate: $("#funnelCreate"),
  funnelStart: $("#funnelStart"),
  funnelFinish: $("#funnelFinish"),
  barLanding: $("#barLanding"),
  barPlay: $("#barPlay"),
  barCreate: $("#barCreate"),
  barStart: $("#barStart"),
  barFinish: $("#barFinish"),
  campaignMeta: $("#campaignMeta"),
  firstSeen: $("#firstSeen"),
  lastSeen: $("#lastSeen"),
  sequenceMeta: $("#sequenceMeta")
};

function count(summary, key) {
  const value = Number(summary?.counters?.[key] || 0);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function fmtTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function width(value, max) {
  if (!max || !value) return value > 0 ? "2%" : "0%";
  return `${Math.max(2, Math.min(100, (value / max) * 100))}%`;
}

function setStatus(message, kind = "") {
  ui.status.textContent = message;
  ui.status.classList.remove("good", "bad");
  if (kind) ui.status.classList.add(kind);
}

function render(summary) {
  const landing = count(summary, "landing_view");
  const play = count(summary, "play_intent");
  const created = count(summary, "room_created");
  const joined = count(summary, "room_joined");
  const started = count(summary, "game_started");
  const finished = count(summary, "game_finished");
  const rematch = count(summary, "rematch_started");
  const uniqueVisitors = Number(summary?.unique_visitors || 0);
  const max = Math.max(landing, play, created, started, finished, 1);

  ui.uniqueVisitors.textContent = String(Number.isFinite(uniqueVisitors) ? uniqueVisitors : 0);
  ui.landingViews.textContent = String(landing);
  ui.playIntent.textContent = String(play);
  ui.roomsCreated.textContent = String(created);
  ui.roomsJoined.textContent = String(joined);
  ui.gamesStarted.textContent = String(started);
  ui.gamesFinished.textContent = String(finished);
  ui.rematches.textContent = String(rematch);

  ui.funnelLanding.textContent = String(landing);
  ui.funnelPlay.textContent = String(play);
  ui.funnelCreate.textContent = String(created);
  ui.funnelStart.textContent = String(started);
  ui.funnelFinish.textContent = String(finished);

  ui.barLanding.style.width = width(landing, max);
  ui.barPlay.style.width = width(play, max);
  ui.barCreate.style.width = width(created, max);
  ui.barStart.style.width = width(started, max);
  ui.barFinish.style.width = width(finished, max);

  ui.campaignMeta.textContent = `campaign: ${summary?.campaign_key || "unattributed"}`;
  ui.firstSeen.textContent = `first signal: ${fmtTime(summary?.first_at)}`;
  ui.lastSeen.textContent = `last signal: ${fmtTime(summary?.last_at)}`;
  ui.sequenceMeta.textContent = `events: ${Number(summary?.seq || 0)}`;
  ui.results.hidden = false;

  const actualUse = created + joined + started + finished + rematch;
  if (actualUse > 0) {
    setStatus("Yes — SYNC has recorded real gameplay activity in this ledger.", "good");
  } else if (landing > 0 || play > 0 || uniqueVisitors > 0) {
    setStatus("SYNC has recorded visitors or play attempts, but no gameplay event is recorded in this ledger yet.", "good");
  } else {
    setStatus("No usage events are recorded in this ledger yet.", "good");
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
  setStatus("Reading the protected growth ledger…");

  try {
    const response = await fetch(`/api/growth/summary${query}`, {
      headers: {
        accept: "application/json",
        "x-growth-read-key": key
      },
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
    ui.loadButton.textContent = "Load usage";
  }
}

ui.loadButton.addEventListener("click", loadUsage);
ui.growthKey.addEventListener("keydown", (event) => {
  if (event.key === "Enter") loadUsage();
});
ui.campaign.addEventListener("keydown", (event) => {
  if (event.key === "Enter") loadUsage();
});
