import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const agents = readFileSync(new URL("../AGENTS.md", import.meta.url), "utf8");
const carrier = readFileSync(new URL("../AGENTS_FOUNDER_INTELLIGENCE.md", import.meta.url), "utf8");
const constitution = readFileSync(new URL("../docs/FOUNDER_INTELLIGENCE_CONSTITUTION.md", import.meta.url), "utf8");

const orderedChallengeStack = [
  "ULTRATHINK",
  "Red Team 1 — premise",
  "Lindy mode",
  "L99",
  "Red Team 2 — implementation",
  "OODA",
  "Proof",
  "Rollback / Next Gate",
];

test("primary agent contract explicitly loads Founder Intelligence", () => {
  assert.match(agents, /AGENTS_FOUNDER_INTELLIGENCE\.md/);
  assert.match(agents, /docs\/FOUNDER_INTELLIGENCE_CONSTITUTION\.md/);
  assert.match(agents, /Playwright evidence/);
});

test("Founder Intelligence challenge stack remains ordered", () => {
  let cursor = -1;
  for (const step of orderedChallengeStack) {
    const next = carrier.indexOf(step, cursor + 1);
    assert.ok(next > cursor, `${step} must appear after the previous challenge-stack step`);
    cursor = next;
  }
});

test("local constitution preserves Sync authority and privacy boundaries", () => {
  for (const required of [
    "Founder authority",
    "Multiplayer authority",
    "Control-room boundary",
    "Privacy",
    "Reversibility and continuity",
    "Verification",
    "Non-deletion",
  ]) {
    assert.ok(constitution.includes(required), `missing constitution section: ${required}`);
  }
  assert.match(constitution, /room codes, player names, resume tokens, answer choices/i);
  assert.match(constitution, /exact-SHA public readback/i);
});
