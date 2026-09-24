const app = document.querySelector("#app");
const themeToggle = document.querySelector("#themeToggle");
const soundToggle = document.querySelector("#soundToggle");
const toast = document.querySelector("#toast");
const fingerprint = document.querySelector("#fingerprint");

let socket = null;
let roomState = null;
let serverOffset = 0;
let timerHandle = null;
let lastTickSecond = null;
let revealSoundSeq = null;
let winSoundSeq = null;
let lockSoundSeq = null;

const prefs = {
  theme: localStorage.getItem("sync.theme") || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"),
  sound: localStorage.getItem("sync.sound") === "on"
};

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
  lock() { this.tone(110, .22, .06, "sine"); this.tone(82, .3, .05, "triangle", .05); }
  perfect() { [523, 659, 784, 1047, 1319, 1568].forEach((freq, index) => this.tone(freq, .22, .045, "triangle", index * .08)); }
}

const sound = new SoundDirector();
setTheme(prefs.theme);
soundToggle.setAttribute("aria-pressed", String(prefs.sound));

themeToggle.addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
soundToggle.addEventListener("click", async () => {
  prefs.sound = !prefs.sound;
  localStorage.setItem("sync.sound", prefs.sound ? "on" : "off");
  soundToggle.setAttribute("aria-pressed", String(prefs.sound));
  notify(prefs.sound ? "Party sound on" : "Party sound off");
  if (prefs.sound) {
    await sound.unlock();
    if (roomState?.phase === "choosing") sound.startParty();
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
function home(prefillCode = "") {
  closeSocket(); roomState = null; sound.stopParty(); fingerprint.textContent = "";
  app.innerHTML = `<section class="hero"><div class="hero-card"><p class="logo">SYNC<span class="spark">✦</span></p><p class="tagline">Think alike. Beat the clock.</p><p class="sub">A real-time pressure party game. Join with a room code, read the room, lock your answer, and see how synchronized everybody really is.</p><div class="grid two"><form id="createForm" class="card mini-card"><h2>Create a game</h2><div class="field"><label for="createName">Your nickname</label><input class="input" id="createName" maxlength="18" autocomplete="nickname" required /></div><button class="btn btn-primary" type="submit">Create a game →</button></form><form id="joinForm" class="card mini-card"><h2>Join a game</h2><div class="field"><label for="joinCode">Room code</label><input class="input code-input" id="joinCode" maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false" value="${escapeHtml(prefillCode)}" required /></div><div class="field"><label for="joinName">Nickname</label><input class="input" id="joinName" maxlength="18" autocomplete="nickname" required /></div><button class="btn btn-secondary" type="submit">Join a game →</button></form></div><p class="setting-note">No account. No install. Party audio is optional and never carries required game information.</p></div></section>`;
  document.querySelector("#createForm").addEventListener("submit", createRoom);
  document.querySelector("#joinForm").addEventListener("submit", joinRoom);
}
async function createRoom(event) {
  event.preventDefault();
  if (prefs.sound) { await sound.unlock(); sound.confirm(); }
  const name = document.querySelector("#createName").value.trim();
  const response = await fetch("/api/rooms/create", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
  const data = await response.json();
  if (!response.ok) return notify(data.error || "Could not create room");
  saveIdentity(data.code, { playerId: data.playerId, resumeToken: data.resumeToken, name });
  history.pushState({}, "", `/?room=${data.code}`);
  connect(data.code);
}
async function joinRoom(event) {
  event.preventDefault();
  if (prefs.sound) { await sound.unlock(); sound.confirm(); }
  const code = document.querySelector("#joinCode").value.trim().toUpperCase();
  const name = document.querySelector("#joinName").value.trim();
  const response = await fetch(`/api/rooms/${encodeURIComponent(code)}/join`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
  const data = await response.json();
  if (!response.ok) return notify(data.error || "Could not join room");
  saveIdentity(code, { playerId: data.playerId, resumeToken: data.resumeToken, name });
  history.pushState({}, "", `/?room=${code}`);
  connect(code);
}
function connect(code) {
  closeSocket();
  const me = identity(code);
  if (!me) { notify("Enter a nickname to join this room"); history.replaceState({}, "", "/"); home(code); return document.querySelector("#joinName")?.focus(); }
  app.innerHTML = `<section class="hero"><div class="card"><h2>Connecting to ${escapeHtml(code)}…</h2></div></section>`;
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
  fingerprint.textContent = `room ${state.code} · seq ${state.seq} · #${state.stateHash}`;
  fingerprint.dataset.seq = state.seq; fingerprint.dataset.hash = state.stateHash;
  // Groove only while choosing; LOCKED is a deliberate beat of silence before REVEAL.
  if (prefs.sound && state.phase === "choosing") sound.startParty(); else sound.stopParty();
  const players = state.players.map((player) => `<div class="player"><span class="dot ${player.connected ? "on" : ""}"></span><b>${escapeHtml(player.name)}</b>${player.id === state.hostId ? " 👑" : ""}</div>`).join("");
  const connectedCount = state.players.filter((player) => player.connected).length;
  if (state.phase === "lobby") {
    app.innerHTML = `<section class="hero"><div class="card"><p class="meta">ROOM</p><div class="room-code">${state.code}</div><p class="sub">Share this code. Everyone can join from any phone or laptop.</p><div class="players">${players}</div><p class="meta">${connectedCount} connected · ${state.players.length}/8 joined</p>${me.playerId === state.hostId ? `<button id="startBtn" class="btn btn-primary" ${connectedCount < 2 ? "disabled" : ""}>Start game →</button>` : `<p><b>Waiting for the host…</b></p>`}<p class="setting-note">Party sound: ${prefs.sound ? "ON" : "OFF"}. Final-five-second cues add pressure, with matching visual countdowns for muted players.</p></div></section>`;
    document.querySelector("#startBtn")?.addEventListener("click", () => { sound.confirm(); send("START_GAME"); }); return;
  }
  if (state.phase === "choosing") return renderChoosing(state, me);
  if (state.phase === "locked") return renderLocked(state, me);
  if (state.phase === "reveal") return renderReveal(state, me);
  if (state.phase === "results") return renderResults(state, me);
}
function progress(state) { return Array.from({ length: state.rounds }, (_, index) => `<span class="${index <= state.roundIndex ? "on" : ""}"></span>`).join(""); }
function modeCard(state) { return `<div class="mode-card"><span class="mode-label">${escapeHtml(state.mode?.label || "SYNC")}</span><span>${escapeHtml(state.mode?.instruction || "Read the room.")}</span></div>`; }
function renderChoosing(state, me) {
  const selected = state.answers[me.playerId] === true;
  app.innerHTML = `<section class="hero"><div id="gameCard" class="card"><div class="progress">${progress(state)}</div><div class="timer-row"><span class="meta">Round ${state.roundIndex + 1} of ${state.rounds}</span><span id="timer" class="timer" role="timer" aria-label="Seconds left">15s</span></div>${modeCard(state)}<h1 class="prompt">${escapeHtml(state.prompt.text)}</h1><div class="choices">${state.prompt.choices.map((choice, index) => `<button class="choice" data-choice="${index}" ${selected ? "disabled" : ""}>${escapeHtml(choice)}</button>`).join("")}</div>${selected ? `<p class="setting-note">✓ Choice locked. Waiting for everyone else.</p>` : `<p class="setting-note">Pick before time runs out.</p>`}<p class="meta" id="lockCount">${lockedCount(state)}</p></div></section>`;
  document.querySelectorAll(".choice").forEach((button) => button.addEventListener("click", () => {
    if (selected) return;
    sound.pick(); document.querySelectorAll(".choice").forEach((item) => { item.disabled = true; }); button.classList.add("selected"); send("SUBMIT_CHOICE", { choiceIndex: Number(button.dataset.choice) });
  }));
  updateTimer(state.deadline); timerHandle = setInterval(() => updateTimer(state.deadline), 150);
}
function lockedCount(state) {
  const connected = state.players.filter((player) => player.connected).length;
  return `${Object.keys(state.answers).length}/${connected} locked in`;
}
function renderLocked(state, me) {
  if (lockSoundSeq !== state.seq) { sound.lock(); lockSoundSeq = state.seq; }
  const locked = state.players.map((player) => `<div class="player"><span class="dot ${state.answers[player.id] ? "on" : ""}"></span><b>${escapeHtml(player.name)}</b>${state.answers[player.id] ? " 🔒" : ""}</div>`).join("");
  app.innerHTML = `<section class="hero"><div class="card locked-card"><div class="progress">${progress(state)}</div>${modeCard(state)}<p class="lock-title">LOCKED 🔒</p><p class="tagline">Revealing…</p><div class="players">${locked}</div><p class="meta">${lockedCount(state)} · round ${state.roundIndex + 1} of ${state.rounds}</p></div></section>`;
}
function updateTimer(deadline) {
  const timer = document.querySelector("#timer"); if (!timer) return;
  const left = Math.max(0, Math.ceil((deadline - (Date.now() + serverOffset)) / 1000));
  timer.textContent = `${left}s`;
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
  const perfect = state.lastResults?.syncPercent === 100;
  if (revealSoundSeq !== state.seq) { perfect ? sound.perfect() : sound.reveal(); revealSoundSeq = state.seq; }
  const total = Math.max(1, state.lastResults?.totalAnswers || Object.keys(state.answers).length);
  const rows = state.prompt.choices.map((choice, index) => { const count = state.lastResults?.counts?.[index] || 0; return `<div class="result-row"><b>${escapeHtml(choice)}</b><div class="bar"><span style="width:${(count / total) * 100}%"></span></div><b>${count}</b></div>`; }).join("");
  const mine = state.lastResults?.winners?.includes(me.playerId);
  const syncPercent = state.lastResults?.syncPercent || 0;
  app.innerHTML = `<section class="hero"><div class="card reveal-card ${perfect ? "perfect" : ""}" style="--energy:${syncPercent / 100}"><div class="progress">${progress(state)}</div>${modeCard(state)}<h1 class="prompt">${perfect ? "PERFECT SYNC ✦ Everyone matched!" : "Here’s what everyone chose!"}</h1><div class="sync-meter" data-sync="${syncPercent}"><div><span>ROOM SYNC</span><strong>${syncPercent}%</strong></div><div class="sync-track"><span style="width:${syncPercent}%"></span></div><b>${syncLabel(syncPercent)}</b></div><div class="results">${rows}</div><p class="tagline" id="roundOutcome">${mine ? "You scored this round. +3 ✦" : "No points this round. Read the room again."}</p><p class="meta" id="myScore">Your score: ${state.scores[me.playerId] || 0} pts</p>${me.playerId === state.hostId ? `<button id="nextBtn" class="btn btn-primary">${state.roundIndex + 1 >= state.rounds ? "See final scores" : "Next round"} →</button>` : `<p class="meta">Waiting for the host…</p>`}</div></section>`;
  document.querySelector("#nextBtn")?.addEventListener("click", () => { sound.confirm(); send("NEXT_ROUND"); });
}
function renderResults(state, me) {
  if (winSoundSeq !== state.seq) { sound.win(); winSoundSeq = state.seq; }
  const ranking = [...state.players].sort((a, b) => (state.scores[b.id] || 0) - (state.scores[a.id] || 0));
  const roomSync = state.syncHistory?.length ? Math.round(state.syncHistory.reduce((sum, value) => sum + value, 0) / state.syncHistory.length) : 0;
  app.innerHTML = `<section class="hero"><div class="card"><p class="logo" style="font-size:3rem">GAME OVER<span class="spark">✦</span></p><p class="tagline">${escapeHtml(ranking[0]?.name || "Nobody")} wins!</p><div class="final-sync ${roomSync === 100 ? "perfect" : ""}"><span>FINAL ROOM SYNC</span><strong>${roomSync}%</strong><b>${syncLabel(roomSync)}</b></div><div class="scoreboard">${ranking.map((player, index) => `<div class="score"><span>${index + 1}. ${escapeHtml(player.name)}${player.id === me.playerId ? " (you)" : ""}</span><span>${state.scores[player.id] || 0} pts</span></div>`).join("")}</div><div class="actions" style="margin-top:22px">${me.playerId === state.hostId ? `<button id="rematchBtn" class="btn btn-primary">Play again ↻</button>` : ""}<button id="homeBtn" class="btn btn-secondary">New room</button></div></div></section>`;
  document.querySelector("#rematchBtn")?.addEventListener("click", () => send("REMATCH"));
  document.querySelector("#homeBtn").addEventListener("click", () => { history.pushState({}, "", "/"); home(); });
}

addEventListener("popstate", route);
function route() { const code = new URLSearchParams(location.search).get("room")?.toUpperCase(); code ? connect(code) : home(); }
route();
