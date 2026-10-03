import { test, expect } from "@playwright/test";

async function createRoom(page, name = "InviteHost") {
  await page.goto("/");
  await page.getByRole("button", { name: /create a game/i }).click();
  await page.getByLabel(/^your nickname$/i).fill(name);
  await page.getByRole("button", { name: /create a game/i }).click();
  const code = (await page.locator(".room-code").textContent())?.trim();
  expect(code).toMatch(/^[A-Z0-9]{5}$/);
  return code;
}

test("host lobby exposes a canonical share link and live roster", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const code = await createRoom(page);

  const panel = page.locator(".room-invite-panel");
  await expect(panel).toBeVisible();
  await expect(panel.getByText("Private picks, shared reveal, no pressure.")).toBeVisible();
  await expect(panel.locator("[data-room-url]")).toContainText(`?room=${code}`);
  await expect(panel.locator("[data-invite-roster]")).toContainText("1/8 joined");
  await expect(panel.getByRole("button", { name: /copy room link/i })).toBeVisible();
  await expect(panel.getByRole("button", { name: /share invite/i })).toBeVisible();

  await context.close();
});

test("shared room link sends a new guest directly to a prefilled join flow", async ({ browser }) => {
  const hostContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const host = await hostContext.newPage();
  const code = await createRoom(host, "LinkHost");

  const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const guest = await guestContext.newPage();
  await guest.goto(`/?room=${code}`);

  await expect(guest.getByLabel(/^room code$/i)).toHaveValue(code);
  await expect(guest.getByLabel(/^nickname$/i)).toBeVisible();
  await guest.getByLabel(/^nickname$/i).fill("LinkGuest");
  await guest.getByRole("button", { name: /join a game/i }).click();

  await expect(host.getByText("LinkGuest", { exact: true })).toBeVisible();
  await expect(host.locator(".room-invite-panel [data-invite-roster]")).toContainText("2/8 joined");
  await expect(host.locator(".room-invite-panel [data-invite-roster]")).toContainText("LinkHost");
  await expect(host.locator(".room-invite-panel [data-invite-roster]")).toContainText("LinkGuest");

  await hostContext.close();
  await guestContext.close();
});
