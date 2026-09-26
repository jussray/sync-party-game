import { mountAudio } from './audio.js';
const app = document.querySelector("#app");
const themeToggle = document.querySelector("#themeToggle");
const toast = document.querySelector("#toast");

let socket = null;
let roomState = null;
let serverOffset = 0;
let timerHandle = null;
let lastTickSecond = null;

const prefs = {
  theme: localStorage.getItem("sync.theme") || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
};

const sound = mountAudio();
setTheme(prefs.theme);
themeToggle.addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
let audioRoomKey = null;
let audioPhaseKey = null;
let audioChoiceLocked = false;

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
function home() {
  closeSocket(); roomState = null; sound.stopEffects(); sound.setPhase("home"); audioRoomKey = null; audioPhaseKey = null;
  app.innerHTML = `<section class="hero"><div class="hero-card"><p class="logo">SYNC<span class="spark">✦</span></p><p class="tagline">Think alike. Beat the clock.</p><p class="sub">A real-time pressure party game. Join with a room code, read the room, lock your answer, and see how synchronized everybody really is.</p><div class="grid two"><form id="createForm" class="card mini-card"><h2>Create a game</h2><div class="field"><label for="createName">Your nickname</label><input class="input" id="createName" maxlength="18" autocomplete="nickname" required /></div><button class="btn btn-primary" type="submit">Create a game →</button></form><form id="joinForm" class="card mini-card"><h2>Join a game</h2><div class="field"><label for="joinCode">Room code</label><input class="input code-input" id="joinCode" maxlength="5" autocomplete="off" required /></div><div class="field"><label for="joinName">Nickname</label><input class="input" id="joinName" maxlength="18" autocomplete="nickname" required /></div><button class="btn btn-secondary" type="submit">Join a game →</button></form></div><p class="setting-note">No account. No install. Party audio is optional and never carries required game information.</p></div></section>`;
  document.querySelector("#createForm").addEventListener("submit", createRoom);
  document.querySelector("#joinForm").addEventListener("submit", joinRoom);
}
async function createRoom(event) {
  event.preventDefault();
  sound.play("tap");
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
  sound.play("tap");
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
  if (!me) { notify("Enter through Create or Join first"); history.replaceState({}, "", "/"); return home(); }
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
  const roundKey = `${code}:${state.deadline}:${state.roundIndex}`;
  const phaseKey = `${roundKey}:${state.phase}`;
  const locked = state.answers?.[me.playerId] === true;
  if (phaseKey !== audioPhaseKey) {
    sound.stopEffects();
    sound.setPhase(state.phase);
    if (audioPhaseKey !== null) {
      if (state.phase === "choosing") sound.play("round");
      if (state.phase === "reveal") sound.play("reveal");
      if (state.phase === "results") sound.play("win");
    }
    lastTickSecond = null;
  }
  if (roundKey === audioRoomKey && state.phase === "choosing" && locked && !audioChoiceLocked) sound.play("lock");
  audioRoomKey = roundKey; audioPhaseKey = phaseKey; audioChoiceLocked = locked;
  const players = state.players.map((player) => `<div class="player"><span class="dot ${player.connected ? "on" : ""}"></span><b>${escapeHtml(player.name)}</b>${player.id === state.hostId ? " 👑" : ""}</div>`).join("");
  const connectedCount = state.players.filter((player) => player.connected).length;
  if (state.phase === "lobby") {
    app.innerHTML = `<section class="hero"><div class="card"><p class="meta">ROOM</p><div class="room-code">${state.code}</div><p class="sub">Share this code. Everyone can join from any phone or laptop.</p><div class="players">${players}</div><p class="meta">${connectedCount} connected · ${state.players.length}/8 joined</p>${me.playerId === state.hostId ? `<button id="startBtn" class="btn btn-primary" ${connectedCount < 2 ? "disabled" : ""}>Start game →</button>` : `<p><b>Waiting for the host…</b></p>`}<p class="setting-note">Sound controls are in the top bar. Final-five-second cues add pressure, with matching visual countdowns for muted players.</p></div></section>`;
    document.querySelector("#startBtn")?.addEventListener("click", () => { sound.play("tap"); send("START_GAME"); }); return;
  }
  if (state.phase === "choosing") return renderChoosing(state, me);
  if (state.phase === "reveal") return renderReveal(state, me);
  if (state.phase === "results") return renderResults(state, me);
}
function progress(state) { return Array.from({ length: state.rounds }, (_, index) => `<span class="${index <= state.roundIndex ? "on" : ""}"></span>`).join(""); }
function modeCard(state) { return `<div class="mode-card"><span class="mode-label">${escapeHtml(state.mode?.label || "SYNC")}</span><span>${escapeHtml(state.mode?.instruction || "Read the room.")}</span></div>`; }
function renderChoosing(state, me) {
  const selected = state.answers[me.playerId] === true;
  app.innerHTML = `<section class="hero"><div id="gameCard" class="card"><div class="progress">${progress(state)}</div><div class="timer-row"><span class="meta">Round ${state.roundIndex + 1} of ${state.rounds}</span><span id="timer" class="timer">15s</span></div>${modeCard(state)}<h1 class="prompt">${escapeHtml(state.prompt.text)}</h1><div class="choices">${state.prompt.choices.map((choice, index) => `<button class="choice" data-choice="${index}" ${selected ? "disabled" : ""}>${escapeHtml(choice)}</button>`).join("")}</div>${selected ? `<p class="setting-note">✓ Choice locked. Waiting for everyone else.</p>` : `<p class="setting-note">Pick before time runs out.</p>`}</div></section>`;
  document.querySelectorAll(".choice").forEach((button) => button.addEventListener("click", () => {
    if (selected) return;
    sound.play("tap"); document.querySelectorAll(".choice").forEach((item) => { item.disabled = true; }); button.classList.add("selected"); send("SUBMIT_CHOICE", { choiceIndex: Number(button.dataset.choice) });
  }));
  updateTimer(state.deadline); timerHandle = setInterval(() => updateTimer(state.deadline), 150);
}
function updateTimer(deadline) {
  const timer = document.querySelector("#timer"); if (!timer) return;
  const left = Math.max(0, Math.ceil((deadline - (Date.now() + serverOffset)) / 1000));
  timer.textContent = `${left}s`;
  const card = document.querySelector("#gameCard");
  if (left <= 5) { timer.classList.add("danger"); card?.classList.add("pressure"); if (left > 0 && lastTickSecond !== left) { sound.play(`tick-${left}`); lastTickSecond = left; } }
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
  const total = Math.max(1, state.lastResults?.totalAnswers || Object.keys(state.answers).length);
  const rows = state.prompt.choices.map((choice, index) => { const count = state.lastResults?.counts?.[index] || 0; return `<div class="result-row"><b>${escapeHtml(choice)}</b><div class="bar"><span style="width:${(count / total) * 100}%"></span></div><b>${count}</b></div>`; }).join("");
  const mine = state.lastResults?.winners?.includes(me.playerId);
  const syncPercent = state.lastResults?.syncPercent || 0;
  app.innerHTML = `<section class="hero"><div class="card"><div class="progress">${progress(state)}</div>${modeCard(state)}<h1 class="prompt">Here’s what everyone chose!</h1><div class="sync-meter"><div><span>ROOM SYNC</span><strong>${syncPercent}%</strong></div><div class="sync-track"><span style="width:${syncPercent}%"></span></div><b>${syncLabel(syncPercent)}</b></div><div class="results">${rows}</div><p class="tagline">${mine ? "You won this mutation. +3 ✦" : "No points this round. Read the room again."}</p>${me.playerId === state.hostId ? `<button id="nextBtn" class="btn btn-primary">${state.roundIndex + 1 >= state.rounds ? "See final scores" : "Next round"} →</button>` : `<p class="meta">Waiting for the host…</p>`}</div></section>`;
  document.querySelector("#nextBtn")?.addEventListener("click", () => { sound.play("tap"); send("NEXT_ROUND"); });
}
function renderResults(state, me) {
  const ranking = [...state.players].sort((a, b) => (state.scores[b.id] || 0) - (state.scores[a.id] || 0));
  const roomSync = state.syncHistory?.length ? Math.round(state.syncHistory.reduce((sum, value) => sum + value, 0) / state.syncHistory.length) : 0;
  app.innerHTML = `<section class="hero"><div class="card"><p class="logo" style="font-size:3rem">GAME OVER<span class="spark">✦</span></p><p class="tagline">${escapeHtml(ranking[0]?.name || "Nobody")} wins!</p><div class="final-sync"><span>FINAL ROOM SYNC</span><strong>${roomSync}%</strong><b>${syncLabel(roomSync)}</b></div><div class="scoreboard">${ranking.map((player, index) => `<div class="score"><span>${index + 1}. ${escapeHtml(player.name)}${player.id === me.playerId ? " (you)" : ""}</span><span>${state.scores[player.id] || 0} pts</span></div>`).join("")}</div><div class="actions" style="margin-top:22px">${me.playerId === state.hostId ? `<button id="rematchBtn" class="btn btn-primary">Play again ↻</button>` : ""}<button id="homeBtn" class="btn btn-secondary">New room</button></div></div></section>`;
  document.querySelector("#rematchBtn")?.addEventListener("click", () => send("REMATCH"));
  document.querySelector("#homeBtn").addEventListener("click", () => { history.pushState({}, "", "/"); home(); });
}

addEventListener("popstate", route);
function route() { const code = new URLSearchParams(location.search).get("room")?.toUpperCase(); code ? connect(code) : home(); }
route();
