import { test, expect } from "@playwright/test";

test("Chat Edition prediction lens and Cloudflare Edition share one authoritative room", async ({ browser }) => {
  const chatContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const cloudContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const chat = await chatContext.newPage();
  const cloud = await cloudContext.newPage();

  await chat.goto("/chat/index.html");
  await expect(chat.locator('.chat-frame[data-surface="chat"]')).toBeVisible();
  await expect(chat.getByRole("heading", { name: /predict the prompt/i })).toBeVisible();
  await expect(chat.getByText(/shared durable object still owns room state/i)).toBeVisible();
  await chat.getByRole("button", { name: /create a room/i }).click();
  await chat.locator("#hostName").fill("Chat Host");
  await chat.getByRole("button", { name: /^create room$/i }).click();

  const code = (await chat.locator(".room-code").textContent())?.trim();
  expect(code).toMatch(/^[A-Z0-9]{5}$/);

  await cloud.goto("/");
  await expect(cloud.locator(".party-home")).toBeVisible();
  await cloud.getByRole("button", { name: /join a game/i }).click();
  await cloud.locator("#joinCode").fill(code);
  await cloud.locator("#joinName").fill("Cloud Guest");
  await cloud.getByRole("button", { name: /join a game/i }).click();

  await expect(chat.locator(".player-chip")).toHaveCount(2);
  await expect(chat.getByText("Cloud Guest")).toBeVisible();
  await expect(cloud.getByText("Chat Host", { exact: true })).toBeVisible();

  await expect(chat.getByRole("button", { name: /start game/i })).toBeEnabled();
  await chat.getByRole("button", { name: /start game/i }).click();

  await expect(chat.locator(".choice").first()).toBeVisible();
  await expect(cloud.locator(".choice").first()).toBeVisible();
  await expect(chat.locator(".prediction-intro")).toContainText(/first.*room will choose/i);

  // First Chat Edition click is deliberately local-only prediction evidence.
  await chat.locator(".choice").first().click();
  await expect(chat.locator(".prediction-intro")).toContainText(/prediction locked/i);
  await expect(cloud.locator(".choice").first()).toBeEnabled();

  // Second Chat Edition click is the real authoritative SYNC answer.
  await chat.locator(".choice").first().click();
  await cloud.locator(".choice").first().click();

  await expect(chat.locator(".sync-score")).toBeVisible();
  await expect(cloud.locator(".sync-readout")).toBeVisible();
  await expect(chat.locator(".prediction-result")).toBeVisible();

  const chatFingerprint = await chat.evaluate(() => ({
    surface: document.documentElement.dataset.surface,
    visualCookie: document.documentElement.dataset.visualCookie,
    chatFrame: Boolean(document.querySelector(".chat-frame")),
    partyHome: Boolean(document.querySelector(".party-home"))
  }));
  const cloudFingerprint = await cloud.evaluate(() => ({
    surface: document.documentElement.dataset.surface || "cloudflare",
    visualCookie: document.documentElement.dataset.visualCookie,
    chatFrame: Boolean(document.querySelector(".chat-frame")),
    gameCard: Boolean(document.querySelector(".game-card"))
  }));

  expect(chatFingerprint).toEqual({
    surface: "chat",
    visualCookie: "CHATGPT_SYNC_VISUAL_V1",
    chatFrame: true,
    partyHome: false
  });
  expect(cloudFingerprint).toMatchObject({
    visualCookie: "LIVE_SITE_SYNC_VISUAL_V1",
    chatFrame: false,
    gameCard: true
  });

  await chatContext.close();
  await cloudContext.close();
});
