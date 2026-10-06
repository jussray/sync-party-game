import { test, expect } from "@playwright/test";

test("live landing preserves people-forward arena asset identity", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("sync.theme", "dark"));
  await page.goto("/");
  await expect(page.locator(".party-home")).toBeVisible();
  await expect(page.locator(".game-logo")).toHaveText(/SYNC/);
  await expect(page.locator(".arena-stage-v2")).toBeVisible();
  await expect(page.locator(".arena-demo-board-v2")).toBeVisible();
  await expect(page.locator(".arena-human-group-v3")).toBeVisible();
  await expect(page.locator(".arena-human-group-v3 .arena-person-v3")).toHaveCount(4);
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
    const people = [...document.querySelectorAll(".arena-person-v3")];
    const peopleBox = document.querySelector(".arena-human-group-v3")?.getBoundingClientRect();
    const partyBox = partyHome?.getBoundingClientRect();

    return {
      theme: document.documentElement.dataset.theme,
      visualCookie: document.documentElement.dataset.visualCookie,
      rebuild: document.documentElement.dataset.arenaRebuild,
      graphics: document.documentElement.dataset.arenaGraphics,
      assetState: document.body.dataset.liveAssetState,
      arenaV2: partyHome.dataset.arenaV2,
      arenaV3: partyHome.dataset.arenaGraphicsV3,
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
      largePeopleUseCanonicalFamily: people.every((person) => getComputedStyle(person).backgroundImage.includes("party-art.png")),
      largePeopleCount: people.length,
      peopleWidthShare: peopleBox && partyBox ? peopleBox.width / partyBox.width : 0,
      peopleHeight: peopleBox?.height || 0,
      noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth
    };
  });

  expect(witness).toMatchObject({
    theme: "dark",
    visualCookie: "LIVE_SITE_SYNC_VISUAL_V1",
    rebuild: "v2-candidate",
    graphics: "v3-asset-candidate",
    assetState: "people-forward",
    arenaV2: "true",
    arenaV3: "true",
    bg: "#060d20",
    pink: "#ff389a",
    cyan: "#64ddff",
    partyHomeDisplay: "grid",
    quickHowDisplay: "grid",
    modeTilesDisplay: "grid",
    logoFontStyle: "italic",
    boardPosition: "absolute",
    largePeopleUseCanonicalFamily: true,
    largePeopleCount: 4,
    noHorizontalOverflow: true
  });
  expect(witness.partyHomeRadius).toContain("26px");
  expect(witness.partyArtBackground).toContain("party-art.png");
  expect(witness.peopleWidthShare).toBeGreaterThan(0.42);
  expect(witness.peopleHeight).toBeGreaterThan(280);

  await page.screenshot({
    path: "test-results/visual-sync-home.png",
    fullPage: true
  });
});

test("people-forward arena identity survives mobile and reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".party-home")).toBeVisible();
  await expect(page.locator(".arena-human-group-v3")).toBeVisible();
  await expect(page.locator(".arena-human-group-v3 .arena-person-v3")).toHaveCount(4);
  await expect(page.locator(".arena-demo-board-v2")).toBeVisible();
  await expect(page.locator(".arena-clock-v2")).toBeVisible();
  await expect(page.locator(".arena-player-rail-v2 .face")).toHaveCount(4);
  await expect(page.getByRole("button", { name: /create a game/i })).toBeVisible();

  const witness = await page.evaluate(() => {
    const people = [...document.querySelectorAll(".arena-person-v3")];
    const group = document.querySelector(".arena-human-group-v3")?.getBoundingClientRect();
    return {
      noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      peopleCount: people.length,
      peopleUseCanonicalFamily: people.every((person) => getComputedStyle(person).backgroundImage.includes("party-art.png")),
      groupHeight: group?.height || 0,
      assetState: document.body.dataset.liveAssetState
    };
  });

  expect(witness).toMatchObject({
    noHorizontalOverflow: true,
    peopleCount: 4,
    peopleUseCanonicalFamily: true,
    assetState: "people-forward"
  });
  expect(witness.groupHeight).toBeGreaterThan(190);

  await page.screenshot({
    path: "test-results/visual-sync-home-mobile.png",
    fullPage: true
  });
});
