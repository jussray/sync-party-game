#!/usr/bin/env node
// Seeded multiplayer attack harness against a REAL running Worker + Durable Object
// (local `wrangler dev` or the public deployment). No mocks.
//
//   ATTACK_BASE_URL=http://127.0.0.1:8787 ATTACK_SEED=7 node scripts/attack.mjs
//
// Invariant: every surviving client converges to one authoritative room state
// (same seq + stateHash), receipts form an unbroken seq/hash chain, answers stay
// private before reveal, and forged / duplicate / out-of-phase intents never mutate state.

const BASE = (process.env.ATTACK_BASE_URL || "http://127.0.0.1:8787").replace(/\/$/, "");
const SEED = Number(process.env.ATTACK_SEED || 1);
const GAMES = Number(process.env.ATTACK_GAMES || 2);
const WS_BASE = BASE.replace(/^http/, "ws");

let rngState = SEED >>> 0 || 1;
const rand = () => { rngState ^= rngState << 13; rngState ^= rngState >>> 17; rngState ^= rngState << 5; return (rngState >>> 0) / 4294967296; };
const pick = (list) => list[Math.floor(rand() * list.length)];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const failures = [];
const check = (ok, message) => { if (!ok) { failures.push(message); console.error(`  ✘ ${message}`); } };

