import test from "node:test";
import assert from "node:assert/strict";
import { advance, allConnectedAnswered, buildDeal, createRoomState, joinPlayer, lockRound, MODES, PROMPTS, publicFingerprint, publicState, revealRound, startGame, startRound, submitChoice, transferHostIfGone } from "../src/game.js";

const player = (id, name, connected = true) => ({ id, name, resumeToken: `r-${id}`, connected });
// A constant near-1 RNG makes the Fisher-Yates shuffle swap every slot with
// itself, so the deal comes out in the canonical order (classic -> perfect,
// p1 -> p5). The mode tests below were written against that order and stay
// exact; production startGame calls use the default Math.random.
const identityRng = () => 0.999999;
function startedWith(rng, ids = ["a", "b", "c"]) {
  let state = createRoomState("ABCDE", player(ids[0], ids[0]), 5);
  for (const id of ids.slice(1)) state = joinPlayer(state, player(id, id));
  return startGame(state, ids[0], 1000, rng);
}
function started(ids = ["a", "b", "c"]) {
  return startedWith(identityRng, ids);
}
function answer(state, mapping) {
  for (const [id, choice] of Object.entries(mapping)) state = submitChoice(state, id, choice);
  return revealRound(lockRound(state, 5000));
}

test("requires at least two connected players", () => {
  let state = createRoomState("ABCDE", player("a", "Ray", true));
  state = joinPlayer(state, player("b", "Night", false));
  assert.throws(() => startGame(state, "a", 1000), /2 connected/);
});
test("host authority and valid phase transitions are enforced", () => {
  let state = createRoomState("ABCDE", player("a", "Ray"));
  state = joinPlayer(state, player("b", "Night"));
  assert.throws(() => startGame(state, "b", 1000), /Only the host/);
  state = startGame(state, "a", 1000);
  assert.throws(() => advance(state, "a", 2000), /Cannot advance/);
});
test("choice is immutable after lock", () => {
  let state = started(["a", "b"]);
  state = submitChoice(state, "a", 0);
  assert.throws(() => submitChoice(state, "a", 1), /already locked/);
});
test("choice validation rejects impossible answer index", () => {
  const state = started(["a", "b"]);
  assert.throws(() => submitChoice(state, "a", 999), /Invalid choice/);
});
test("hidden choices cannot be inferred from public state or fingerprint", () => {
  const base = started(["a", "b"]);
  const choseZero = submitChoice(base, "a", 0);
  const choseFour = submitChoice(base, "a", 4);

  assert.deepEqual(publicState(choseZero).answers, { a: true });
  assert.deepEqual(publicState(choseFour).answers, { a: true });
  assert.deepEqual(publicFingerprint(choseZero), publicFingerprint(choseFour));
  assert.equal(Object.prototype.hasOwnProperty.call(publicState(choseZero).players[0], "resumeToken"), false);
});
test("revealed choices become part of the public fingerprint only after reveal", () => {
  let state = started(["a", "b"]);
  state = submitChoice(state, "a", 2);
  state = submitChoice(state, "b", 3);
  const lockedA = lockRound(state, 5000);
  const lockedB = lockRound(submitChoice(submitChoice(started(["a", "b"]), "a", 4), "b", 0), 5000);
  assert.deepEqual(publicFingerprint(lockedA), publicFingerprint(lockedB), "LOCKED fingerprint leaks nothing");
  state = revealRound(lockedA);

  assert.deepEqual(publicState(state).answers, { a: 2, b: 3 });
  assert.deepEqual(publicFingerprint(state).answers, { a: 2, b: 3 });
});
test("classic awards the majority and computes sync percent", () => {
  const revealed = answer(started(), { a: 0, b: 0, c: 1 });
  assert.deepEqual(revealed.lastResults.winners.sort(), ["a", "b"]);
  assert.equal(revealed.lastResults.syncPercent, 67);
});
test("classic awards nobody when there is no true majority", () => {
  const revealed = answer(started(["a", "b"]), { a: 0, b: 1 });
  assert.deepEqual(revealed.lastResults.winners, []);
  assert.deepEqual(revealed.scores, { a: 0, b: 0 });
  assert.equal(revealed.lastResults.syncPercent, 50);
});
test("twin awards answers chosen by exactly two players", () => {
  let state = started(["a", "b", "c", "d"]);
  state = answer(state, { a: 0, b: 0, c: 1, d: 2 });
  state = advance(state, "a", 2000);
  state = answer(state, { a: 0, b: 0, c: 1, d: 2 });
  assert.equal(state.mode.id, "twin");
  assert.deepEqual(state.lastResults.winners.sort(), ["a", "b"]);
});
test("odd one out awards unique choices", () => {
  let state = started(["a", "b", "c"]);
  state = answer(state, { a: 0, b: 0, c: 1 });
  state = advance(state, "a", 2000);
  state = answer(state, { a: 0, b: 0, c: 1 });
  state = advance(state, "a", 3000);
  state = answer(state, { a: 0, b: 0, c: 1 });
  assert.equal(state.mode.id, "odd");
  assert.deepEqual(state.lastResults.winners, ["c"]);
});
test("reverse awards the smallest non-zero group", () => {
  let state = started(["a", "b", "c"]);
  for (let round = 0; round < 3; round += 1) {
    state = answer(state, { a: 0, b: 0, c: 1 });
    state = advance(state, "a", 2000 + round);
  }
  state = answer(state, { a: 0, b: 0, c: 1 });
  assert.equal(state.mode.id, "reverse");
  assert.deepEqual(state.lastResults.winners, ["c"]);
});
test("perfect sync only awards a unanimous room", () => {
  let state = started(["a", "b", "c"]);
  for (let round = 0; round < 4; round += 1) {
    state = answer(state, { a: 0, b: 0, c: 1 });
    state = advance(state, "a", 2000 + round);
  }
  state = answer(state, { a: 2, b: 2, c: 2 });
  assert.equal(state.mode.id, "perfect");
  assert.deepEqual(state.lastResults.winners.sort(), ["a", "b", "c"]);
  assert.equal(state.lastResults.syncPercent, 100);
});

