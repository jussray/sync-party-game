import { test, expect } from "@playwright/test";

test("ChatGPT SYNC home preserves AI-host plus human-room asset identity", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 920 });
  await page.goto("/chat/");

  await expect(page.locator('.chat-frame[data-surface="chat"]')).toBeVisible();
  await expect(page.locator(".chat-social-scene-v2")).toBeVisible();
  await expect(page.locator('.chat-social-scene-v2 img[src*="chat-social-scene-v2.svg"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: /predict the prompt/i })).toBeVisible();
  await expect(page.getByText(/can you predict your people/i)).toBeVisible();

  const witness = await page.evaluate(() => ({
    surface: document.documentElement.dataset.surface,
    visualCookie: document.documentElement.dataset.visualCookie,
    assetContinuity: document.documentElement.dataset.assetContinuity,
    visualState: document.body.dataset.chatVisualState,
    scene: Boolean(document.querySelector('.chat-social-scene-v2 img[src*="chat-social-scene-v2.svg"]')),
    oldHostVisible: (() => {
      const el = document.querySelector(".ai-host-card");
      return el ? getComputedStyle(el).display !== "none" : false;
    })()
  }));

  expect(witness).toEqual({
    surface: "chat",
    visualCookie: "CHATGPT_SYNC_VISUAL_V1",
    assetContinuity: "CHATGPT_SYNC_ASSET_V2",
    visualState: "home-social-scene",
    scene: true,
    oldHostVisible: false
  });

  await page.screenshot({ path: "test-results/visual-chatgpt-sync-home.png", fullPage: true });
});

test("ChatGPT SYNC asset identity survives mobile reduced motion", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce"
  });
  const page = await context.newPage();
  await page.goto("/chat/");

  await expect(page.locator(".chat-social-scene-v2")).toBeVisible();
  await expect(page.locator('.chat-social-scene-v2 img[src*="chat-social-scene-v2.svg"]')).toBeVisible();
  await expect(page.getByRole("button", { name: /create a room/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /join a room/i })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  await page.screenshot({ path: "test-results/visual-chatgpt-sync-home-mobile.png", fullPage: true });
  await context.close();
});
