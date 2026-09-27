import { test, expect } from "@playwright/test";

test("Chat Edition and Cloudflare Edition play inside one authoritative room", async ({ browser }) => {
  const chatContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const cloudContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const chat = await chatContext.newPage();
  const cloud = await cloudContext.newPage();

  await chat.goto("/chat/index.html");
  await expect(chat.locator('[data-surface="chat"]')).toBeVisible();
  await expect(chat.getByText("Same game.")).toBeVisible();
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
  await expect(cloud.getByText("Chat Host")).toBeVisible();

  await expect(chat.getByRole("button", { name: /start game/i })).toBeEnabled();
  await chat.getByRole("button", { name: /start game/i }).click();

  await expect(chat.locator(".choice").first()).toBeVisible();
  await expect(cloud.locator(".choice").first()).toBeVisible();

  await chat.locator(".choice").first().click();
  await expect(cloud.locator(".choice").first()).toBeEnabled();
  await cloud.locator(".choice").first().click();

  await expect(chat.locator(".sync-score")).toBeVisible();
  await expect(cloud.locator(".sync-readout")).toBeVisible();

  const chatFingerprint = await chat.evaluate(() => ({
    surface: document.documentElement.dataset.surface,
    chatFrame: Boolean(document.querySelector(".chat-frame")),
    partyHome: Boolean(document.querySelector(".party-home"))
  }));
  const cloudFingerprint = await cloud.evaluate(() => ({
    surface: document.documentElement.dataset.surface || "cloudflare",
    chatFrame: Boolean(document.querySelector(".chat-frame")),
    partyHome: Boolean(document.querySelector(".party-home"))
  }));

  expect(chatFingerprint).toEqual({ surface: "chat", chatFrame: true, partyHome: false });
  expect(cloudFingerprint.chatFrame).toBe(false);

  await chatContext.close();
  await cloudContext.close();
});