test("state machine: CHOOSING -> LOCKED -> REVEAL, no skipping, no choices after lock", () => {
  let state = started(["a", "b"]);
  assert.throws(() => revealRound(state), /Cannot reveal/);
  state = submitChoice(state, "a", 1);
  assert.equal(allConnectedAnswered(state), false);
  state = submitChoice(state, "b", 1);
  assert.equal(allConnectedAnswered(state), true);
  state = lockRound(state, 5000);
  assert.equal(state.phase, "locked");
  assert.equal(state.revealAt, 5000 + 1500);
  assert.throws(() => submitChoice(state, "a", 2), /not accepting/);
  assert.deepEqual(publicState(state).answers, { a: true, b: true }, "answers private while locked");
  assert.throws(() => lockRound(state, 6000), /Cannot lock/);
  state = revealRound(state);
  assert.equal(state.phase, "reveal");
  assert.equal(state.lastResults.syncPercent, 100);
  assert.throws(() => revealRound(state), /Cannot reveal/, "reveal cannot double-score");
});
test("disconnected players are not counted as answered", () => {
  let state = started(["a", "b", "c"]);
  state = submitChoice(submitChoice(state, "a", 0), "b", 0);
  assert.equal(allConnectedAnswered(state), false);
  state = { ...state, players: { ...state.players, c: { ...state.players.c, connected: false } } };
  assert.equal(allConnectedAnswered(state), true);
});
test("host authority transfers to a connected player when the host drops", () => {
  let state = started(["a", "b", "c"]);
  assert.equal(transferHostIfGone(state).hostId, "a");
  state = { ...state, players: { ...state.players, a: { ...state.players.a, connected: false } } };
  state = transferHostIfGone(state);
  assert.equal(state.hostId, "b");
  assert.doesNotThrow(() => advance(revealRound(lockRound(state, 1)), "b", 2));
  assert.throws(() => advance(revealRound(lockRound(state, 1)), "a", 2), /Only the host/);
});

test("prompt pool holds 24 unique prompts with five choices each", () => {
  assert.equal(PROMPTS.length, 24);
  assert.equal(new Set(PROMPTS.map((prompt) => prompt.id)).size, 24);
  assert.equal(new Set(PROMPTS.map((prompt) => prompt.text)).size, 24);
  for (const prompt of PROMPTS) assert.equal(prompt.choices.length, 5);
});
test("a deal showcases every mode exactly once with five distinct prompts", () => {
  const deal = buildDeal(5, () => 0);
  assert.equal(deal.length, 5);
  assert.deepEqual(deal.map((slot) => slot.modeId).sort(), MODES.map((mode) => mode.id).sort());
  assert.equal(new Set(deal.map((slot) => slot.promptId)).size, 5);
});
test("a shuffled game plays its deal in order, all modes once, prompts distinct", () => {
  let state = startedWith(() => 0, ["a", "b"]);
  const modeIds = [];
  const promptIds = [];
  for (let round = 0; round < 5; round += 1) {
    modeIds.push(state.mode.id);
    promptIds.push(state.prompt.id);
    state = answer(state, { a: 0, b: 0 });
    if (round < 4) state = advance(state, "a", 2000 + round);
  }
  assert.deepEqual(modeIds, state.deal.map((slot) => slot.modeId));
  assert.deepEqual(promptIds, state.deal.map((slot) => slot.promptId));
  assert.equal(new Set(modeIds).size, 5);
  assert.equal(new Set(promptIds).size, 5);
});
test("consecutive games and a rematch never repeat the previous deal order", () => {
  const first = startedWith(identityRng, ["a", "b"]);
  const second = startedWith(() => 0, ["a", "b"]);
  assert.notDeepEqual(second.deal, first.deal);
  assert.notDeepEqual(second.deal.map((slot) => slot.modeId), first.deal.map((slot) => slot.modeId));

  let rematch = first;
  for (let round = 0; round < 5; round += 1) {
    rematch = answer(rematch, { a: 0, b: 0 });
    rematch = advance(rematch, "a", 3000 + round);
  }
  assert.equal(rematch.phase, "results");
  rematch = startGame(rematch, "a", 9000, () => 0);
  assert.notDeepEqual(rematch.deal, first.deal);
  assert.notDeepEqual(rematch.deal.map((slot) => slot.modeId), first.deal.map((slot) => slot.modeId));
});
test("the deal stays server-side and never reaches public state", () => {
  const state = startedWith(() => 0, ["a", "b"]);
  assert.equal(Object.prototype.hasOwnProperty.call(publicState(state), "deal"), false);
  assert.equal(publicState(state).mode.id, state.mode.id);
  assert.equal(publicState(state).prompt.id, state.prompt.id);
});
test("rounds without a deal keep the original fixed cycles", () => {
  const legacy = { ...createRoomState("LEGAC", player("a", "a")), deal: null };
  const round = startRound(legacy, 1000);
  assert.equal(round.mode.id, "classic");
  assert.equal(round.prompt.id, "p1");
});
