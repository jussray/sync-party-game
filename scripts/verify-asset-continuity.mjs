import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'visual/project.asset-manifest.json');
const chatManifestPath = path.join(root, 'visual/chatgpt-sync.asset-manifest.json');
const fail = (message) => {
  console.error(`SYNC ASSET CONTINUITY FAIL: ${message}`);
  process.exitCode = 1;
};
const requireString = (value, label) => {
  if (typeof value !== 'string' || value.trim() === '') fail(`${label} must be a non-empty string`);
};
const requireArray = (value, label) => {
  if (!Array.isArray(value) || value.length === 0) fail(`${label} must be a non-empty array`);
};

if (!fs.existsSync(manifestPath)) {
  fail('visual/project.asset-manifest.json is missing');
} else {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.schemaVersion !== 1) fail('schemaVersion must equal 1');
  if (manifest.project !== 'jussray/sync-party-game') fail('project identity mismatch');
  if (manifest.visualFingerprintId !== 'SYNC_TRILOGY_ASSET_CONTINUITY_V1') fail('visual fingerprint mismatch');
  if (manifest.parentContract?.status !== 'candidate-not-merged') fail('parent FCR contract must remain truthfully classified until PR #906 is merged');

  const requiredSurfaces = ['live-site', 'chatgpt-sync', 'lovable-sync'];
  for (const surface of requiredSurfaces) {
    if (!manifest.surfaces?.[surface]) fail(`missing surface ${surface}`);
  }

  if (manifest.surfaces?.['live-site']?.graphicContinuityStatus !== 'REGRESSION') {
    fail('Live Site must remain REGRESSION until founder-approved arena asset fidelity is actually proven');
  }
  if (manifest.surfaces?.['chatgpt-sync']?.graphicContinuityStatus !== 'PARTIAL') {
    fail('ChatGPT SYNC must remain PARTIAL until the approved full graphic family is materialized and proven');
  }
  if (manifest.surfaces?.['lovable-sync']?.graphicContinuityStatus !== 'EXTERNAL_PROVIDER') {
    fail('Lovable visual truth must remain external-provider scoped in this repository');
  }

  requireArray(manifest.assets, 'assets');
  const byId = new Map();
  for (const asset of manifest.assets || []) {
    requireString(asset.id, 'asset.id');
    if (byId.has(asset.id)) fail(`duplicate asset id: ${asset.id}`);
    byId.set(asset.id, asset);
    if (!['canonical', 'supporting', 'derived'].includes(asset.continuityClass)) {
      fail(`${asset.id} has invalid continuityClass ${asset.continuityClass}`);
    }
    requireString(asset.role, `${asset.id}.role`);
    requireString(asset.replacementPolicy, `${asset.id}.replacementPolicy`);
    requireArray(asset.allowedTransformations, `${asset.id}.allowedTransformations`);
    requireArray(asset.prohibitedSubstitutions, `${asset.id}.prohibitedSubstitutions`);
    requireArray(asset.runtimeRefs, `${asset.id}.runtimeRefs`);
    requireArray(asset.invalidationConditions, `${asset.id}.invalidationConditions`);

    if (asset.location?.type === 'local') {
      requireString(asset.location.path, `${asset.id}.location.path`);
      const localPath = path.join(root, asset.location.path);
      if (!fs.existsSync(localPath)) fail(`${asset.id} local file missing: ${asset.location.path}`);
    }
  }

  const requiredIds = [
    'live-approved-arena-concept',
    'live-party-art-current',
    'chat-approved-ai-host-concept',
    'chat-ai-host-current'
  ];
  for (const id of requiredIds) {
    if (!byId.has(id)) fail(`required asset record missing: ${id}`);
  }

  const liveSource = byId.get('live-approved-arena-concept');
  const liveCurrent = byId.get('live-party-art-current');
  const chatSource = byId.get('chat-approved-ai-host-concept');
  const chatCurrent = byId.get('chat-ai-host-current');

  if (liveSource?.continuityClass !== 'canonical' || liveSource?.status !== 'external-reference') {
    fail('Live approved arena source must remain canonical external reference until materialized');
  }
  if (liveCurrent?.continuityClass === 'canonical') {
    fail('Current party-art.png must not self-promote to canonical while founder visual fidelity is rejected');
  }
  if (!liveCurrent?.failureClasses?.includes('GRAPHIC_CONTINUITY_REGRESSION')) {
    fail('Current Live Site implementation must carry GRAPHIC_CONTINUITY_REGRESSION evidence');
  }
  if (chatSource?.continuityClass !== 'canonical' || chatSource?.status !== 'external-reference') {
    fail('ChatGPT approved source must remain canonical external reference until materialized');
  }
  if (chatCurrent?.continuityClass === 'canonical') {
    fail('Current ai-host.svg must not self-promote to full canonical graphic proof');
  }

  const fingerprintPath = path.join(root, 'docs/SYNC_VISUAL_FINGERPRINTS.md');
  if (!fs.existsSync(fingerprintPath)) fail('docs/SYNC_VISUAL_FINGERPRINTS.md missing');
  else {
    const fingerprints = fs.readFileSync(fingerprintPath, 'utf8');
    for (const phrase of ['CHATGPT_SYNC_VISUAL_V1', 'LIVE_SITE_SYNC_VISUAL_V1', 'LOVABLE_SYNC_VISUAL_V1']) {
      if (!fingerprints.includes(phrase)) fail(`fingerprint contract missing ${phrase}`);
    }
  }

  if (!fs.existsSync(chatManifestPath)) {
    fail('visual/chatgpt-sync.asset-manifest.json is missing');
  } else {
    const chatManifest = JSON.parse(fs.readFileSync(chatManifestPath, 'utf8'));
    if (chatManifest.schemaVersion !== 1) fail('ChatGPT asset manifest schemaVersion must equal 1');
    if (chatManifest.surface !== 'chatgpt-sync') fail('ChatGPT asset manifest surface mismatch');
    if (chatManifest.visualFingerprint !== 'CHATGPT_SYNC_VISUAL_V1') fail('ChatGPT visual fingerprint mismatch');
    if (chatManifest.assetContinuity !== 'CHATGPT_SYNC_ASSET_V2') fail('ChatGPT asset continuity id mismatch');
    if (chatManifest.status !== 'PARTIAL_REBUILD_CANDIDATE') fail('ChatGPT rebuild must remain truthfully partial until direct canonical source comparison');
    requireArray(chatManifest.runtimeAssets, 'ChatGPT runtimeAssets');
    const scene = chatManifest.runtimeAssets.find((asset) => asset.id === 'chat-social-scene-v2');
    if (!scene) fail('ChatGPT social scene asset record missing');
    else {
      requireString(scene.path, 'chat-social-scene-v2.path');
      if (!fs.existsSync(path.join(root, scene.path))) fail(`ChatGPT social scene local file missing: ${scene.path}`);
      requireArray(scene.requiredSubjects, 'chat-social-scene-v2.requiredSubjects');
      requireArray(scene.requiredComposition, 'chat-social-scene-v2.requiredComposition');
      requireArray(scene.prohibitedSubstitutions, 'chat-social-scene-v2.prohibitedSubstitutions');
      requireArray(scene.runtimeRefs, 'chat-social-scene-v2.runtimeRefs');
    }
  }

  if (process.argv.includes('--release')) {
    const blocked = Object.entries(manifest.surfaces || {})
      .filter(([, value]) => ['REGRESSION', 'PARTIAL', 'BLOCKED', 'UNKNOWN'].includes(value.graphicContinuityStatus));
    if (blocked.length) {
      fail(`release asset-continuity gate blocked by: ${blocked.map(([key, value]) => `${key}=${value.graphicContinuityStatus}`).join(', ')}`);
    }
  }
}

if (process.exitCode) process.exit(process.exitCode);
console.log('SYNC ASSET CONTINUITY PASS: manifest truth is structurally valid; known visual regressions remain explicitly classified');
