const PROD_API = "https://sync-party-game.mcgill-raylene.workers.dev";
const mirrored = location.hostname.endsWith(".chatgpt.site");
const apiBase = mirrored ? PROD_API : location.origin;
const sdkUrl = mirrored ? `${PROD_API}/sync-client.js` : "/sync-client.js";
const { createSyncClient } = await import(sdkUrl);

const client = createSyncClient({ baseUrl: apiBase, surface: "chat" });
const CHAT_PATH = "/chat/index.html";
const app = document.querySelector("#chatApp");
const toast = document.querySelector("#chatToast");

let socket = null;
let state = null;
let manifest = null;
let timerHandle = null;
let serverOffset = 0;

const roomKey = (code) => `sync.chat.room.${String(code || "").toUpperCase()}`;

function notify(message) {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1800);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[char]));
}

function saveIdentity(code, identity) {
  localStorage.setItem(roomKey(code), JSON.stringify(identity));
}

function loadIdentity(code) {
  try { return JSON.parse(localStorage.getItem(roomKey(code))); } catch { return null; }
}

function stopConnection() {
  clearInterval(timerHandle);
  timerHandle = null;
  if (socket) {
    socket.onclose = null;
    socket.close();
    socket = null;
  }
}

function shell(body, options = {}) {
  const fingerprint = manifest?.fingerprint ? manifest.fingerprint.slice(0, 12) : "loading";
  app.innerHTML = `
    <section class="chat-frame" data-surface="chat">
      <header class="chat-topbar">
        <div class="brand"><span class="brand-mark">✦</span><span>SYNC // CHAT EDITION</span></div>
        <span class="surface-pill">same room brain · different vibe</span>
        <span class="fingerprint">surface ${escapeHtml(fingerprint)}</span>
      </header>
      <div class="thread">${body}</div>
    </section>`;
  document.querySelector("#goHome")?.addEventListener("click", () => {
    stopConnection();
    history.pushState({}, "", CHAT_PATH);
    renderHome();
  });
  if (options.after) options.after();
}

function renderHome() {
  stopConnection();
  state = null;
  shell(`
    <article class="bubble">
      <p class="eyebrow">Chat surface · independent presentation</p>
      <h1>Same game.<br>Different mood.</h1>
      <p class="copy">Create or join the exact same SYNC rooms as the Cloudflare edition. This surface can change its look, copy and surface-only features without changing game authority.</p>
    </article>
    <article class="bubble you">
      <h2>What are we doing?</h2>
      <div class="action-grid">
        <button id="showCreate" class="btn primary" type="button">Create a room ✦</button>
        <button id="showJoin" class="btn" type="button">Join with a code</button>
      </div>
      <p class="local-only">This conversation layout is Chat Edition only. Scores, rounds and room state still come from the shared Durable Object.</p>
    </article>
  `, {
    after() {
      document.querySelector("#showCreate").addEventListener("click", renderCreate);
      document.querySelector("#showJoin").addEventListener("click", renderJoin);
    }
  });
}

function renderCreate() {
  shell(`
    <article class="bubble"><button id="goHome" class="link-btn" type="button">← back</button><h2 style="margin-top:14px">Start a room</h2><p class="copy">You host. Your friends can join from either SYNC surface.</p></article>
    <article class="bubble you">
      <form id="createForm" class="form-grid">
        <div class="field"><label for="hostName">Nickname</label><input id="hostName" class="input" maxlength="18" autocomplete="nickname" required /></div>
        <button class="btn primary" type="submit">Create room</button>
      </form>
    </article>
  `, {
    after() {
      document.querySelector("#createForm").addEventListener("submit", async (event) => {
        event.preventDefault();
        const name = document.querySelector("#hostName").value.trim();
        try {
          const room = await client.createRoom({ name });
          saveIdentity(room.code, { code: room.code, playerId: room.playerId, resumeToken: room.resumeToken, name });
          history.pushState({}, "", `${CHAT_PATH}?room=${room.code}`);
          connect(room.code);
        } catch (error) { notify(error.message); }
      });
    }
  });
}

