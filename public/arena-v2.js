// LIVE_SITE_SYNC_VISUAL_V1 structural rebuild candidate.
// Presentation-only. Never mutates room state, scoring, identity, or gameplay authority.

const appRoot = document.querySelector('#app');
document.documentElement.dataset.arenaRebuild = 'v2-candidate';

function upgradeHome() {
  const home = document.querySelector('.party-home');
  if (!home || home.dataset.arenaV2 === 'true') return;

  home.dataset.arenaV2 = 'true';

  const stage = document.createElement('div');
  stage.className = 'arena-stage-v2';
  stage.setAttribute('aria-hidden', 'true');
  stage.innerHTML = `
    <div class="arena-beams-v2"><i></i><i></i><i></i><i></i></div>
    <div class="arena-demo-board-v2">
      <div class="arena-demo-top-v2"><span>DEMO</span><b>ROUND 03 / 05</b></div>
      <div class="arena-demo-mode-v2">ODD ONE OUT</div>
      <p class="arena-demo-prompt-v2">Which late-night pick survives the room?</p>
      <div class="arena-demo-choices-v2"><span>🍕 PIZZA</span><span>🍔 BURGER</span></div>
      <div class="arena-demo-sync-v2"><span>ROOM SYNC</span><strong>87%</strong></div>
    </div>
    <div class="arena-clock-v2"><span>03</span><small>LOCK</small></div>
    <div class="arena-player-rail-v2">
      <span class="face face-0"></span>
      <span class="face face-1"></span>
      <span class="face face-2"></span>
      <span class="face face-3"></span>
    </div>
    <div class="arena-handnote-v2">READ THE ROOM<br>THEN THE RULE FLIPS</div>
    <div class="arena-crowd-v2"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
  `;
  home.prepend(stage);

  const eyebrow = home.querySelector('.eyebrow');
  if (eyebrow) eyebrow.textContent = 'SYNC ✦ LIVE PRESSURE PARTY';

  const headline = home.querySelector('.hero-content h1');
  if (headline) headline.innerHTML = 'CAN YOU READ THE ROOM<br><span>BEFORE TIME RUNS OUT?</span>';

  const description = home.querySelector('.hero-description');
  if (description) description.textContent = 'Private picks. Changing win conditions. One synchronized reveal. Read the room, then survive the twist.';

  const preview = home.querySelector('.preview-note');
  if (preview) preview.textContent = 'Real-time multiplayer · No account · No install · No public answers before reveal';

  const badges = home.querySelectorAll('.hero-badges span');
  const badgeCopy = ['2–8 players', 'Private picks', '5 pressure modes'];
  badges.forEach((badge, index) => {
    if (badgeCopy[index]) badge.textContent = badgeCopy[index];
  });
}

function decorate() {
  upgradeHome();
}

const observer = new MutationObserver(() => queueMicrotask(decorate));
observer.observe(appRoot, { childList: true, subtree: true });
decorate();
