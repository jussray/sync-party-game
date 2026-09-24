import { test, expect } from "@playwright/test";

async function expectFitsViewport(page) {
  const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(fits).toBe(true);
}

async function createTwoPlayerRoom(host, guest, hostName = "Ray", guestName = "Night") {
  await host.goto("/");
  await host.getByLabel("Your nickname", { exact: true }).fill(hostName);
  await host.getByRole("button", { name: /Create a game/ }).click();
  const code = (await host.locator(".room-code").textContent()).trim();

  await guest.goto("/");
  await guest.getByLabel("Room code", { exact: true }).fill(code);
  await guest.getByLabel("Nickname", { exact: true }).fill(guestName);
  await guest.getByRole("button", { name: /Join a game/ }).click();
  await expect(host.getByText(guestName, { exact: true })).toBeVisible();
  await expect(host.getByText(/2 connected/)).toBeVisible();
  return code;
}

test("laptop host and phone guest complete, reconnect, and rematch an authoritative game", async ({ browser }) => {
  const hostContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
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
  await expectFitsViewport(guest);
  await guest.getByLabel("Room code", { exact: true }).fill(code);
  await guest.getByLabel("Nickname", { exact: true }).fill("Night");
  await guest.getByRole("button", { name: /Join a game/ }).click();
  await expect(host.getByText("Night", { exact: true })).toBeVisible();
  await expect(host.getByText(/2 connected/)).toBeVisible();
  await expectFitsViewport(guest);

  await host.getByRole("button", { name: /Start game/ }).click();
  await expect(guest.getByText(/Round 1 of/)).toBeVisible();
  await expect(host.getByText(/Classic Sync/)).toBeVisible();
  await expectFitsViewport(guest);

  await host.locator(".choice").first().click();
  await expect(guest.locator(".choice.selected")).toHaveCount(0);
  await expect(guest.getByText(/Choice locked/)).toHaveCount(0);
  await expect(guest.locator(".choice").first()).toBeEnabled();

  await guest.locator(".choice").first().click();
  await expect(host.getByText(/ROOM SYNC/)).toBeVisible();
  await expect(host.getByText("100%", { exact: true })).toBeVisible();
  await expect(guest.getByText("100%", { exact: true })).toBeVisible();
  await expectFitsViewport(guest);

  const guestIdentityBeforeReload = await guest.evaluate((roomCode) => localStorage.getItem(`sync.room.${roomCode}`), code);
  expect(guestIdentityBeforeReload).toBeTruthy();

  await guest.reload();
  await expect(guest).toHaveURL(new RegExp(`room=${code}`));
  await expect(guest.getByText(/ROOM SYNC/)).toBeVisible();
  await expect(guest.getByText("100%", { exact: true })).toBeVisible();
  const guestIdentityAfterReload = await guest.evaluate((roomCode) => localStorage.getItem(`sync.room.${roomCode}`), code);
  expect(guestIdentityAfterReload).toBe(guestIdentityBeforeReload);
  await expectFitsViewport(guest);

  const remainingModes = [
    { round: 2, mode: /Twin/ },
    { round: 3, mode: /Odd One Out/ },
    { round: 4, mode: /Reverse/ },
    { round: 5, mode: /Perfect Sync/ }
  ];

  for (const { round, mode } of remainingModes) {
    await host.getByRole("button", { name: /Next round/ }).click();
    await expect(host.getByText(new RegExp(`Round ${round} of`))).toBeVisible();
    await expect(guest.getByText(new RegExp(`Round ${round} of`))).toBeVisible();
    await expect(host.getByText(mode)).toBeVisible();
    await expect(guest.getByText(mode)).toBeVisible();
    await expectFitsViewport(guest);

    await host.locator(".choice").first().click();
    await expect(guest.locator(".choice.selected")).toHaveCount(0);
    await expect(guest.locator(".choice").first()).toBeEnabled();
    await guest.locator(".choice").first().click();
    await expect(host.getByText(/ROOM SYNC/)).toBeVisible();
    await expect(guest.getByText(/ROOM SYNC/)).toBeVisible();
    await expect(host.getByText("100%", { exact: true })).toBeVisible();
    await expect(guest.getByText("100%", { exact: true })).toBeVisible();
    await expectFitsViewport(guest);
  }

  await host.getByRole("button", { name: /See final scores/ }).click();
  await expect(host.getByText(/GAME OVER/)).toBeVisible();
  await expect(guest.getByText(/GAME OVER/)).toBeVisible();
  await expect(host.getByText(/FINAL ROOM SYNC/)).toBeVisible();
  await expect(guest.getByText(/FINAL ROOM SYNC/)).toBeVisible();
  await expectFitsViewport(guest);

  await host.getByRole("button", { name: /Play again/ }).click();
  await expect(host.getByText(/Round 1 of/)).toBeVisible();
  await expect(guest.getByText(/Round 1 of/)).toBeVisible();
  await expect(host.getByText(/Classic Sync/)).toBeVisible();
  await expect(guest.getByText(/Classic Sync/)).toBeVisible();
  await expect(host).toHaveURL(new RegExp(`room=${code}`));
  await expect(guest).toHaveURL(new RegExp(`room=${code}`));
  await expectFitsViewport(guest);

  await hostContext.close();
  await guestContext.close();
});

test("Durable Object alarm reveals a round when players do not answer", async ({ browser }) => {
  const hostContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  await createTwoPlayerRoom(host, guest, "TimerHost", "TimerGuest");
  await host.getByRole("button", { name: /Start game/ }).click();
  await expect(host.getByText(/Round 1 of/)).toBeVisible();
  await expect(guest.getByText(/Round 1 of/)).toBeVisible();

  await expect(host.getByText(/ROOM SYNC/)).toBeVisible({ timeout: 20000 });
  await expect(guest.getByText(/ROOM SYNC/)).toBeVisible({ timeout: 20000 });
  await expect(host.getByText("0%", { exact: true })).toBeVisible();
  await expect(guest.getByText("0%", { exact: true })).toBeVisible();
  await expectFitsViewport(guest);

  await hostContext.close();
  await guestContext.close();
});
