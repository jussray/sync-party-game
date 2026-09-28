import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const challengeStack = [
  'ULTRATHINK',
  'Red Team 1 — premise',
  'Lindy mode',
  'L99',
  'Red Team 2 — implementation',
  'OODA',
  'Proof',
  'Rollback / Next Gate',
];

test('Founder Intelligence inheritance is locally complete and ordered', async () => {
  const [agents, entrypoint, constitution] = await Promise.all([
    read('AGENTS.md'),
    read('AGENTS_FOUNDER_INTELLIGENCE.md'),
    read('docs/FOUNDER_INTELLIGENCE_CONSTITUTION.md'),
  ]);

  assert.match(agents, /AGENTS_FOUNDER_INTELLIGENCE\.md/);
  assert.match(agents, /docs\/FOUNDER_INTELLIGENCE_CONSTITUTION\.md/);
  assert.match(entrypoint, /challenge-stack: v1\.0\.0/);

  let previous = -1;
  for (const step of challengeStack) {
    const index = entrypoint.indexOf(step);
    assert.ok(index > previous, `challenge stack drifted or is missing: ${step}`);
    previous = index;
  }

  for (const required of [
    'Durable Object remains gameplay authority',
    'privacy-safe SYNC evidence',
    'Playwright evidence',
    'independently operable',
  ]) {
    assert.ok(entrypoint.includes(required), `entrypoint missing boundary: ${required}`);
  }

  for (const required of [
    'Evidence outranks confidence',
    'observational',
    'room codes',
    'exact-green-SHA',
    'standalone operation',
  ]) {
    assert.ok(constitution.includes(required), `constitution missing boundary: ${required}`);
  }
});