function renderJoin() {
  shell(`
    <article class="bubble"><button id="goHome" class="link-btn" type="button">← back</button><h2 style="margin-top:14px">Join a room</h2><p class="copy">Codes work across Cloudflare Edition and Chat Edition.</p></article>
    <article class="bubble you">
      <form id="joinForm" class="form-grid">
        <div class="field"><label for="joinCode">Room code</label><input id="joinCode" class="input" maxlength="5" autocomplete="off" required /></div>
        <div class="field"><label for="joinName">Nickname</label><input id="joinName" class="input" maxlength="18" autocomplete="nickname" required /></div>
        <button class="btn rose" type="submit">Join room</button>
      </form>
    </article>
  `, {
    after() {
      document.querySelector("#joinForm").addEventListener("submit", async (event) => {
        event.preventDefault();
        const code = document.querySelector("#joinCode").value.trim().toUpperCase();
        const name = document.querySelector("#joinName").value.trim();
        try {
          const room = await client.joinRoom({ code, name });
          saveIdentity(code, { code, playerId: room.playerId, resumeToken: room.resumeToken, name });
          history.pushState({}, "", `${CHAT_PATH}?room=${code}`);
          connect(code);
        } catch (error) { notify(error.message); }
      });
    }
  });
}

function connect(code) {
  stopConnection();
  const me = loadIdentity(code);
  if (!me) {
    notify("Join or create this room first.");
    history.replaceState({}, "", CHAT_PATH);
    return renderHome();
  }

  shell(`<article class="bubble"><p class="eyebrow">Connecting</p><h2>Finding room ${escapeHtml(code)}…</h2></article>`);
  socket = client.connect({ code, playerId: me.playerId, resumeToken: me.resumeToken });
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.type === "STATE") {
      state = message.state;
      serverOffset = message.serverTime - Date.now();
      renderRoom(code, me);
    }
    if (message.type === "ERROR") notify(message.error);
  };
  socket.onclose = () => {
    const active = new URLSearchParams(location.search).get("room")?.toUpperCase();
    if (active === code) setTimeout(() => connect(code), 900);
  };
}

function send(type, payload = {}) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type, ...payload }));
}

function renderRoom(code, me) {
  clearInterval(timerHandle);
  timerHandle = null;
  if (!state) return;
  if (state.phase === "lobby") return renderLobby(code, me);
  if (state.phase === "choosing") return renderChoosing(code, me);
  if (state.phase === "reveal") return renderReveal(code, me);
  if (state.phase === "results") return renderResults(code, me);
}

function renderLobby(code, me) {
  const connected = state.players.filter((player) => player.connected);
  const players = state.players.map((player) => `
    <span class="player-chip ${player.id === state.hostId ? "host" : ""}">
      ${escapeHtml(player.name)}${player.connected ? "" : " · reconnecting"}
    </span>`).join("");

  shell(`
    <article class="bubble">
      <p class="eyebrow">Room ready</p>
      <p class="copy">Send this code to either version of SYNC.</p>
      <div class="room-code">${escapeHtml(state.code)}</div>
      <div class="player-list">${players}</div>
      <div class="meta-row"><span>${connected.length} connected</span><span>${state.players.length}/8 joined</span></div>
    </article>
    <article class="bubble you">
      <h2>${me.playerId === state.hostId ? "You’re hosting." : "You’re in."}</h2>
      <p class="copy">${me.playerId === state.hostId ? "Start when at least two people are connected." : "Waiting for the host to start."}</p>
      ${me.playerId === state.hostId ? `<button id="startGame" class="btn primary" type="button" ${connected.length < 2 ? "disabled" : ""}>Start game</button>` : ""}
      <p class="local-only">Chat Edition shows the room as a thread. The other surface can render the exact same state however it wants.</p>
    </article>
  `, {
    after() {
      document.querySelector("#startGame")?.addEventListener("click", () => send("START_GAME"));
    }
  });
}

