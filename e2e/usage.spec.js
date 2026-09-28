import { test, expect } from "@playwright/test";

test("founder usage dashboard stays locked until a read key is supplied and renders aggregate usage", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/growth/summary*", async (route) => {
    requests += 1;
    expect(route.request().headers()["x-growth-read-key"]).toBe("founder-test-key");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        campaign_key: "unattributed",
        seq: 25,
        unique_visitors: 6,
        counters: {
          landing_view: 12,
          play_intent: 8,
          room_created: 4,
          room_joined: 5,
          game_started: 3,
          game_finished: 2,
          rematch_started: 1
        },
        first_at: 1789963200000,
        last_at: 1789966800000
      })
    });
  });

  await page.goto("/usage.html");
  await expect(page.getByRole("heading", { name: /WHO’S USING SYNC/i })).toBeVisible();
  await expect(page.locator("#results")).toBeHidden();
  expect(requests).toBe(0);

  await page.locator("#growthKey").fill("founder-test-key");
  await page.getByRole("button", { name: "Load usage" }).click();

  await expect(page.locator("#results")).toBeVisible();
  await expect(page.locator("#uniqueVisitors")).toHaveText("6");
  await expect(page.locator("#landingViews")).toHaveText("12");
  await expect(page.locator("#playIntent")).toHaveText("8");
  await expect(page.locator("#roomsCreated")).toHaveText("4");
  await expect(page.locator("#roomsJoined")).toHaveText("5");
  await expect(page.locator("#gamesStarted")).toHaveText("3");
  await expect(page.locator("#gamesFinished")).toHaveText("2");
  await expect(page.locator("#rematches")).toHaveText("1");
  await expect(page.locator("#status")).toContainText("real gameplay activity");
  expect(requests).toBe(1);
});
