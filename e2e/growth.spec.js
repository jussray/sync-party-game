import { test, expect } from "@playwright/test";

test("campaign landing records bounded anonymous growth evidence and still creates a room", async ({ page, context }) => {
  const growthResponse = page.waitForResponse((response) =>
    response.url().includes("/api/growth/event") && response.request().method() === "POST"
  );

  await page.goto("/?utm_campaign=sync-launch-2026&utm_source=facebook&utm_medium=social&utm_content=hero-1");

  const response = await growthResponse;
  expect(response.status()).toBe(200);
  expect(response.request().postDataJSON()).toMatchObject({
    event: "landing_view",
    growth: {
      campaign_id: "sync-launch-2026",
      source: "facebook",
      medium: "social",
      content: "hero-1"
    }
  });

  const cookies = await context.cookies();
  const visitorCookie = cookies.find((cookie) => cookie.name === "sync_growth_vid");
  expect(visitorCookie?.value).toMatch(/^visitor_[0-9a-f]{20}$/);
  expect(visitorCookie?.sameSite).toBe("Lax");

  const storedContext = await page.evaluate(() => JSON.parse(sessionStorage.getItem("sync.growth.context")));
  expect(storedContext).toEqual({
    campaign_id: "sync-launch-2026",
    source: "facebook",
    medium: "social",
    content: "hero-1",
    referrer_host: null
  });

  const receiptProbe = await page.evaluate(async () => {
    const growth = {
      visitor_id: localStorage.getItem("sync.growth.visitor"),
      session_id: sessionStorage.getItem("sync.growth.session"),
      ...JSON.parse(sessionStorage.getItem("sync.growth.context"))
    };
    const probe = await fetch("/api/growth/event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event: "landing_view",
        event_id: "event_probe_12345678",
        growth
      })
    });
    return { status: probe.status, body: await probe.json() };
  });
  expect(receiptProbe.status).toBe(200);
  expect(receiptProbe.body.accepted).toBe(true);
  expect(receiptProbe.body.event_fingerprint).toMatch(/^[0-9a-f]{64}$/);
  expect(receiptProbe.body.campaign_fingerprint).toMatch(/^[0-9a-f]{64}$/);
  expect(receiptProbe.body.continuity_cookie).toMatch(/^growth-v1\./);

  let createPayload = null;
  page.on("request", (request) => {
    if (request.url().includes("/api/rooms/create")) createPayload = request.postDataJSON();
  });

  await page.getByLabel("Your nickname", { exact: true }).fill("GrowthHost");
  await page.getByRole("button", { name: /Create a game/ }).click();
  await expect(page.locator(".room-code")).toBeVisible();

  expect(createPayload?.growth).toMatchObject({
    campaign_id: "sync-launch-2026",
    source: "facebook",
    medium: "social",
    content: "hero-1"
  });
  expect(createPayload?.growth?.name).toBeUndefined();
  expect(createPayload?.growth?.email).toBeUndefined();
});

test("browser clients cannot forge server-authoritative conversion events", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const response = await fetch("/api/growth/event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event: "game_finished",
        event_id: "event_12345678",
        growth: {
          visitor_id: "visitor_12345678",
          session_id: "session_12345678",
          campaign_id: "forged-campaign"
        }
      })
    });
    return { status: response.status, body: await response.json() };
  });

  expect(result.status).toBe(400);
  expect(result.body.error).toMatch(/server-authoritative/);
});
