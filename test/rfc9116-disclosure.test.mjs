import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('RFC 9116 disclosure is a public static asset, never a protected API bypass', () => {
  const config = readFileSync('wrangler.toml', 'utf8');
  assert.match(config, /directory\s*=\s*"\.\/public"/);
  assert.match(config, /not_found_handling\s*=\s*"404-page"/);
  assert.doesNotMatch(config, /run_worker_first\s*=\s*\[[^\]]*\.well-known/u);

  const contents = readFileSync('public/.well-known/security.txt', 'utf8');
  assert.match(contents, /^Contact: mailto:founder@jussco\.company$/m);
  const expiration = contents.match(/^Expires: ([^\r\n]+)$/m);
  assert.ok(expiration && Number.isFinite(Date.parse(expiration[1])) &&
    Date.parse(expiration[1]) > Date.now(), 'disclosure must have a future expiry');
  assert.match(contents, /^Canonical: https:\/\/sync-party-game\.mcgill-raylene\.workers\.dev\/\.well-known\/security\.txt$/m);
  assert.match(contents, /^Policy: https:\/\/github\.com\/jussray\/sync-party-game\/blob\/main\/SECURITY\.md$/m);
});
