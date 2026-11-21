import { test, expect } from "@playwright/test";

// Real path: two (headless, so automated) players finish a 5-round game. The results
// screen shows the public board without names or room codes, and the automated game
// is NOT recorded: only fully human-verified games reach the public board. This also
// keeps the production proof from seeding the live board with CI games.
const matching = (board, day) => board.entries.filter((e) => e.players === 2 && e.rounds === 5 && e.sync === 100 && e.day === day).length;

test("automated games show the anonymous board but never land on it", async ({ browser, request }) => {
  const day = new Date().toISOString().slice(0, 10);
  const before = await (await request.get("/api/leaderboard")).json();
  const hostContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  const hostName = "Leaderhost";
  const guestName = "Leaderguest";

  await host.goto("/");
  await host.getByRole("button", { name: /Create a game/i }).click();
  await host.getByLabel(/^your nickname$/i).fill(hostName);
  await host.getByRole("button", { name: /Create a game/i }).click();
  const code = (await host.locator(".room-code").textContent()).trim();

  await guest.goto("/");
  await guest.getByRole("button", { name: /Join a game/i }).click();
  await guest.getByLabel(/^room code$/i).fill(code);
  await guest.getByLabel(/^nickname$/i).fill(guestName);
  await guest.getByRole("button", { name: /Join a game/i }).click();
  await expect(host.getByText(/2 connected/)).toBeVisible();

  await host.getByRole("button", { name: /start game/i }).click();
  for (let round = 1; round <= 5; round += 1) {
    await expect(guest.getByText(new RegExp(`Round ${round} of`))).toBeVisible();
    await host.locator(".choice").first().click();
    await guest.locator(".choice").first().click();
    await expect(host.getByText(/ROOM SYNC/)).toBeVisible();
    await host.getByRole("button", { name: round === 5 ? /see final scores/i : /next round/i }).click();
  }

  for (const page of [host, guest]) {
    const board = page.locator("#leaderboard");
    await expect(board.getByRole("heading", { name: /SYNC LEADERBOARD/ })).toBeVisible();
    await expect(page.locator("#leaderboardStatus")).not.toContainText("Loading");
    const text = await board.textContent();
    for (const secret of [code, hostName, guestName]) expect(text).not.toContain(secret);
  }
  expect(await guest.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const response = await request.get("/api/leaderboard");
  expect(response.ok()).toBe(true);
  const raw = await response.text();
  for (const secret of [code, hostName, guestName, "p_"]) expect(raw).not.toContain(secret);
  const body = JSON.parse(raw);
  expect(body.version).toBe("sync-leaderboard-v1");
  // Not recorded: no new 100% / 2-player / 5-round row for today.
  expect(matching(body, day)).toBeLessThanOrEqual(matching(before, day));
  for (const entry of body.entries) expect(Object.keys(entry).sort()).toEqual(["day", "players", "rank", "rounds", "sync"]);

  await host.screenshot({ path: test.info().outputPath("leaderboard-host.png"), fullPage: true });
  await guest.screenshot({ path: test.info().outputPath("leaderboard-guest.png"), fullPage: true });
  await hostContext.close();
  await guestContext.close();
});

test("Game Hub origins can read the board cross-origin; other origins and APIs stay gated", async ({ request }) => {
  for (const origin of ["https://games.jussco.company", "https://www.jussco.company"]) {
    const response = await request.get("/api/leaderboard", { headers: { origin } });
    expect(response.status()).toBe(200);
    expect(response.headers()["access-control-allow-origin"]).toBe(origin);
    expect((await response.json()).version).toBe("sync-leaderboard-v1");
  }
  const blocked = await request.get("/api/leaderboard", { headers: { origin: "https://evil.example" } });
  expect(blocked.status()).toBe(403);
  const otherApi = await request.post("/api/rooms/create", { headers: { origin: "https://games.jussco.company" }, data: { name: "x" } });
  expect(otherApi.status()).toBe(403);
  const write = await request.post("/api/leaderboard", { headers: { origin: "https://games.jussco.company" }, data: { sync: 100 } });
  expect(write.status()).toBe(403);
});
