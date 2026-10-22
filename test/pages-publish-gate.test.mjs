import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

// Guards the release gate: any workflow that publishes the repository tree to
// GitHub Pages must not auto-run on push to main. Automatic publication of the
// whole repo bypasses the exact-green-SHA promotion in deploy.yml and produces
// an unverified public copy on every push.

const WORKFLOWS = new URL('../.github/workflows/', import.meta.url);

function workflowFiles() {
  return readdirSync(WORKFLOWS).filter((f) => /\.ya?ml$/.test(f));
}

function publishesRepoRoot(text) {
  return /upload-pages-artifact/.test(text) && /path:\s*['"]?\.['"]?\s*$/m.test(text);
}

function autoRunsOnPush(text) {
  // Top-level `on:` block: indented lines until the next unindented key.
  const block = text.match(/^on:[^\n]*\n((?:[ \t]+[^\n]*\n|[ \t]*\n)*)/m);
  return Boolean(block && /^[ \t]+push:/m.test(block[1]));
}

test('no Pages workflow that publishes the repo root auto-runs on push', () => {
  const offenders = [];
  for (const file of workflowFiles()) {
    const text = readFileSync(new URL(file, WORKFLOWS), 'utf8');
    if (publishesRepoRoot(text) && autoRunsOnPush(text)) offenders.push(file);
  }
  assert.deepEqual(offenders, [], `auto-publishing repo-root Pages workflows: ${offenders.join(', ')}`);
});