async function post(path, body) {
  const response = await fetch(`${BASE}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: response.status, data: await response.json().catch(() => ({})) };
}

class Client {
  constructor(code, identity, label) { Object.assign(this, { code, identity, label, state: null, errors: [], waiters: [] }); }
  connect(token = this.identity.resumeToken, playerId = this.identity.playerId) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${WS_BASE}/api/rooms/${this.code}/ws?playerId=${encodeURIComponent(playerId)}&token=${encodeURIComponent(token)}`);
      ws.onopen = () => { this.ws = ws; resolve(ws); };
      ws.onerror = () => reject(new Error(`${this.label}: websocket rejected`));
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === "STATE") {
          if (this.state && message.state.seq < this.state.seq) return; // ignore stale
          this.state = message.state;
          this.waiters = this.waiters.filter((waiter) => !waiter(this.state));
        }
        if (message.type === "ERROR") this.errors.push(message.error);
      };
    });
  }
  send(action) { if (this.ws?.readyState === 1) this.ws.send(typeof action === "string" ? action : JSON.stringify(action)); }
  close() { this.ws?.close(); this.ws = null; }
  until(predicate, ms = 8000) {
    if (this.state && predicate(this.state)) return Promise.resolve(this.state);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${this.label}: timeout waiting (phase=${this.state?.phase} seq=${this.state?.seq})`)), ms);
      this.waiters.push((state) => { if (predicate(state)) { clearTimeout(timer); resolve(state); return true; } return false; });
    });
  }
}

async function converge(clients, label) {
  await sleep(250);
  const live = clients.filter((client) => client.ws);
  const hashes = new Set(live.map((client) => `${client.state?.seq}:${client.state?.stateHash}`));
  check(hashes.size === 1, `${label}: clients diverged ${[...hashes].join(" | ")}`);
  return live[0].state;
}

async function receipts(code) {
  const response = await fetch(`${BASE}/api/rooms/${code}/receipts`);
  return response.ok ? response.json() : null;
}

async function game(round) {
  const players = 8;
  const host = await post("/api/rooms/create", { name: "Host" });
  check(host.status === 200, "create room");
  const code = host.data.code;
  const identities = [host.data];
  for (let index = 1; index < players; index += 1) identities.push((await post(`/api/rooms/${code}/join`, { name: `P${index}` })).data);
  const overflow = await post(`/api/rooms/${code}/join`, { name: "Ninth" });
  check(overflow.status === 409, `9th player rejected (got ${overflow.status})`);

  const clients = identities.map((identity, index) => new Client(code, identity, `c${index}`));
  // forged token / forged player must be rejected
  await new Client(code, { playerId: identities[1].playerId, resumeToken: "r_forged" }, "forger").connect().then(
    () => check(false, "forged resume token accepted"), () => {});
  await new Client(code, { playerId: "p_nobody", resumeToken: identities[1].resumeToken }, "forger2").connect().then(
    () => check(false, "forged player id accepted"), () => {});

  await Promise.all(clients.map((client) => client.connect()));
  await Promise.all(clients.map((client) => client.until((state) => state.players.filter((p) => p.connected).length === players)));

  // non-host start + client state mutation attempts
  clients[3].send({ type: "START_GAME" });
  clients[4].send({ type: "SET_SCORE", scores: { [identities[4].playerId]: 999 } });
  clients[5].send("{not json");
  clients[5].send("null");
  clients[6].send({ type: "NEXT_ROUND", phase: "results" });
  await sleep(200);
  check(clients[0].state.phase === "lobby", "non-host could start / mutate phase");

  // late join during active game must fail
  clients[0].send({ type: "START_GAME" });
  clients[0].send({ type: "START_GAME" }); // duplicate
  await Promise.all(clients.map((client) => client.until((state) => state.phase === "choosing")));
  const late = await post(`/api/rooms/${code}/join`, { name: "Late" });
  check(late.status === 409, "late join during active game rejected");

  for (let r = 0; r < 5; r += 1) {
    await Promise.all(clients.filter((c) => c.ws).map((client) => client.until((state) => state.phase === "choosing" && state.roundIndex === r)));
    // one random guest drops and reconnects mid-round (refresh)
    const refresher = clients[1 + Math.floor(rand() * (players - 1))];
    refresher.close();
    await sleep(40);
    await refresher.connect();
    // privacy: nobody sees other answers before reveal
    const order = [...clients].sort(() => rand() - 0.5);
    const choices = new Map();
    // simultaneous submissions + duplicates + overwrite attempts
    // Round 2 of game 1: one player never answers -> the server alarm must LOCK at the deadline, then REVEAL.
    const withhold = round === 0 && r === 1 ? order[order.length - 1] : null;
    await Promise.all(order.map(async (client, index) => {
      if (client === withhold) return;
      await sleep(Math.floor(rand() * 20));
      const choice = r === 4 && round === 0 ? 0 : Math.floor(rand() * 5); // force perfect sync once
      choices.set(client.identity.playerId, choice);
      client.send({ type: "SUBMIT_CHOICE", choiceIndex: choice });
      if (index % 2 === 0) client.send({ type: "SUBMIT_CHOICE", choiceIndex: (choice + 1) % 5 }); // overwrite attempt
      if (index % 3 === 0) client.send({ type: "SUBMIT_CHOICE", choiceIndex: choice });           // duplicate
    }));
    for (const client of clients) {
      const answers = client.state.answers || {};
      if (client.state.phase === "choosing" || client.state.phase === "locked") {
        check(Object.values(answers).every((value) => value === true), `r${r}: answer leaked before reveal`);
      }
    }
    const revealed = await Promise.all(clients.map((client) => client.until((state) => state.phase === "reveal" && state.roundIndex === r, 20000)));
    const s = revealed[0];
    check(Object.keys(s.answers).length === players - (withhold ? 1 : 0), `r${r}: expected answers, got ${Object.keys(s.answers).length} (lost submission)`);
    if (withhold) check(!(withhold.identity.playerId in s.answers), "timeout: withheld player has no answer");
    if (withhold) choices.delete(withhold.identity.playerId);
    for (const [id, choice] of choices) check(s.answers[id] === choice, `r${r}: ${id} answer ${s.answers[id]} != first submission ${choice}`);
    const counts = {}; for (const v of Object.values(s.answers)) counts[v] = (counts[v] || 0) + 1;
    const expectedSync = Math.round(Math.max(...Object.values(counts)) / Object.keys(s.answers).length * 100);
    check(s.lastResults.syncPercent === expectedSync, `r${r}: sync ${s.lastResults.syncPercent} != ${expectedSync}`);
    check(s.mode.id === ["classic", "twin", "odd", "reverse", "perfect"][r], `r${r}: mode order`);
    await converge(clients, `round ${r} reveal`);

    if (r === 2) {
      // host disconnect during reveal: authority should keep the room playable
      clients[0].close();
      await sleep(300);
      const survivor = clients[1].state;
      check(survivor.hostId !== identities[0].playerId, "host disconnect: host authority transferred to a connected player");
      const newHost = clients.find((client) => client.identity.playerId === survivor.hostId);
      await clients[0].connect();
      newHost.send({ type: "NEXT_ROUND" });
      newHost.send({ type: "NEXT_ROUND" }); // duplicate advance must not skip a round
    } else {
      const hostClient = clients.find((client) => client.identity.playerId === clients[1].state.hostId);
      hostClient.send({ type: "NEXT_ROUND" });
      hostClient.send({ type: "NEXT_ROUND" });
    }
  }
  const final = await Promise.all(clients.map((client) => client.until((state) => state.phase === "results")));
  await converge(clients, "results");
  check(final[0].syncHistory.length === 5, `syncHistory length ${final[0].syncHistory.length}`);

  const chain = await receipts(code);
  check(Array.isArray(chain), "receipts endpoint");
  if (Array.isArray(chain)) {
    for (let i = 1; i < chain.length; i += 1) {
      check(chain[i].seq === chain[i - 1].seq + 1, `receipt seq gap ${chain[i - 1].seq}->${chain[i].seq}`);
      check(chain[i].previousStateHash === chain[i - 1].stateHash, `receipt hash chain broken at seq ${chain[i].seq}`);
    }
    check(chain.at(-1).stateHash === final[0].stateHash && chain.at(-1).seq === final[0].seq, "final receipt matches client state");
  }

  // rematch in the same room
  const hostClient = clients.find((client) => client.identity.playerId === final[0].hostId);
  hostClient.send({ type: "REMATCH" });
  await Promise.all(clients.map((client) => client.until((state) => state.phase === "choosing" && state.roundIndex === 0)));
  const re = await converge(clients, "rematch");
  check(re.code === code && Object.values(re.scores).every((score) => score === 0), "rematch resets scores in same room");
  clients.forEach((client) => client.close());
  const unexpected = clients.flatMap((c) => c.errors).filter((e) => !/already locked|Only the host|Cannot|Unknown action|Bad message|not accepting/.test(e));
  check(unexpected.length === 0, `unexpected server errors: ${unexpected.join("; ")}`);
  console.log(`  game ${round + 1}: room ${code}, final seq ${final[0].seq}, sync history ${final[0].syncHistory.join("/")}, receipts ${chain?.length}`);
}

console.log(`attack: base=${BASE} seed=${SEED} games=${GAMES}`);
for (let g = 0; g < GAMES; g += 1) {
  try { await game(g); } catch (error) { failures.push(`game ${g}: ${error.message}`); console.error(`  ✘ game ${g}: ${error.message}`); }
}
if (failures.length) { console.error(`ATTACK FAIL (${failures.length})`); process.exit(1); }
console.log("ATTACK PASS: 8-player rooms converged; no lost, overwritten, leaked, forged, or double-advanced state");
process.exit(0);