function renderChoosing(code, me) {
  const locked = Boolean(state.answers?.[me.playerId]);
  const choices = state.prompt.choices.map((choice, index) => `
    <button class="choice ${state.answers?.[me.playerId] === index ? "selected" : ""}" data-choice="${index}" ${locked ? "disabled" : ""}>
      ${escapeHtml(choice)}
    </button>`).join("");

  shell(`
    <article class="bubble">
      <div class="meta-row"><span>Round ${state.roundIndex + 1} of ${state.rounds} · ${escapeHtml(state.mode?.label || "SYNC")}</span><span id="chatTimer" class="timer">15s</span></div>
      <p class="eyebrow" style="margin-top:18px">${escapeHtml(state.mode?.instruction || "Read the room.")}</p>
      <h2 class="prompt">${escapeHtml(state.prompt.text)}</h2>
      <div class="choices">${choices}</div>
    </article>
    <article class="bubble you"><p class="copy" id="lockCopy">${locked ? "✓ Your pick is locked. Nobody else can see it yet." : "Pick privately. Reveal happens from the shared game state."}</p></article>
  `, {
    after() {
      document.querySelectorAll(".choice").forEach((button) => button.addEventListener("click", () => {
        document.querySelectorAll(".choice").forEach((item) => { item.disabled = true; });
        button.classList.add("selected");
        document.querySelector("#lockCopy").textContent = "✓ Your pick is locked. Nobody else can see it yet.";
        send("SUBMIT_CHOICE", { choiceIndex: Number(button.dataset.choice) });
      }));
      updateTimer(state.deadline);
      timerHandle = setInterval(() => updateTimer(state.deadline), 200);
    }
  });
}

function updateTimer(deadline) {
  const timer = document.querySelector("#chatTimer");
  if (!timer) return;
  const ms = Math.max(0, deadline - (Date.now() + serverOffset));
  timer.textContent = `${Math.ceil(ms / 1000)}s`;
}

function renderReveal(code, me) {
  const total = Math.max(1, state.lastResults?.totalAnswers || Object.keys(state.answers || {}).length);
  const rows = state.prompt.choices.map((choice, index) => {
    const count = state.lastResults?.counts?.[index] || 0;
    return `<div class="result-row"><span>${escapeHtml(choice)}</span><strong>${count}/${total}</strong></div>`;
  }).join("");
  const mine = state.answers?.[me.playerId];

  shell(`
    <article class="bubble">
      <p class="eyebrow">Reveal · round ${state.roundIndex + 1}</p>
      <div class="sync-score">${state.lastResults?.syncPercent || 0}% <small style="font-size:14px;color:var(--muted)">room sync</small></div>
      <div class="result-grid">${rows}</div>
    </article>
    <article class="bubble you">
      <h2>Your answer</h2>
      <p class="copy">${mine === undefined ? "No pick this round." : escapeHtml(state.prompt.choices[mine])}</p>
      ${me.playerId === state.hostId ? `<button id="nextRound" class="btn primary" type="button">${state.roundIndex + 1 >= state.rounds ? "See final scores" : "Next round"}</button>` : `<p class="copy">Waiting for the host…</p>`}
    </article>
  `, {
    after() {
      document.querySelector("#nextRound")?.addEventListener("click", () => send("NEXT_ROUND"));
    }
  });
}

function renderResults(code, me) {
  const ranking = [...state.players].sort((a, b) => (state.scores?.[b.id] || 0) - (state.scores?.[a.id] || 0));
  const rows = ranking.map((player, index) => `
    <div class="rank-row"><b>${index + 1}</b><span>${escapeHtml(player.name)}${player.id === me.playerId ? " · you" : ""}</span><strong>${state.scores?.[player.id] || 0}</strong></div>`).join("");
  const roomSync = state.syncHistory?.length
    ? Math.round(state.syncHistory.reduce((sum, value) => sum + value, 0) / state.syncHistory.length)
    : 0;

  shell(`
    <article class="bubble">
      <p class="eyebrow">Final scores</p>
      <h2>${escapeHtml(ranking[0]?.name || "Nobody")} takes it.</h2>
      <div class="sync-score">${roomSync}% <small style="font-size:14px;color:var(--muted)">final room sync</small></div>
      <div class="rankings">${rows}</div>
    </article>
    <article class="bubble you">
      <div class="action-grid">
        ${me.playerId === state.hostId ? `<button id="rematch" class="btn primary" type="button">Run it back</button>` : ""}
        <button id="newRoom" class="btn" type="button">New room</button>
      </div>
      <p class="local-only">Chat Edition can add its own surface-only interactions later without changing scoring or room authority.</p>
    </article>
  `, {
    after() {
      document.querySelector("#rematch")?.addEventListener("click", () => send("REMATCH"));
      document.querySelector("#newRoom").addEventListener("click", () => {
        stopConnection();
        history.pushState({}, "", CHAT_PATH);
        renderHome();
      });
    }
  });
}

async function boot() {
  try { manifest = await client.profile(); } catch {}
  addEventListener("popstate", route);
  route();
}

function route() {
  const code = new URLSearchParams(location.search).get("room")?.toUpperCase();
  code ? connect(code) : renderHome();
}

boot();
