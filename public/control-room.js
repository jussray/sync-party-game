const $ = (selector) => document.querySelector(selector);

const ui = {
  runtimeBadge: $("#runtimeBadge"),
  authorityBranch: $("#authorityBranch"),
  proofGate: $("#proofGate"),
  continuityState: $("#continuityState"),
  activeRooms: $("#activeRooms"),
  connectedPlayers: $("#connectedPlayers"),
  roomsObserved: $("#roomsObserved"),
  eventsRecorded: $("#eventsRecorded"),
  repoIdentity: $("#repoIdentity"),
  releaseGate: $("#releaseGate"),
  runtimeIdentity: $("#runtimeIdentity"),
  controlFingerprint: $("#controlFingerprint"),
  continuityCookie: $("#continuityCookie"),
  lastSignal: $("#lastSignal"),
  eventFeed: $("#eventFeed"),
  relayTarget: $("#relayTarget"),
  relayMode: $("#relayMode"),
  relayEndpoint: $("#relayEndpoint"),
  protectedExport: $("#protectedExport"),
  refreshButton: $("#refreshButton"),
  operatorKey: $("#operatorKey"),
  loadExportButton: $("#loadExportButton"),
  exportPreview: $("#exportPreview"),
  updatedAt: $("#updatedAt")
};

function fmtTime(value) {
  if (!value) return "never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

function short(value, size = 16) {
  if (!value) return "not-issued";
  return value.length > size ? `${value.slice(0, size)}…` : value;
}

function setRuntimeBadge(status) {
  ui.runtimeBadge.classList.remove("status-good", "status-warn", "status-bad");
  if (status === "VERIFIED") {
    ui.runtimeBadge.textContent = "RUNTIME VERIFIED";
    ui.runtimeBadge.classList.add("status-good");
    return;
  }
  ui.runtimeBadge.textContent = status === "ERROR" ? "RUNTIME ERROR" : "LOCAL / UNVERIFIED";
  ui.runtimeBadge.classList.add(status === "ERROR" ? "status-bad" : "status-warn");
}

function renderEvents(events = []) {
  if (!events.length) {
    ui.eventFeed.innerHTML = '<div class="empty-state">Create or join a game and Sync will write privacy-safe lifecycle receipts here.</div>';
    return;
  }

  ui.eventFeed.innerHTML = events.slice().reverse().slice(0, 14).map((event) => `
    <div class="event-row">
      <div class="event-name">${event.event || "UNKNOWN"}</div>
      <div class="event-meta">room ${short(event.room_fingerprint, 10)} · ${event.phase || "unknown"} · ${event.connected_players ?? 0} connected</div>
      <div class="event-time">${fmtTime(event.at)}</div>
    </div>
  `).join("");
}

function render(envelope) {
  const runtime = envelope.runtime || {};
  const authority = envelope.authority || {};
  const proof = envelope.proof || {};
  const relay = envelope.relay || {};
  const control = envelope.control || {};

  setRuntimeBadge(runtime.status);
  ui.authorityBranch.textContent = `${authority.source_branch || "main"} → ${authority.production_branch || "production"}`;
  ui.proofGate.textContent = proof.required || "Playwright";
  ui.continuityState.textContent = control.continuity_cookie ? `seq ${control.seq || 0}` : "No signals yet";
  ui.activeRooms.textContent = String(control.active_rooms || 0);
  ui.connectedPlayers.textContent = String(control.connected_players || 0);
  ui.roomsObserved.textContent = String(control.rooms_observed || 0);
  ui.eventsRecorded.textContent = String(control.events_recorded || 0);
  ui.repoIdentity.textContent = authority.repository || "jussray/sync-party-game";
  ui.releaseGate.textContent = authority.release_gate || "core-proof → production";
  ui.runtimeIdentity.textContent = runtime.sha
    ? `${runtime.sha.slice(0, 12)} · build ${runtime.build || "unknown"}`
    : "Local runtime or deploy identity not injected";
  ui.controlFingerprint.textContent = control.control_fingerprint || "not-issued";
  ui.continuityCookie.textContent = control.continuity_cookie || "not-issued";
  ui.lastSignal.textContent = control.last_at ? `Last signal ${fmtTime(control.last_at)}` : "No signals yet";
  ui.relayTarget.textContent = relay.target || "Founder Control Room";
  ui.relayMode.textContent = relay.mode || "privacy-safe-pull";
  ui.relayEndpoint.textContent = relay.endpoint || "/api/control-room/snapshot";
  ui.protectedExport.textContent = relay.protected_export_configured ? "Configured" : "Not configured";
  ui.protectedExport.style.color = relay.protected_export_configured ? "var(--good)" : "var(--muted)";
  renderEvents(control.recent_events || []);
  ui.updatedAt.textContent = `Refreshed ${fmtTime(envelope.generated_at || Date.now())}`;
}

async function refresh() {
  ui.refreshButton.disabled = true;
  ui.refreshButton.textContent = "Refreshing…";
  try {
    const response = await fetch("/api/control-room/snapshot", { headers: { accept: "application/json" }, cache: "no-store" });
    if (!response.ok) throw new Error(`Control snapshot failed (${response.status})`);
    render(await response.json());
  } catch (error) {
    setRuntimeBadge("ERROR");
    ui.runtimeIdentity.textContent = error.message || "Control room unavailable";
  } finally {
    ui.refreshButton.disabled = false;
    ui.refreshButton.textContent = "Refresh now";
  }
}

async function loadExport() {
  const key = ui.operatorKey.value.trim();
  if (!key) {
    ui.exportPreview.textContent = "Enter the configured read key first.";
    return;
  }

  ui.loadExportButton.disabled = true;
  ui.loadExportButton.textContent = "Loading…";
  try {
    const response = await fetch("/api/control-room/export", {
      headers: {
        accept: "application/json",
        "x-sync-control-room-key": key
      },
      cache: "no-store"
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `Protected export failed (${response.status})`);
    ui.exportPreview.textContent = JSON.stringify(body, null, 2);
  } catch (error) {
    ui.exportPreview.textContent = error.message || "Protected export unavailable.";
  } finally {
    ui.loadExportButton.disabled = false;
    ui.loadExportButton.textContent = "Load export";
  }
}

ui.refreshButton.addEventListener("click", refresh);
ui.loadExportButton.addEventListener("click", loadExport);

await refresh();
setInterval(refresh, 10_000);
