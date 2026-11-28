export const GAME_VERSION = 1;
export const ROUND_SECONDS = 15;
export const DEFAULT_ROUNDS = 5;
export const LOCK_MS = 1500; // brief tension beat between LOCK and REVEAL

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
  { id: "p8", text: "Choose a perfect Friday night.", choices: ["🎮 Games", "🎬 Movie", "🛼 Going out", "🍕 Food", "💤 Early sleep"] },
  { id: "p9", text: "The group chat went silent. What revives it?", choices: ["😂 A meme", "📸 Photo dump", "🎤 Voice note", "🔥 Hot gossip", "🎲 Random question"] },
  { id: "p10", text: "Pick a dream house upgrade.", choices: ["🎬 Movie room", "🏊 Pool", "🍕 Pizza oven", "🎮 Game loft", "🌿 Garden deck"] },
  { id: "p11", text: "What makes the group photo iconic?", choices: ["😎 Sunglasses", "✌️ Peace signs", "🤪 Silly faces", "👕 Matching shirts", "🐶 The dog"] },
  { id: "p12", text: "Pick the ultimate birthday surprise.", choices: ["🎂 Cake drop", "🎈 Balloon room", "🎤 Singing crew", "🎁 Mystery box", "🚗 Surprise trip"] },
  { id: "p13", text: "Settle it: the best pizza topping is…", choices: ["🧀 Extra cheese", "🍖 Pepperoni", "🍍 Pineapple", "🍄 Mushrooms", "🌶️ Jalapeños"] },
  { id: "p14", text: "What's the group's karaoke anthem?", choices: ["🎤 Power ballad", "🕺 Dance hit", "🎸 Rock classic", "🎶 Throwback jam", "😂 Meme song"] },
  { id: "p15", text: "Choose a vacation rental vibe.", choices: ["🏖️ Beach house", "🛖 Cozy cabin", "🏙️ City loft", "🏰 Fancy villa", "🚐 Camper van"] },
  { id: "p16", text: "Pick the best rainy-day plan.", choices: ["🎲 Board games", "🧩 Puzzle day", "🍪 Baking day", "🎮 Tournament", "😴 Nap marathon"] },
  { id: "p17", text: "The Wi-Fi dies for a whole day. First move?", choices: ["📚 Read a book", "🚶 Group walk", "🃏 Card games", "🍳 Cook together", "😴 Sleep it off"] },
  { id: "p18", text: "Pick a group costume theme.", choices: ["🦸 Superheroes", "🏴‍☠️ Pirates", "👽 Aliens", "🎬 Movie stars", "🦖 Dinosaurs"] },
  { id: "p19", text: "What's the best concert seat?", choices: ["🎤 Front row", "🎶 Middle crowd", "🪑 Back row chill", "🎧 VIP lounge", "📺 From home"] },
  { id: "p20", text: "Choose a midnight snack run target.", choices: ["🌮 Taco truck", "🍩 Donut shop", "🍔 Burger joint", "🏪 Corner store", "🍦 Ice cream stand"] },
  { id: "p21", text: "Pick a dream job for one week.", choices: ["🚀 Astronaut", "🎬 Movie director", "🏝️ Island host", "🎮 Game tester", "🍰 Taste tester"] },
  { id: "p22", text: "What wins the talent show?", choices: ["🎤 Singing", "💃 Dancing", "🎩 Magic tricks", "😂 Comedy", "🎸 Guitar solo"] },
  { id: "p23", text: "What's the first thing you'd teach a robot?", choices: ["💃 A dance", "😂 A joke", "🍳 Cooking", "🎮 Gaming", "🤗 A hug"] },
  { id: "p24", text: "Choose a season for the group trip.", choices: ["☀️ Summer", "🍂 Fall", "❄️ Winter", "🌸 Spring", "🎲 Surprise us"] }
];

