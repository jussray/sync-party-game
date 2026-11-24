import { test, expect } from "@playwright/test";

// CHATGPT_SYNC_VISUAL_V1: the founder-approved composition (visual/source/chatgpt-sync-approved.png).
async function chatWitness(page) {
  return page.evaluate(() => ({
    surface: document.documentElement.dataset.surface,
    visualCookie: document.documentElement.dataset.visualCookie,
    art: getComputedStyle(document.querySelector(".cf-art")).backgroundImage,
    answers: document.querySelectorAll(".cf-answers .cf-answer").length,
    pickedAnswers: document.querySelectorAll(".cf-answer.picked").length,
    people: document.querySelectorAll(".cf-people .cf-person").length,
    bars: document.querySelectorAll(".cf-prediction li").length,
    legacyScene: Boolean(document.querySelector(".chat-social-scene-v2, .ai-host-card")),
    noHorizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth <= 1
  }));
}

test("ChatGPT SYNC home matches the founder-approved composition", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/chat/");
  await expect(page.locator('.chat-frame[data-surface="chat"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: /chatgpt sync/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /predict the prompt/i })).toBeVisible();
  await expect(page.getByRole("img", { name: /ai host robot above four friends/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /your prediction/i })).toBeVisible();
  await expect(page.getByRole("img", { name: /same people\. different minds/i })).toBeVisible();
  const witness = await chatWitness(page);
  expect(witness).toMatchObject({ surface: "chat", visualCookie: "CHATGPT_SYNC_VISUAL_V1", answers: 5, pickedAnswers: 1, people: 6, bars: 5, legacyScene: false, noHorizontalOverflow: true });
  expect(witness.art).toContain("/chat/founder-hero.webp");
  await page.screenshot({ path: "test-results/visual-chatgpt-sync-home.png", fullPage: true });
});

test("founder ChatGPT SYNC composition survives mobile reduced motion", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/chat/");
  await expect(page.locator(".cf-art")).toBeVisible();
  await expect(page.getByRole("button", { name: /create a room/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /join with a code/i })).toBeVisible();
  const witness = await chatWitness(page);
  expect(witness).toMatchObject({ answers: 5, people: 6, bars: 5, legacyScene: false, noHorizontalOverflow: true });
  await page.screenshot({ path: "test-results/visual-chatgpt-sync-home-mobile.png", fullPage: true });
  await context.close();
});
