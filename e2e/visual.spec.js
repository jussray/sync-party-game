import { test, expect } from "@playwright/test";

test("live landing renders the founder-approved Sync showcase canon", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("sync.theme", "dark"));
  await page.goto("/");
  await expect(page.locator(".hero-card")).toBeVisible();
  await expect(page.getByRole("button", { name: /Create a game/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Join a game/ })).toBeVisible();

  const witness = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const brandAfter = getComputedStyle(document.querySelector(".brand"), "::after");
    const heroElement = document.querySelector(".hero-card");
    const hero = getComputedStyle(heroElement);
    const heroBefore = getComputedStyle(heroElement, "::before");
    const heroRect = heroElement.getBoundingClientRect();
    const logo = getComputedStyle(document.querySelector(".logo"));
    const createButton = getComputedStyle(document.querySelector("#createForm .btn"));
    const createCard = getComputedStyle(document.querySelector("#createForm"));

    return {
      theme: document.documentElement.dataset.theme,
      bg: root.getPropertyValue("--bg").trim().toLowerCase(),
      accent: root.getPropertyValue("--accent").trim().toLowerCase(),
      accent2: root.getPropertyValue("--accent-2").trim().toLowerCase(),
      cyan: root.getPropertyValue("--cyan").trim().toLowerCase(),
      brandAfterContent: brandAfter.content,
      heroWidth: Math.round(heroRect.width),
      heroBorderRadius: hero.borderRadius,
      heroArtwork: heroBefore.backgroundImage,
      logoColor: logo.color,
      createButtonBackground: createButton.backgroundImage,
      createCardBorderRadius: createCard.borderRadius
    };
  });

  expect(witness).toMatchObject({
    theme: "dark",
    bg: "#050b20",
    accent: "#ff36aa",
    accent2: "#8f4dff",
    cyan: "#29d9ff",
    brandAfterContent: "none",
    heroBorderRadius: "34px",
    logoColor: "rgb(255, 255, 255)",
    createCardBorderRadius: "22px"
  });
  expect(witness.heroWidth).toBeLessThanOrEqual(1120);
  expect(witness.heroWidth).toBeGreaterThan(900);
  expect(witness.heroArtwork).toContain("/assets/sync-friends.svg");
  expect(witness.createButtonBackground).toContain("linear-gradient");

  await page.screenshot({
    path: "test-results/visual-sync-home.png",
    fullPage: true
  });
});
