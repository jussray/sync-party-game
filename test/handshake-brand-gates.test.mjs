import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../brand/handshake/', import.meta.url);
const read = (name) => readFileSync(new URL(name, root), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const socialDraft = JSON.parse(read('social-draft.json'));
const logo = read('logo.svg');
const digest = (value) => createHash('sha256').update(value, 'utf8').digest('hex');
const isSha = (value) => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);

test('SYNC Handshake logo is its own pinned vector asset, never a borrowed brand', () => {
  assert.equal(manifest.sourceRepository, 'jussray/sync-party-game');
  assert.equal(manifest.brand.logoSource, 'brand/handshake/logo.svg');
  assert.equal(manifest.brand.neverBorrowBrandFromOtherProjects, true);
  assert.match(logo, /^<svg\b/);
  assert.match(logo, /<title[^>]*>SYNC Party<\/title>/);
  assert.equal(digest(logo), manifest.brand.logoSha256);
  assert.equal(manifest.brand.reviewState, 'PENDING_FOUNDER_LIVE_SITE_COMPARISON');
});

test('Handshake 3:2 cover stays separate from the 4:5 social-media ad', () => {
  assert.equal(manifest.handshake.target, 'Handshake AI Showcase project card');
  assert.deepEqual(manifest.handshake.coverDimensions, [1536, 1024]);
  assert.deepEqual(socialDraft.social.mediaDimensions, [1080, 1350]);
  assert.equal(manifest.social.adCreative.aspectRatio, '4:5');
  assert.equal(socialDraft.social.mediaPurpose, 'social_ad');
  assert.equal(manifest.handshake.coverPackagePath, 'Handshake/SYNC_Party_Handshake_3x2.png');
  assert.equal(manifest.social.adCreative.packagePath, 'Social/SYNC_Party_Social_Ad_4x5.png');
  assert.equal(socialDraft.social.mediaPackagePath, manifest.social.adCreative.packagePath);
  assert.ok(isSha(manifest.handshake.coverSha256));
  assert.ok(isSha(manifest.social.adCreative.sha256));
  assert.notEqual(manifest.handshake.coverSha256, manifest.social.adCreative.sha256);
  assert.equal(manifest.social.adCreative.sha256, socialDraft.social.mediaSha256);
});

test('connected Instagram media is a draft receipt, not publication approval', () => {
  const receipt = manifest.social.providerDraft;
  const parallel = socialDraft.social.providerDraft;
  assert.equal(socialDraft.sourceRepository, manifest.sourceRepository);
  assert.equal(manifest.social.owner, 'jussray/founder-control-room');
  assert.equal(receipt.provider, 'publora');
  assert.equal(receipt.businessChannel, '@jussnco');
  assert.equal(receipt.platform, 'instagram');
  assert.equal(receipt.postGroupId, parallel.postGroupId);
  assert.equal(receipt.mediaId, parallel.mediaId);
  assert.equal(receipt.state, 'draft');
  assert.equal(receipt.mediaState, 'ready');
  assert.equal(receipt.published, false);
  assert.equal(receipt.scheduled, false);
  assert.equal(receipt.assetByteParity, 'UNVERIFIED');
  assert.equal(manifest.social.adCreative.publicUrl, socialDraft.social.mediaPublicUrl);
  assert.equal(manifest.social.adCreative.publicUrl, receipt.mediaId
    ? socialDraft.social.mediaPublicUrl : null);
  assert.equal(manifest.handshake.externalSubmissionState, 'NOT_SUBMITTED');
  assert.equal(socialDraft.handshake.submissionState, 'NOT_SUBMITTED');
  assert.equal(manifest.social.publishAllowed, false);
  assert.equal(socialDraft.publishAllowed, false);
  assert.equal(socialDraft.queueAllowed, false);
  assert.equal(socialDraft.review.exactMediaFounderApproval, false);
});
