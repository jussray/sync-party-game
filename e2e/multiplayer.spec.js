import { test, expect } from "@playwright/test";

test("two independent browsers share authoritative state, theme, and reconnect", async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  await host.goto("/");
  await host.getByRole("button", { name: /Toggle light or dark theme/ }).click();
  await expect(host.locator("html")).toHaveAttribute("data-theme", "light");
  await host.getByLabel("Your nickname").fill("Ray");
  await host.getByRole("button", { name: /Create a game/ }).click();
  const code = (await host.locator(".room-code").textContent()).trim();

  await guest.goto("/");
  await guest.getByLabel("Room code").fill(code);
  await guest.getByLabel("Nickname").fill("Night");
  await guest.getByRole("button", { name: /Join a game/ }).click();
  await expect(host.getByText("Night")).toBeVisible();
  await expect(host.getByText(/2 connected/)).toBeVisible();

  await host.getByRole("button", { name: /Start game/ }).click();
  await expect(guest.getByText(/Round 1 of/)).toBeVisible();
  await expect(host.getByText(/Classic Sync/)).toBeVisible();

  await host.locator(".choice").first().click();
  await guest.locator(".choice").first().click();
  await expect(host.getByText(/ROOM SYNC/)).toBeVisible();
  await expect(host.getByText("100%")).toBeVisible();
  await expect(guest.getByText("100%")).toBeVisible();

  await guest.reload();
  await expect(guest.getByText(/ROOM SYNC/)).toBeVisible();
  await expect(guest.getByText("Night")).toBeVisible();

  await hostContext.close();
  await guestContext.close();
});
