const app = document.querySelector("#app");
const themeToggle = document.querySelector("#themeToggle");
const soundToggle = document.querySelector("#soundToggle");
const toast = document.querySelector("#toast");

let socket = null;
let roomState = null;
let serverOffset = 0;
let timerHandle = null;
let lastTickSecond = null;
let revealSoundSeq = null;
let winSoundSeq = null;

const prefs = {
  theme: localStorage.getItem("sync.theme") || "dark",
  sound: localStorage.getItem("sync.sound") === "on"
};

const GROWTH_VISITOR_COOKIE = "sync_growth_vid";
const GROWTH_VISITOR_MAX_AGE = 60 * 60 * 24 * 90;

function growthId(prefix) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;
}
function readCookie(name) {
  const prefix = `${name}=`;
  const part = document.cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith(prefix));
  return part ? decodeURIComponent(part.slice(prefix.length)) : null;
}
function anonymousVisitorId() {
  let value = readCookie(GROWTH_VISITOR_COOKIE) || localStorage.getItem("sync.growth.visitor");
  if (!value) value = growthId("visitor");
  localStorage.setItem("sync.growth.visitor", value);
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${GROWTH_VISITOR_COOKIE}=${encodeURIComponent(value)}; Max-Age=${GROWTH_VISITOR_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
  return value;
}
function anonymousSessionId() {
  let value = sessionStorage.getItem("sync.growth.session");
  if (!value) {
    value = growthId("session");
    sessionStorage.setItem("sync.growth.session", value);
  }
  return value;
}
function referrerHost() {
  if (!document.referrer) return null;
  try { return new URL(document.referrer).hostname || null; } catch { return null; }
}
function campaignContext() {
  const params = new URLSearchParams(location.search);
  const fresh = {
    campaign_id: params.get("utm_campaign") || params.get("campaign"),
    source: params.get("utm_source") || params.get("source"),
    medium: params.get("utm_medium") || params.get("medium"),
    content: params.get("utm_content") || params.get("content"),
    referrer_host: referrerHost()
  };
  const hasFresh = Object.values(fresh).some(Boolean);
  if (hasFresh) {
    sessionStorage.setItem("sync.growth.context", JSON.stringify(fresh));
    return fresh;
  }
  try {
    return JSON.parse(sessionStorage.getItem("sync.growth.context")) || fresh;
  } catch {
    return fresh;
  }
}
const growthSession = {
  visitor_id: anonymousVisitorId(),
  session_id: anonymousSessionId(),
  ...campaignContext()
};
function growthEnvelope() { return { ...growthSession }; }
function trackGrowth(event) {
  fetch("/api/growth/event", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event, event_id: growthId("ge"), growth: growthEnvelope() })
  }).then((response) => response.text()).catch(() => {});
}

class SoundDirector {
  ctx = null;
  beatTimer = null;
  unlocked = false;
  async unlock() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === "suspended") await this.ctx.resume();
    this.unlocked = true;
  }
  tone(freq, duration = .08, gain = .035, type = "sine", when = 0) {
    if (!prefs.sound || !this.unlocked || !this.ctx) return;
    const time = this.ctx.currentTime + when;
    const oscillator = this.ctx.createOscillator();
    const volume = this.ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, time);
    volume.gain.setValueAtTime(gain, time);
    volume.gain.exponentialRampToValueAtTime(.0001, time + duration);
    oscillator.connect(volume).connect(this.ctx.destination);
    oscillator.start(time);
    oscillator.stop(time + duration);
  }
  startParty() {
    if (!prefs.sound || !this.unlocked || this.beatTimer) return;
    let step = 0;
    this.beatTimer = setInterval(() => {
      const notes = [196, 247, 294, 247];
      this.tone(notes[step % notes.length], .11, .018, "triangle");
      if (step % 2 === 0) this.tone(98, .05, .022, "sine", .02);
      step += 1;
    }, 420);
  }
  stopParty() { clearInterval(this.beatTimer); this.beatTimer = null; }
  pressureTick(left) { this.tone(left <= 2 ? 880 : 660, .09, .055, "square"); if (left === 1) this.tone(1100, .13, .045, "sawtooth", .09); }
  pick() { this.tone(520, .06, .045); this.tone(760, .08, .035, "sine", .05); }
  confirm() { this.tone(420, .06, .03, "triangle"); this.tone(620, .09, .03, "triangle", .06); }
  reveal() { this.tone(330, .08, .035); this.tone(494, .1, .04, "sine", .08); this.tone(660, .14, .04, "sine", .17); }
  win() { [523, 659, 784, 1047].forEach((freq, index) => this.tone(freq, .18, .04, "triangle", index * .11)); }
}

