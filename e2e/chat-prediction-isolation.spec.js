import { test, expect } from "@playwright/test";

test("Chat Edition predictions stay isolated across real shared-authority rooms", async ({ browser }) => {
  test.setTimeout(45_000);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const cloudContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const chat = await context.newPage();
  const cloud = await cloudContext.newPage();

  try {
    async function startRoom(name) {
      await chat.goto("/chat/index.html");
      await chat.getByRole("button", { name: /create a room/i }).click();
      await chat.locator("#hostName").fill(name);
      await chat.getByRole("button", { name: /^create room$/i }).click();
      const code = (await chat.locator(".room-code").textContent())?.trim();
      expect(code).toMatch(/^[A-Z0-9]{5}$/);

      await cloud.goto("/");
      await cloud.getByRole("button", { name: /join a game/i }).click();
      await cloud.locator("#joinCode").fill(code);
      await cloud.locator("#joinName").fill("Guest");
      await cloud.getByRole("button", { name: /join a game/i }).click();
      await expect(chat.getByRole("button", { name: /start game/i })).toBeEnabled();
      await chat.getByRole("button", { name: /start game/i }).click();
      await expect(chat.locator(".choices")).toBeVisible();
      await expect(chat.locator(".prediction-intro")).toContainText(/first.*room will choose/i);
      return { code, key: await chat.locator(".choices").getAttribute("data-round-key") };
    }

    const first = await startRoom("First Host");
    expect(first.key).toContain(`room:${first.code}:round:1:deadline:`);
    await chat.locator(".choice").first().click();
    await expect(chat.locator(".prediction-intro")).toContainText(/prediction locked/i);

    // Submit the real first option (index 0). The server must acknowledge it
    // before we reconnect; otherwise only the optimistic client UI is tested.
    const oldChoice = await chat.locator(".choice").first().elementHandle();
    await chat.locator(".choice").first().click();
    await expect.poll(async () => oldChoice?.evaluate((node) => node.isConnected)).toBe(false);
    await chat.reload();
    // The server supplies a privacy-safe answered=true flag, not the secret
    // chosen index. Reconnected clients must stay locked without leaking it.
    await expect(chat.locator(".choice").first()).toBeDisabled();
    await expect(chat.locator("#lockCopy")).toContainText(/locked/i);
    await expect(chat.locator(".choice").first()).not.toHaveClass(/selected/);

    // Reload to another room in the same browser session: sessionStorage survives.
    const second = await startRoom("Second Host");
    expect(second.code).not.toBe(first.code);
    expect(second.key).not.toBe(first.key);
    expect(second.key).toContain(`room:${second.code}:round:1:deadline:`);
    await expect(chat.locator(".prediction-intro")).toContainText(/first.*room will choose/i);
    await expect(chat.locator(".prediction-intro")).not.toContainText(/prediction locked/i);

    const local = await chat.evaluate(() => JSON.parse(sessionStorage.getItem("sync.chat.prediction.v2") || "{}"));
    expect(Object.keys(local)).toContain(first.key);
    expect(Object.keys(local)).not.toContain(second.key);
  } finally {
    await context.close();
    await cloudContext.close();
  }
});
