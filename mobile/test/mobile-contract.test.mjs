import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

const screen = read('mobile/app/index.tsx');
const protocol = read('mobile/src/protocol.ts');
const worker = read('src/worker.js');
const authority = JSON.parse(read('.deployment-authority.json'));
const appConfig = JSON.parse(read('mobile/app.json'));

test('native client uses the authoritative room HTTP and WebSocket protocol', () => {
  assert.match(worker, /\/api\/rooms\/create/);
  assert.match(worker, /join\|ws/);
  assert.match(protocol, /\/api\/rooms\/create/);
  assert.match(protocol, /\/join`/);
  assert.match(protocol, /\/ws`/);
  assert.match(protocol, /playerId/);
  assert.match(protocol, /resumeToken/);
});

test('native utility is additive and not a WebView copy of the no-install game', () => {
  assert.match(screen, /expo-haptics/);
  assert.match(screen, /Share\.share/);
  assert.match(screen, /SUBMIT_CHOICE/);
  assert.match(screen, /START_GAME/);
  assert.match(screen, /REMATCH/);
  assert.doesNotMatch(screen, /WebView|react-native-webview/i);
});

test('store identity is explicit and web deployment proof is not silently inherited', () => {
  assert.equal(appConfig.expo.ios.bundleIdentifier, 'com.jussray.syncparty');
  assert.equal(appConfig.expo.android.package, 'com.jussray.syncparty');
  assert.equal(authority.policy, 'unknown-paths-invalidate-candidate');
  assert.ok(!authority.safe_drift_globs.some((glob) => glob.startsWith('mobile')));
});
