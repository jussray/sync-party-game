import { test, expect } from "@playwright/test";

test("founder analytics truth dashboard separates signals from server-authoritative product use", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/growth/summary*", async (route) => {
    requests += 1;
    expect(route.request().headers()["x-growth-read-key"]).toBe("founder-test-key");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        measurement_version: "analytics-truth-v2",
        legacy_merged: false,
        scope: { type: "all", key: "all" },
        seq: 31,
        unique_growth_identities: 6,
        traffic_counts: { browser_signal: 9, automation_likely: 4, unverified_client: 2 },
        product_counters: {
          room_created: 4,
          room_joined: 5,
          game_started: 3,
          game_finished: 2,
          rematch_started: 1,
          player_game_started: 8,
          player_game_finished: 6,
          player_rematch_started: 3
        },
        acquisition: {
          landing_signals: 12,
          source_counts: { facebook: 3, direct: 2 },
          medium_counts: { social: 3 },
          referrer_counts: { "www.facebook.com": 3 },
          evidence_counts: { browser_signal: 8, automation_likely: 4 }
        },
        first_at: 1789963200000,
        last_at: 1789966800000
      })
    });
  });

  await page.goto("/usage.html");
  await expect(page.getByRole("heading", { name: /SIGNAL ≠ PROOF/i })).toBeVisible();
  await expect(page.locator("#results")).toBeHidden();
  expect(requests).toBe(0);

  await page.locator("#growthKey").fill("founder-test-key");
  await page.getByRole("button", { name: "Load truth" }).click();

  await expect(page.locator("#results")).toBeVisible();
  await expect(page.locator("#identities")).toHaveText("6");
  await expect(page.locator("#landingSignals")).toHaveText("12");
  await expect(page.locator("#browserSignals")).toHaveText("9");
  await expect(page.locator("#automationSignals")).toHaveText("4");
  await expect(page.locator("#gamesStarted")).toHaveText("3");
  await expect(page.locator("#gamesFinished")).toHaveText("2");
  await expect(page.locator("#participantStarts")).toHaveText("8");
  await expect(page.locator("#measurementMeta")).toContainText("analytics-truth-v2");
  await expect(page.locator("#status")).toContainText("SERVER VERIFIED");
  await expect(page.locator("#sourceBreakdown")).toContainText("facebook");
  expect(requests).toBe(1);
});
