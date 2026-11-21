import { test, expect } from "@playwright/test";

// LIVE_SITE_SYNC_VISUAL_V1: the founder-approved composition (visual/source/live-site-sync-approved.png).
async function liveWitness(page) {
  return page.evaluate(() => {
    const bg = (selector) => { const el = document.querySelector(selector); return el ? getComputedStyle(el).backgroundImage : ""; };
    return {
      visualCookie: document.documentElement.dataset.visualCookie,
      founderHome: Boolean(document.querySelector(".party-home.founder-home")),
      heroArt: bg(".founder-home .game-logo"),
      crowdArt: bg(".fl-crowd"),
      players: document.querySelectorAll(".fl-players .fl-player").length,
      faces: [...document.querySelectorAll(".fl-face")].every((face) => getComputedStyle(face).backgroundImage.includes("/founder/live-face-")),
      modes: document.querySelectorAll(".fl-modes .fl-mode").length,
      features: document.querySelectorAll(".fl-features > div").length,
      legacyDecorators: Boolean(document.querySelector(".arena-stage-v2, .arena-human-group-v3, .arena-marquee")),
      worldsAfterGame: (() => { const app = document.querySelector("#app"); const worlds = document.querySelector("#sync-worlds"); return Boolean(app && worlds && (app.compareDocumentPosition(worlds) & Node.DOCUMENT_POSITION_FOLLOWING)); })(),
      noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth
    };
  });
}

test("live landing matches the founder-approved Live Site SYNC composition", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator(".party-home.founder-home")).toBeVisible();
  await expect(page.getByRole("img", { name: /live site sync/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /can you read the room/i })).toBeAttached();
  await expect(page.getByRole("button", { name: /create a game/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /join a game/i })).toBeVisible();
  await expect(page.locator(".fl-clock")).toContainText("07");
  await expect(page.locator(".fl-steps li")).toHaveText(["Pick", "Lock", "Reveal"]);
  await expect(page.locator(".fl-roomsync")).toContainText("87%");
  await expect(page.locator(".fl-modes h3")).toHaveText(["Classic Sync", "Twin", "Odd One Out", "Reverse", "Perfect Sync"]);

  const witness = await liveWitness(page);
  expect(witness).toMatchObject({ visualCookie: "LIVE_SITE_SYNC_VISUAL_V1", founderHome: true, players: 8, faces: true, modes: 5, features: 4, legacyDecorators: false, worldsAfterGame: true, noHorizontalOverflow: true });
  expect(witness.heroArt).toContain("/founder/live-hero.webp");
  expect(witness.crowdArt).toContain("/founder/live-crowd.webp");
  await page.screenshot({ path: "test-results/visual-sync-home.png", fullPage: true });
});

test("founder Live composition survives mobile and reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".party-home.founder-home")).toBeVisible();
  await expect(page.locator(".fl-people-strip")).toBeVisible();
  await expect(page.getByRole("button", { name: /create a game/i })).toBeVisible();
  const witness = await liveWitness(page);
  expect(witness).toMatchObject({ founderHome: true, players: 8, modes: 5, legacyDecorators: false, noHorizontalOverflow: true });
  expect(witness.heroArt).toContain("/founder/live-title.webp");
  await page.screenshot({ path: "test-results/visual-sync-home-mobile.png", fullPage: true });
});