const sound = new SoundDirector();
setTheme(prefs.theme);
soundToggle.setAttribute("aria-pressed", String(prefs.sound));

themeToggle.addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
soundToggle.addEventListener("click", async () => {
  prefs.sound = !prefs.sound;
  localStorage.setItem("sync.sound", prefs.sound ? "on" : "off");
  soundToggle.setAttribute("aria-pressed", String(prefs.sound));
  if (prefs.sound) {
    await sound.unlock();
    if (roomState?.phase && roomState.phase !== "lobby") sound.startParty();
  } else sound.stopParty();
});
document.addEventListener("pointerdown", () => { if (prefs.sound) sound.unlock(); }, { once: true });

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("sync.theme", theme);
  themeToggle.textContent = theme === "dark" ? "☀︎" : "☾";
}
function notify(message) {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
}
function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}
function identity(code) {
  try { return JSON.parse(localStorage.getItem(`sync.room.${code}`)); } catch { return null; }
}
function saveIdentity(code, value) { localStorage.setItem(`sync.room.${code}`, JSON.stringify(value)); }
function closeSocket() {
  if (socket) { socket.onclose = null; socket.close(); socket = null; }
  clearInterval(timerHandle);
  timerHandle = null;
}
function choiceParts(choice) {
  const value = String(choice || "").trim();
  const firstSpace = value.indexOf(" ");
  if (firstSpace < 0) return { icon: "✦", label: value };
  return { icon: value.slice(0, firstSpace), label: value.slice(firstSpace + 1) };
}
function avatar(index, extra = "") {
  return `<span class="face face-${index % 4} ${extra}" aria-hidden="true"></span>`;
}
function gameFrame(body, label = "LIVE MULTIPLAYER") {
  app.innerHTML = `<section class="game-wrap"><div class="game-top"><span>✦ ${label}</span><button class="text-btn" id="exitGame" type="button">← HOME</button></div><div class="game-card" id="gameCard">${body}</div></section>`;
  document.querySelector("#exitGame")?.addEventListener("click", () => {
    closeSocket();
    history.pushState({}, "", "/");
    home();
  });
}
function home() {
  closeSocket(); roomState = null; sound.stopParty();
  app.innerHTML = `<section class="party-home"><div class="party-art" aria-hidden="true"></div><div class="hero-content"><p class="eyebrow">THE WHOLE GROUP. ONE WAVELENGTH.</p><div class="game-logo" aria-label="SYNC">SYNC<span>✦</span></div><h1>THINK ALIKE.<br class="mobile-break"> BEAT THE CLOCK.</h1><p class="hero-description">Everybody picks in private.<br>Reveal together. Find out who's in sync.</p><div class="hero-actions"><button id="create" class="btn btn-primary" type="button">♟ &nbsp; CREATE A GAME <span>→</span></button><button id="join" class="btn btn-secondary" type="button">JOIN A GAME <span>→</span></button></div><p class="preview-note">Real-time multiplayer · No account · No install</p><div class="hero-badges"><span>2–8 players</span><span>15-second picks</span><span>5 rounds</span></div></div></section><section class="quick-how" aria-label="How to play"><div><span class="step-icon purple">👥</span><p><b>JOIN</b><small>Get your people in.</small></p></div><div><span class="step-icon pink">☝️</span><p><b>PICK</b><small>Trust your gut.</small></p></div><div><span class="step-icon orange">🔒</span><p><b>REVEAL</b><small>All at once.</small></p></div><div><span class="step-icon blue">✦</span><p><b>SYNC</b><small>Score. Run it back.</small></p></div></section><section class="modes-section"><div class="section-heading"><h2>Same friends. Different twists.</h2><span>A NEW MODE EVERY ROUND</span></div><div class="mode-tiles"><div class="mode-tile mode-0"><span aria-hidden="true">👥</span><h3>Classic Sync</h3><p>Match the room majority.</p></div><div class="mode-tile mode-1"><span aria-hidden="true">💗</span><h3>Twin</h3><p>Find exactly one matching mind.</p></div><div class="mode-tile mode-2"><span aria-hidden="true">👽</span><h3>Odd One Out</h3><p>Be the only one to choose it.</p></div><div class="mode-tile mode-3"><span aria-hidden="true">⇄</span><h3>Reverse</h3><p>Smallest non-zero group wins.</p></div><div class="mode-tile mode-4"><span aria-hidden="true">∞</span><h3>Perfect Sync</h3><p>Everybody must match.</p></div></div></section>`;
  document.querySelector("#create").addEventListener("click", () => setup(false));
  document.querySelector("#join").addEventListener("click", () => setup(true));
}
function setup(joining) {
  closeSocket(); roomState = null; sound.stopParty();
  gameFrame(`<div class="center"><div class="setup-icon">${joining ? "🎮" : "✦"}</div><h1 class="screen-title">${joining ? "Join the party." : "Start something fun."}</h1><p class="little">${joining ? "Drop the room code your friend sent you." : "Create the room, send the code, then read the room."}</p></div>${joining ? `<form id="joinForm" class="setup-form"><div class="field"><label for="joinCode">ROOM CODE</label><input class="input code-input" id="joinCode" placeholder="ABCDE" maxlength="5" autocomplete="off" required /></div><div class="field"><label for="joinName">NICKNAME</label><div class="name-input">${avatar(1)}<input class="input" id="joinName" placeholder="Your friends know you as…" maxlength="18" autocomplete="nickname" required /></div></div><button class="btn btn-primary wide" type="submit">JOIN A GAME →</button><p class="little center">Room codes are five characters.</p></form>` : `<form id="createForm" class="setup-form"><div class="field"><label for="createName">YOUR NICKNAME</label><div class="name-input">${avatar(0)}<input class="input" id="createName" placeholder="Your friends know you as…" maxlength="18" autocomplete="nickname" required /></div></div><button class="btn btn-primary wide" type="submit">CREATE A GAME →</button><p class="little center">You’ll be the host. Share the code after the room opens.</p></form>`}`, joining ? "JOIN SYNC" : "HOST SYNC");
  document.querySelector("#createForm")?.addEventListener("submit", createRoom);
  document.querySelector("#joinForm")?.addEventListener("submit", joinRoom);
}
async function createRoom(event) {
  event.preventDefault();
  trackGrowth("play_intent");
  if (prefs.sound) { await sound.unlock(); sound.confirm(); }
  const name = document.querySelector("#createName").value.trim();
  const response = await fetch("/api/rooms/create", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, growth: growthEnvelope() }) });
  const data = await response.json();
  if (!response.ok) return notify(data.error || "Could not create room");
  saveIdentity(data.code, { playerId: data.playerId, resumeToken: data.resumeToken, name });
  history.pushState({}, "", `/?room=${data.code}`);
  connect(data.code);
}
async function joinRoom(event) {
  event.preventDefault();
  trackGrowth("play_intent");
  if (prefs.sound) { await sound.unlock(); sound.confirm(); }
  const code = document.querySelector("#joinCode").value.trim().toUpperCase();
  const name = document.querySelector("#joinName").value.trim();
  const response = await fetch(`/api/rooms/${encodeURIComponent(code)}/join`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, growth: growthEnvelope() }) });
  const data = await response.json();
  if (!response.ok) return notify(data.error || "Could not join room");
  saveIdentity(code, { playerId: data.playerId, resumeToken: data.resumeToken, name });
  history.pushState({}, "", `/?room=${code}`);
  connect(code);
}
function connect(code) {
  closeSocket();
  const me = identity(code);
  if (!me) { notify("Enter through Create or Join first"); history.replaceState({}, "", "/"); return home(); }
  gameFrame(`<div class="center"><div class="setup-icon">✦</div><h1 class="screen-title">Connecting to ${escapeHtml(code)}…</h1><p class="little">Finding your people.</p></div>`, "CONNECTING");
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(`${protocol}//${location.host}/api/rooms/${code}/ws?playerId=${encodeURIComponent(me.playerId)}&token=${encodeURIComponent(me.resumeToken)}`);
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.type === "STATE") { serverOffset = message.serverTime - Date.now(); roomState = message.state; renderRoom(code, me); }
    if (message.type === "ERROR") notify(message.error);
  };
  socket.onclose = () => setTimeout(() => { if (new URLSearchParams(location.search).get("room")?.toUpperCase() === code) connect(code); }, 900);
}
function send(type, payload = {}) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type, ...payload }));
}
function renderRoom(code, me) {
  clearInterval(timerHandle); timerHandle = null;
  const state = roomState; if (!state) return;
  if (prefs.sound && state.phase !== "lobby") sound.startParty();
  if (state.phase === "lobby") sound.stopParty();
  const connectedCount = state.players.filter((player) => player.connected).length;
  if (state.phase === "lobby") {
    const players = state.players.map((player, index) => `<div class="lobby-player">${avatar(index)}<b>${escapeHtml(player.name)}</b><small>${player.id === state.hostId ? "Host 👑" : player.connected ? "Connected" : "Reconnecting"}</small></div>`).join("");
    const empty = Math.max(0, Math.min(2, 8 - state.players.length));
    gameFrame(`<div class="center"><p class="meta">ROOM</p><h1 class="room-code">${state.code}</h1><h2 class="lobby-title">SEND THIS CODE TO YOUR PEOPLE</h2><p class="little">Everyone can join from any phone or laptop.</p><div class="lobby-players">${players}${Array.from({ length: empty }, () => `<div class="lobby-player vacant"><span class="empty-avatar">Ｌ</span><small>Open spot</small></div>`).join("")}</div><p class="meta">${connectedCount} connected · ${state.players.length}/8 joined</p><div class="room-settings"><div><span>👥</span><p><small>FIRST MODE</small><b>Classic Sync</b></p></div><div><span>🏦</span><p><small>ROUNDS</small><b>${state.rounds}</b></p></div><div><span>⏑️</span><p><small>EACH PICK</small><b>15 seconds</b></p></div></div>${me.playerId === state.hostId ? `<button id="startBtn" class="btn btn-primary wide" ${connectedCount < 2 ? "disabled" : ""}>START GAME →</button>` : `<p class="little"><b>Waiting for the host…</b></p>`}<p class="little">Party sound: ${prefs.sound ? "ON" : "OFF"}. Visual countdowns always carry the required timing.</p></div>`, "LIVE ROOM");
    document.querySelector("#startBtn")?.addEventListener("click", () => { sound.confirm(); send("START_GAME"); }); return;
  }
  if (state.phase === "choosing") return renderChoosing(state, me);
  if (state.phase === "reveal") return renderReveal(state, me);
  if (state.phase === "results") return renderResults(state, me);
}
function progress(state) { return `<div class="round-progress" aria-label="Round ${state.roundIndex + 1} of ${state.rounds}">${Array.from({ length: state.rounds }, (_, index) => `<span class="${index <= state.roundIndex ? "on" : ""}"></span>`).join("")}</div>`; }
function modeCard(state) { return `<div class="mode-card"><span class="mode-label">${escapeHtml(state.mode?.label || "SYNC")}</span><span>${escapeHtml(state.mode?.instruction || "Read the room.")}</span></div>`; }
function renderChoosing(state, me) {
  const selected = Object.prototype.hasOwnProperty.call(state.answers, me.playerId);
  gameFrame(`<div class="timer-row"><span class="meta">Round ${state.roundIndex + 1} of ${state.rounds}</span><span id="timer" class="timer">15s</span></div>${progress(state)}<div class="time-track"><div id="timeFill" style="width:100%"></div></div>${modeCard(state)}<h1 class="prompt">${escapeHtml(state.prompt.text)}</h1><div class="choices">${state.prompt.choices.map((choice, index) => { const part = choiceParts(choice); return `<button class="choice" data-choice="${index}" ${selected ? "disabled" : ""}><span class="choice-icon">${escapeHtml(part.icon)}</span><span>${escapeHtml(part.label)}</span><span class="choice-check" aria-hidden="true">${state.answers[me.playerId] === index ? "✓" : ""}</span></button>`; }).join("")}</div><p class="lock-message" id="lock" role="status">${selected ? "✓ Choice locked. Waiting for everybody else." : "One pick. Keep it to yourself."}</p>`, "LIVE MULTIPLAYER");
  document.querySelectorAll(".choice").forEach((button) => button.addEventListener("click", () => {
    if (selected) return;
    sound.pick(); document.querySelectorAll(".choice").forEach((item) => { item.disabled = true; }); button.classList.add("selected"); button.querySelector(".choice-check").textContent = "✓"; document.querySelector("#lock").textContent = "✓ Choice locked. Waiting for everybody else."; send("SUBMIT_CHOICE", { choiceIndex: Number(button.dataset.choice) });
  }));
  updateTimer(state.deadline); timerHandle = setInterval(() => updateTimer(state.deadline), 150);
}
function updateTimer(deadline) {
  const timer = document.querySelector("#timer"); if (!timer) return;
  const ms = Math.max(0, deadline - (Date.now() + serverOffset));
  const left = Math.max(0, Math.ceil(ms / 1000));
  timer.textContent = `${left}s`;
  const fill = document.querySelector("#timeFill");
  if (fill) fill.style.width = `${Math.min(100, (ms / 15000) * 100)}%`;
  const card = document.querySelector("#gameCard");
  if (left <= 5) { timer.classList.add("danger"); card?.classList.add("pressure"); if (prefs.sound && lastTickSecond !== left) { sound.pressureTick(left); lastTickSecond = left; } }
  else { timer.classList.remove("danger"); card?.classList.remove("pressure"); lastTickSecond = null; }
}
function syncLabel(percent) {
  if (percent === 100) return "PERFECT SYNC ✦";
  if (percent >= 80) return "LOCKED IN ⚡";
  if (percent >= 60) return "SAME WAVELENGTH";
  if (percent >= 40) return "GETTING THERE";
  return "SIGNAL LOST 📡";
}
function renderReveal(state, me) {
  if (revealSoundSeq !== state.seq) { sound.reveal(); revealSoundSeq = state.seq; }
  const total = Math.max(1, state.lastResults?.totalAnswers || Object.keys(state.answers).length);
  const rows = state.prompt.choices.map((choice, index) => { const count = state.lastResults?.counts?.[index] || 0; const part = choiceParts(choice); return `<div class="answer-result"><span class="choice-icon">${escapeHtml(part.icon)}</span><span>${escapeHtml(part.label)}</span><div class="answer-bar"><i style="--fill:${(count / total) * 100}%"></i></div><b>${count}</b></div>`; }).join("");
  const won = state.lastResults?.winners?.includes(me.playerId);
  const mine = state.answers[me.playerId];
  const syncPercent = state.lastResults?.syncPercent || 0;
  gameFrame(`${progress(state)}<p class="meta center">ROUND ${state.roundIndex + 1} · ${escapeHtml(state.mode?.label || "SYNC")}</p><h1 class="screen-title center">Here’s what everyone chose!</h1><div class="sync-readout"><span>ROOM SYNC</span><strong>${syncPercent}%</strong><b>${syncLabel(syncPercent)}</b></div><div class="answer-results">${rows}</div><div class="your-result ${won ? "won" : ""}"><div><small>YOUR CHOICE</small><b>${mine === undefined ? "No pick this round" : escapeHtml(state.prompt.choices[mine])}</b><span>${won ? "You nailed this round." : "Read the room again."}</span></div><strong>${won ? "+3" : "0"} pts</strong></div>${me.playerId === state.hostId ? `<button id="nextBtn" class="btn btn-primary wide">${state.roundIndex + 1 >= state.rounds ? "SEE FINAL SCORES" : "NEXT ROUND"} →</button>` : `<p class="little center">Waiting for the host…</p>`}`, "LIVE REVEAL");
  document.querySelector("#nextBtn")?.addEventListener("click", () => { sound.confirm(); send("NEXT_ROUND"); });
}
function renderResults(state, me) {
  if (winSoundSeq !== state.seq) { sound.win(); winSoundSeq = state.seq; }
  const ranking = [...state.players].sort((a, b) => (state.scores[b.id] || 0) - (state.scores[a.id] || 0));
  const roomSync = state.syncHistory?.length ? Math.round(state.syncHistory.reduce((sum, value) => sum + value, 0) / state.syncHistory.length) : 0;
  const high = Math.max(...ranking.map((player) => state.scores[player.id] || 0));
  gameFrame(`<div class="celebration" aria-hidden="true">${Array.from({ length: 16 }, (_, index) => `<i style="--x:${index * 6.3}%;--r:${index * 37}deg;--d:${(index % 5) * .13}s;--color:${["#ffcc4d", "#ef3cbe", "#7296ff"][index % 3]}"></i>`).join("")}</div><div class="center"><div class="trophy" aria-hidden="true">🏆</div><p class="meta">GAME OVER · ROOM ${escapeHtml(state.code)}</p><h1 class="screen-title">${escapeHtml(ranking[0]?.name || "Nobody")} wins!</h1><div class="final-sync"><span>FINAL ROOM SYNC</span><strong>${roomSync}%</strong><b>${syncLabel(roomSync)}</b></div></div><div class="scoreboard">${ranking.map((player, index) => `<div class="rank-row ${(state.scores[player.id] || 0) === high ? "leader" : ""}"><span class="rank-number">${index + 1}</span>${avatar(index)}<span class="rank-name">${escapeHtml(player.name)}${player.id === me.playerId ? " <small>(you)</small>" : ""}${(state.scores[player.id] || 0) === high ? " ♛" : ""}</span><strong>${state.scores[player.id] || 0}</strong></div>`).join("")}</div><div class="actions" style="margin-top:22px">${me.playerId === state.hostId ? `<button id="rematchBtn" class="btn btn-primary">PLAY AGAIN ↻</button>` : ""}<button id="homeBtn" class="btn btn-secondary">NEW ROOM</button></div>`, "FINAL SCORES");
  document.querySelector("#rematchBtn")?.addEventListener("click", () => send("REMATCH"));
  document.querySelector("#homeBtn").addEventListener("click", () => { closeSocket(); history.pushState({}, "", "/"); home(); });
}
addEventListener("popstate", route);
function route() { const code = new URLSearchParams(location.search).get("room")?.toUpperCase(); code ? connect(code) : home(); }
trackGrowth("landing_view");
route();