function shuffledCopy(items, rng) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Build one game's deal: `rounds` slots of { modeId, promptId }, chosen when
// the game starts and stored in the authoritative state. Modes cycle through
// shuffled permutations of all five, so a 5-round game showcases every mode
// exactly once; prompts come from shuffled passes over the pool, so a game's
// prompts are always distinct (and never repeat back-to-back across passes).
export function buildDeal(rounds = DEFAULT_ROUNDS, rng = Math.random) {
  const modeOrder = [];
  while (modeOrder.length < rounds) modeOrder.push(...shuffledCopy(MODES.map((mode) => mode.id), rng));
  const promptOrder = [];
  while (promptOrder.length < rounds) {
    const pass = shuffledCopy(PROMPTS.map((prompt) => prompt.id), rng);
    if (promptOrder.length && pass[0] === promptOrder[promptOrder.length - 1]) {
      [pass[0], pass[1]] = [pass[1], pass[0]];
    }
    promptOrder.push(...pass);
  }
  return Array.from({ length: rounds }, (_, index) => ({ modeId: modeOrder[index], promptId: promptOrder[index] }));
}

export function createRoomState(code, hostPlayer, rounds = DEFAULT_ROUNDS) {
  return {
    gameVersion: GAME_VERSION,
    code,
    phase: "lobby",
    hostId: hostPlayer.id,
    players: { [hostPlayer.id]: hostPlayer },
    roundIndex: -1,
    rounds,
    deal: null,
    mode: null,
    prompt: null,
    answers: {},
    scores: { [hostPlayer.id]: 0 },
    deadline: null,
    revealAt: null,
    lastResults: null,
    syncHistory: [],
    seq: 0,
    stateHash: null
  };
}

export function publicAnswers(state) {
  return state.phase === "reveal" || state.phase === "results"
    ? state.answers
    : Object.fromEntries(Object.keys(state.answers).map((id) => [id, true]));
}

export function publicFingerprint(state) {
  return {
    gameVersion: state.gameVersion,
    code: state.code,
    phase: state.phase,
    roundIndex: state.roundIndex,
    hostId: state.hostId,
    mode: state.mode?.id || null,
    players: Object.fromEntries(
      Object.entries(state.players)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([id, player]) => [id, { connected: player.connected, name: player.name }])
    ),
    scores: state.scores,
    answers: publicAnswers(state),
    syncHistory: state.syncHistory,
    seq: state.seq
  };
}

export function publicState(state) {
  const players = Object.values(state.players)
    .map(({ resumeToken, ...safe }) => safe)
    .sort((a, b) => (a.id === state.hostId ? -1 : b.id === state.hostId ? 1 : a.name.localeCompare(b.name)));
  // The deal is server-side authority: clients play the round they are dealt
  // (state.mode / state.prompt) and never receive upcoming rounds in advance.
  const { deal, ...rest } = state;
  return { ...rest, players, answers: publicAnswers(state) };
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

export function startGame(state, actorId, now = Date.now(), rng = Math.random) {
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
    lastResults: null,
    deal: buildDeal(state.rounds, rng)
  };
  return startRound(reset, now);
}

export function startRound(state, now = Date.now()) {
  const next = state.roundIndex + 1;
  if (next >= state.rounds) return { ...state, phase: "results", deadline: null };
  const slot = Array.isArray(state.deal) ? state.deal[next] : null;
  const mode = (slot && MODES.find((entry) => entry.id === slot.modeId)) || MODES[next % MODES.length];
  const prompt = (slot && PROMPTS.find((entry) => entry.id === slot.promptId)) || PROMPTS[next % PROMPTS.length];
  return {
    ...state,
    phase: "choosing",
    roundIndex: next,
    mode,
    prompt,
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

export function allConnectedAnswered(state) {
  const connected = Object.values(state.players).filter((player) => player.connected).map((player) => player.id);
  return connected.length >= 2 && connected.every((id) => Object.prototype.hasOwnProperty.call(state.answers, id));
}

export function lockRound(state, now = Date.now()) {
  if (state.phase !== "choosing") throw new Error("Cannot lock now");
  return { ...state, phase: "locked", deadline: null, revealAt: now + LOCK_MS };
}

export function transferHostIfGone(state) {
  if (state.players[state.hostId]?.connected) return state;
  const next = Object.values(state.players).find((player) => player.connected);
  return next ? { ...state, hostId: next.id } : state;
}

export function revealRound(state) {
  if (state.phase !== "locked") throw new Error("Cannot reveal now");

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
    winners = top > total / 2 ? entries.filter(([, choice]) => counts[choice] === top).map(([id]) => id) : [];
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
    revealAt: null,
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
