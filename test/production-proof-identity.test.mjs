import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Guards the public production proof in deploy.yml. The proof must pin the
// deployed identity (SHA + Cloudflare build) before tests, recheck it after
// tests, and only then write a receipt that says VERIFIED. Without the recheck,
// a deployment that changes mid-proof still produces a VERIFIED receipt.

const DEPLOY = new URL('../.github/workflows/deploy.yml', import.meta.url);
const text = readFileSync(DEPLOY, 'utf8');
const jobStart = text.indexOf('\n  production-proof:');
const job = jobStart === -1 ? '' : text.slice(jobStart);

function stepNames(block) {
  return [...block.matchAll(/^ {6}- name: (.+)$/gm)].map((m) => m[1].trim());
}

function stepBody(block, name) {
  const names = stepNames(block);
  const start = block.indexOf(`- name: ${name}`);
  assert.notEqual(start, -1, `missing step: ${name}`);
  const next = block.indexOf('\n      - name:', start + 1);
  return block.slice(start, next === -1 ? undefined : next);
}

test('production-proof job exists', () => {
  assert.notEqual(jobStart, -1, 'production-proof job not found in deploy.yml');
});

test('production-proof pins the deployed identity before tests', () => {
  const names = stepNames(job);
  const pin = names.indexOf('Pin exact deployed identity');
  const suite = names.indexOf('Run full multiplayer suite against public production');
  assert.notEqual(pin, -1, 'missing step: Pin exact deployed identity');
  assert.notEqual(suite, -1, 'missing step: Run full multiplayer suite');
  assert.ok(pin < suite, 'identity must be pinned before the multiplayer suite runs');
  assert.match(stepBody(job, 'Pin exact deployed identity'), /GITHUB_ENV/, 'pinned build must be exported to later steps');
});

test('production-proof rechecks SHA and build after tests and fails on any change', () => {
  const names = stepNames(job);
  const suite = names.indexOf('Run full multiplayer suite against public production');
  const recheck = names.indexOf('Recheck exact deployed identity after tests');
  assert.notEqual(recheck, -1, 'missing step: Recheck exact deployed identity after tests');
  assert.ok(recheck > suite, 'recheck must run after the multiplayer suite');
  const body = stepBody(job, 'Recheck exact deployed identity after tests');
  assert.match(body, /PINNED_BUILD/, 'recheck must compare against the pinned build');
  assert.match(body, /EXPECTED_SHA/, 'recheck must compare against the expected SHA');
  assert.match(body, /process\.exit\(1\)/, 'recheck must fail on mismatch');
});

test('production-proof writes VERIFIED only after the identity recheck', () => {
  const names = stepNames(job);
  const recheck = names.indexOf('Recheck exact deployed identity after tests');
  const receipt = names.indexOf('Write production proof receipt');
  assert.notEqual(receipt, -1, 'missing step: Write production proof receipt');
  assert.ok(receipt > recheck, 'receipt must be written after the recheck');
  const body = stepBody(job, 'Write production proof receipt');
  assert.match(body, /result=VERIFIED/);
  assert.match(body, /PINNED_BUILD/, 'receipt must bind the pinned Cloudflare build');
});
