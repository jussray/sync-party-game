export const GAME_VERSION = 1;
export const ROUND_SECONDS = 15;
export const DEFAULT_ROUNDS = 5;

export const MODES = [
  { id: "classic", label: "Classic Sync", instruction: "Match the majority." },
  { id: "twin", label: "Twin", instruction: "Match exactly one other player." },
  { id: "odd", label: "Odd One Out", instruction: "Be the only player on your answer." },
  { id: "reverse", label: "Reverse", instruction: "The smallest group wins." },
  { id: "perfect", label: "Perfect Sync", instruction: "Everyone must choose the same answer." }
];

export const PROMPTS = [
  { id: "p1", text: "You have $20. What are you buying first?", choices: ["🍕 Food", "🎮 Game", "👕 Clothes", "🎬 Movie", "🐷 Save it"] },
  { id: "p2", text: "Pick the best surprise day off.", choices: ["😴 Sleep", "🌊 Beach", "🎢 Adventure", "🎮 Games", "🍿 Movie marathon"] },
  { id: "p3", text: "Which snack disappears first at a party?", choices: ["🍕 Pizza", "🍿 Popcorn", "🍪 Cookies", "🌮 Tacos", "🍓 Fruit"] },
  { id: "p4", text: "Where would the whole group rather teleport?", choices: ["🏝️ Island", "🗼 Big city", "🏔️ Mountains", "🎡 Theme park", "🏡 Home"] },
  { id: "p5", text: "Choose the group mascot.", choices: ["🐼 Panda", "🦊 Fox", "🐙 Octopus", "🦖 Dino", "🐝 Bee"] },
  { id: "p6", text: "Pick a power for one day.", choices: ["🪽 Fly", "🫥 Invisible", "⚡ Super speed", "🧠 Read minds", "⏸️ Pause time"] },
  { id: "p7", text: "What makes a road trip better?", choices: ["🎵 Music", "🍬 Snacks", "😂 Jokes", "🗺️ Detours", "😴 Naps"] },
  { id: "p8", text: "Choose a perfect Friday night.", choices: ["🎮 Games", "🎬 Movie", "🛼 Going out", "🍕 Food", "💤 Early sleep"] }
];

export function createRoomState(code, hostPlayer, rounds = DEFAULT_ROUNDS) {
  return {
    gameVersion: GAME_VERSION,
    code,
    phase: "lobby",
    hostId: hostPlayer.id,
    players: { [hostPlayer.id]: hostPlayer },
    roundIndex: -1,
    rounds,
    mode: null,
    prompt: null,
    answers: {},
    scores: { [hostPlayer.id]: 0 },
    deadline: null,
    lastResults: null,
    syncHistory: [],
    seq: 0,
    stateHash: null
  };
}

export function publicState(state) {
  const players = Object.values(state.players)
    .map(({ resumeToken, ...safe }) => safe)
    .sort((a, b) => (a.id === state.hostId ? -1 : b.id === state.hostId ? 1 : a.name.localeCompare(b.name)));
  const answers = state.phase === "reveal" || state.phase === "results"
    ? state.answers
    : Object.fromEntries(Object.keys(state.answers).map((id) => [id, true]));
  return { ...state, players, answers };
}

export function joinPlayer(state, player) {
  if (state.phase !== "lobby") throw new Error("Game already started");
  if (Object.keys(state.players).length >= 8) throw new Error("Room is full");
  return {
    ...state,
    players: { ...state.players, [player.id]: player },
    scores: { ...state.scores, [player.id]: 0 }
  };
}

export function startGame(state, actorId, now = Date.now()) {
  if (state.hostId !== actorId) throw new Error("Only the host can start");
  if (state.phase !== "lobby" && state.phase !== "results") throw new Error("Cannot start now");
  const connected = Object.values(state.players).filter((player) => player.connected).length;
  if (connected < 2) throw new Error("At least 2 connected players are required");
  const reset = {
    ...state,
    roundIndex: -1,
    scores: Object.fromEntries(Object.keys(state.players).map((id) => [id, 0])),
    answers: {},
    syncHistory: [],
    lastResults: null
  };
  return startRound(reset, now);
}

export function startRound(state, now = Date.now()) {
  const next = state.roundIndex + 1;
  if (next >= state.rounds) return { ...state, phase: "results", deadline: null };
  return {
    ...state,
    phase: "choosing",
    roundIndex: next,
    mode: MODES[next % MODES.length],
    prompt: PROMPTS[next % PROMPTS.length],
    answers: {},
    lastResults: null,
    deadline: now + ROUND_SECONDS * 1000
  };
}

export function submitChoice(state, actorId, choiceIndex) {
  if (state.phase !== "choosing") throw new Error("Round is not accepting choices");
  if (!state.players[actorId]) throw new Error("Unknown player");
  if (Object.prototype.hasOwnProperty.call(state.answers, actorId)) throw new Error("Choice already locked");
  if (!Number.isInteger(choiceIndex) || choiceIndex < 0 || choiceIndex >= state.prompt.choices.length) throw new Error("Invalid choice");
  return { ...state, answers: { ...state.answers, [actorId]: choiceIndex } };
}

export function revealRound(state) {
  if (state.phase !== "choosing") return state;

  const entries = Object.entries(state.answers);
  const counts = {};
  for (const [, value] of entries) counts[value] = (counts[value] || 0) + 1;
  const positiveCounts = Object.values(counts).filter((value) => value > 0);
  const top = positiveCounts.length ? Math.max(...positiveCounts) : 0;
  const total = entries.length;
  const syncPercent = total ? Math.round((top / total) * 100) : 0;
  const distinctChoices = positiveCounts.length;

  let winners = [];
  const modeId = state.mode?.id || "classic";
  if (modeId === "classic") {
    winners = entries.filter(([, choice]) => counts[choice] === top && top > 0).map(([id]) => id);
  } else if (modeId === "twin") {
    winners = entries.filter(([, choice]) => counts[choice] === 2).map(([id]) => id);
  } else if (modeId === "odd") {
    winners = entries.filter(([, choice]) => counts[choice] === 1).map(([id]) => id);
  } else if (modeId === "reverse") {
    const min = distinctChoices > 1 ? Math.min(...positiveCounts) : 0;
    winners = min ? entries.filter(([, choice]) => counts[choice] === min).map(([id]) => id) : [];
  } else if (modeId === "perfect") {
    winners = total >= 2 && distinctChoices === 1 ? entries.map(([id]) => id) : [];
  }

  const scores = { ...state.scores };
  for (const id of winners) scores[id] = (scores[id] || 0) + 3;

  return {
    ...state,
    phase: "reveal",
    scores,
    deadline: null,
    syncHistory: [...state.syncHistory, syncPercent],
    lastResults: {
      mode: state.mode,
      counts,
      winners,
      points: 3,
      syncPercent,
      totalAnswers: total
    }
  };
}

export function advance(state, actorId, now = Date.now()) {
  if (state.hostId !== actorId) throw new Error("Only the host can advance");
  if (state.phase !== "reveal") throw new Error("Cannot advance now");
  if (state.roundIndex + 1 >= state.rounds) return { ...state, phase: "results", deadline: null };
  return startRound(state, now);
}

export function averageSync(state) {
  if (!state.syncHistory?.length) return 0;
  return Math.round(state.syncHistory.reduce((sum, value) => sum + value, 0) / state.syncHistory.length);
}
