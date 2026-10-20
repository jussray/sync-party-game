// LIVE_SITE_SYNC_VISUAL_V1
// Presentation-only phase effects. Never mutates room state or scoring.

document.documentElement.dataset.visualCookie = "LIVE_SITE_SYNC_VISUAL_V1";
const appRoot = document.querySelector("#app");
let lastRevealKey = "";

function addHomeMarquee() {
  const home = document.querySelector(".party-home");
  if (!home || home.querySelector(".arena-marquee")) return;
  const marquee = document.createElement("div");
  marquee.className = "arena-marquee";
  marquee.setAttribute("aria-hidden", "true");
  marquee.textContent = "SAME PEOPLE · DIFFERENT MINDS · BIGGER REVEAL";
  home.append(marquee);
}

function burstReveal() {
  const reveal = document.querySelector(".reveal-count, .sync-readout, .answer-results");
  if (!reveal) return;
  const text = document.querySelector(".sync-readout")?.textContent || document.querySelector(".reveal-count")?.textContent || "reveal";
  const key = `${text}:${document.querySelector(".meta")?.textContent || ""}`;
  if (key === lastRevealKey) return;
  lastRevealKey = key;

  const burst = document.createElement("div");
  burst.className = "reveal-burst";
  burst.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 26; i += 1) {
    const particle = document.createElement("i");
    const angle = (Math.PI * 2 * i) / 26;
    const distance = 150 + (i % 5) * 26;
    particle.style.setProperty("--x", `${Math.cos(angle) * distance}px`);
    particle.style.setProperty("--y", `${Math.sin(angle) * distance}px`);
    particle.style.animationDelay = `${(i % 6) * 20}ms`;
    burst.append(particle);
  }
  document.body.append(burst);
  setTimeout(() => burst.remove(), 1200);
}

function markPhase() {
  const card = document.querySelector(".game-card");
  if (!card) {
    document.body.dataset.arenaPhase = document.querySelector(".party-home") ? "home" : "idle";
    return;
  }
  let phase = "game";
  if (card.classList.contains("pressure")) phase = "pressure";
  if (card.querySelector(".locked-stage")) phase = "lock";
  if (card.querySelector(".reveal-count, .sync-readout, .answer-results")) phase = "reveal";
  if (card.querySelector(".rankings")) phase = "results";
  document.body.dataset.arenaPhase = phase;
  if (phase === "reveal") burstReveal();
}

function decorate() {
  addHomeMarquee();
  markPhase();
}

const observer = new MutationObserver(() => queueMicrotask(decorate));
observer.observe(appRoot, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
decorate();
