// LIVE_SITE_SYNC_ASSET_V3
// Asset-level continuity layer. Reuses the repository-owned people-bearing party-art.png
// as large foreground graphics instead of allowing tiny avatar crops to carry identity.
// Presentation only: no room state, scoring, identity, timer, or gameplay authority changes.

const appRootV3 = document.querySelector('#app');
document.documentElement.dataset.arenaGraphics = 'v3-asset-candidate';

function installArenaPeople() {
  const home = document.querySelector('.party-home[data-arena-v2="true"]');
  if (!home || home.dataset.arenaGraphicsV3 === 'true') return;

  home.dataset.arenaGraphicsV3 = 'true';

  const people = document.createElement('div');
  people.className = 'arena-human-group-v3';
  people.setAttribute('aria-hidden', 'true');
  people.innerHTML = `
    <span class="arena-person-v3 person-0"></span>
    <span class="arena-person-v3 person-1"></span>
    <span class="arena-person-v3 person-2"></span>
    <span class="arena-person-v3 person-3"></span>
    <span class="arena-people-glow-v3"></span>
  `;

  const scene = home.querySelector('.arena-stage-v2');
  if (scene) scene.prepend(people);
  else home.prepend(people);

  const rail = home.querySelector('.arena-player-rail-v2');
  if (rail) rail.dataset.assetRole = 'derived-player-crops';

  document.body.dataset.liveAssetState = 'people-forward';
}

function decorateArenaGraphics() {
  installArenaPeople();
}

const arenaGraphicsObserver = new MutationObserver(() => requestAnimationFrame(decorateArenaGraphics));
arenaGraphicsObserver.observe(appRootV3, { childList: true });
requestAnimationFrame(decorateArenaGraphics);
