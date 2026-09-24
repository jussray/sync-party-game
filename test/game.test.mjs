import test from "node:test";
import assert from "node:assert/strict";
import { advance, createRoomState, joinPlayer, publicFingerprint, publicState, revealRound, startGame, submitChoice } from "../src/game.js";

const player = (id, name, connected = true) => ({ id, name, resumeToken: `r-${id}`, connected });
function started(ids = ["a", "b", "c"]) {
  let state = createRoomState("ABCDE", player(ids[0], ids[0]), 5);
  for (const id of ids.slice(1)) state = joinPlayer(state, player(id, id));
  return startGame(state, ids[0], 1000);
}
function answer(state, mapping) {
  for (const [id, choice] of Object.entries(mapping)) state = submitChoice(state, id, choice);
  return revealRound(state);
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
  state = revealRound(state);

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
