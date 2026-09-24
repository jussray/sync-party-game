import { test, expect } from "@playwright/test";

test("two independent browsers share authoritative state, theme, and reconnect", async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  await host.goto("/");
  const initialTheme = await host.locator("html").getAttribute("data-theme");
  expect(["light", "dark"]).toContain(initialTheme);
  const toggledTheme = initialTheme === "dark" ? "light" : "dark";
  await host.getByRole("button", { name: /Toggle light or dark theme/ }).click();
  await expect(host.locator("html")).toHaveAttribute("data-theme", toggledTheme);
  await host.reload();
  await expect(host.locator("html")).toHaveAttribute("data-theme", toggledTheme);

  await host.getByLabel("Your nickname", { exact: true }).fill("Ray");
  await host.getByRole("button", { name: /Create a game/ }).click();
  const code = (await host.locator(".room-code").textContent()).trim();

  await guest.goto("/");
  await guest.getByLabel("Room code", { exact: true }).fill(code);
  await guest.getByLabel("Nickname", { exact: true }).fill("Night");
  await guest.getByRole("button", { name: /Join a game/ }).click();
  await expect(host.getByText("Night", { exact: true })).toBeVisible();
  await expect(host.getByText(/2 connected/)).toBeVisible();

  await host.getByRole("button", { name: /Start game/ }).click();
  await expect(guest.getByText(/Round 1 of/)).toBeVisible();
  await expect(host.getByText(/Classic Sync/)).toBeVisible();

  await host.locator(".choice").first().click();
  await guest.locator(".choice").first().click();
  await expect(host.getByText(/ROOM SYNC/)).toBeVisible();
  await expect(host.getByText("100%", { exact: true })).toBeVisible();
  await expect(guest.getByText("100%", { exact: true })).toBeVisible();

  const guestIdentityBeforeReload = await guest.evaluate((roomCode) => localStorage.getItem(`sync.room.${roomCode}`), code);
  expect(guestIdentityBeforeReload).toBeTruthy();

  await guest.reload();
  await expect(guest).toHaveURL(new RegExp(`room=${code}`));
  await expect(guest.getByText(/ROOM SYNC/)).toBeVisible();
  await expect(guest.getByText("100%", { exact: true })).toBeVisible();
  const guestIdentityAfterReload = await guest.evaluate((roomCode) => localStorage.getItem(`sync.room.${roomCode}`), code);
  expect(guestIdentityAfterReload).toBe(guestIdentityBeforeReload);

  await hostContext.close();
  await guestContext.close();
});
