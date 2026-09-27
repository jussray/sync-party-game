import { test, expect } from "@playwright/test";

test("live landing renders the founder-approved pre-neon Sync canon", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".hero-card")).toBeVisible();
  await expect(page.getByRole("button", { name: /Create a game/ })).toBeVisible();

  const witness = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const bodyBefore = getComputedStyle(document.body, "::before");
    const bodyAfter = getComputedStyle(document.body, "::after");
    const brandAfter = getComputedStyle(document.querySelector(".brand"), "::after");
    const hero = getComputedStyle(document.querySelector(".hero-card"));
    const logo = getComputedStyle(document.querySelector(".logo"));

    return {
      bg: root.getPropertyValue("--bg").trim().toLowerCase(),
      accent: root.getPropertyValue("--accent").trim().toLowerCase(),
      accent2: root.getPropertyValue("--accent-2").trim().toLowerCase(),
      bodyBeforeContent: bodyBefore.content,
      bodyAfterContent: bodyAfter.content,
      brandAfterContent: brandAfter.content,
      heroMaxWidth: hero.maxWidth,
      logoColor: logo.color,
      logoBackgroundImage: logo.backgroundImage
    };
  });

  expect(witness).toMatchObject({
    bg: "#071226",
    accent: "#ff3f9f",
    accent2: "#9c4dff",
    bodyBeforeContent: "none",
    bodyAfterContent: "none",
    brandAfterContent: "none",
    heroMaxWidth: "760px",
    logoBackgroundImage: "none"
  });
  expect(witness.logoColor).not.toBe("rgba(0, 0, 0, 0)");

  await page.screenshot({
    path: "test-results/visual-sync-home.png",
    fullPage: true
  });
});
