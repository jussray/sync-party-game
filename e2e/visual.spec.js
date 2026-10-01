import { test, expect } from "@playwright/test";

test("live landing renders the arena Sync canon", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("sync.theme", "dark"));
  await page.goto("/");
  await expect(page.locator(".party-home")).toBeVisible();
  await expect(page.locator(".game-logo")).toHaveText(/SYNC/);
  await expect(page.locator(".arena-stage-v2")).toBeVisible();
  await expect(page.locator(".arena-demo-board-v2")).toBeVisible();
  await expect(page.locator(".arena-player-rail-v2 .face")).toHaveCount(4);
  await expect(page.getByRole("heading", { name: /can you read the room/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /create a game/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /join a game/i })).toBeVisible();

  const witness = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const partyHome = document.querySelector(".party-home");
    const partyArt = document.querySelector(".party-art");
    const quickHow = document.querySelector(".quick-how");
    const modeTiles = document.querySelector(".mode-tiles");
    const logo = document.querySelector(".game-logo");
    const board = document.querySelector(".arena-demo-board-v2");

    return {
      theme: document.documentElement.dataset.theme,
      visualCookie: document.documentElement.dataset.visualCookie,
      rebuild: document.documentElement.dataset.arenaRebuild,
      arenaV2: partyHome.dataset.arenaV2,
      bg: root.getPropertyValue("--bg").trim().toLowerCase(),
      pink: root.getPropertyValue("--pink").trim().toLowerCase(),
      cyan: root.getPropertyValue("--cyan").trim().toLowerCase(),
      partyHomeDisplay: getComputedStyle(partyHome).display,
      partyHomeRadius: getComputedStyle(partyHome).borderRadius,
      partyArtBackground: getComputedStyle(partyArt).backgroundImage,
      quickHowDisplay: getComputedStyle(quickHow).display,
      modeTilesDisplay: getComputedStyle(modeTiles).display,
      logoFontStyle: getComputedStyle(logo).fontStyle,
      boardPosition: getComputedStyle(board).position,
      bodyOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth
    };
  });

  expect(witness).toMatchObject({
    theme: "dark",
    visualCookie: "LIVE_SITE_SYNC_VISUAL_V1",
    rebuild: "v2-candidate",
    arenaV2: "true",
    bg: "#060d20",
    pink: "#ff389a",
    cyan: "#64ddff",
    partyHomeDisplay: "grid",
    quickHowDisplay: "grid",
    modeTilesDisplay: "grid",
    logoFontStyle: "italic",
    boardPosition: "absolute",
    bodyOverflow: true
  });
  expect(witness.partyHomeRadius).toContain("26px");
  expect(witness.partyArtBackground).toContain("party-art.png");

  await page.screenshot({
    path: "test-results/visual-sync-home.png",
    fullPage: true
  });
});

test("arena rebuild preserves identity in reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".party-home")).toBeVisible();
  await expect(page.locator(".arena-demo-board-v2")).toBeVisible();
  await expect(page.locator(".arena-clock-v2")).toBeVisible();
  await expect(page.locator(".arena-player-rail-v2 .face")).toHaveCount(4);
  await expect(page.getByRole("button", { name: /create a game/i })).toBeVisible();
});
