import { test, expect } from "@playwright/test";

test("live landing renders the chat-site Sync canon", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("sync.theme", "dark"));
  await page.goto("/");
  await expect(page.locator(".party-home")).toBeVisible();
  await expect(page.locator(".game-logo")).toHaveText(/SYNC/);
  await expect(page.getByRole("button", { name: /create a game/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /join a game/i })).toBeVisible();

  const witness = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const partyHome = document.querySelector(".party-home");
    const partyArt = document.querySelector(".party-art");
    const quickHow = document.querySelector(".quick-how");
    const modeTiles = document.querySelector(".mode-tiles");
    const logo = document.querySelector(".game-logo");

    return {
      theme: document.documentElement.dataset.theme,
      bg: root.getPropertyValue("--bg").trim().toLowerCase(),
      pink: root.getPropertyValue("--pink").trim().toLowerCase(),
      cyan: root.getPropertyValue("--cyan").trim().toLowerCase(),
      partyHomeDisplay: getComputedStyle(partyHome).display,
      partyHomeRadius: getComputedStyle(partyHome).borderRadius,
      partyArtBackground: getComputedStyle(partyArt).backgroundImage,
      quickHowDisplay: getComputedStyle(quickHow).display,
      modeTilesDisplay: getComputedStyle(modeTiles).display,
      logoFontStyle: getComputedStyle(logo).fontStyle
    };
  });

  expect(witness).toMatchObject({
    theme: "dark",
    bg: "#060d20",
    pink: "#ff389a",
    cyan: "#64ddff",
    partyHomeDisplay: "grid",
    quickHowDisplay: "grid",
    modeTilesDisplay: "grid",
    logoFontStyle: "italic"
  });
  expect(witness.partyHomeRadius).toContain("26px");
  expect(witness.partyArtBackground).toContain("party-art.png");

  await page.screenshot({
    path: "test-results/visual-sync-home.png",
    fullPage: true
  });
});
