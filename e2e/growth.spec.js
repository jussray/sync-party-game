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
  const landingReceipt = await response.json();
  expect(landingReceipt.measurement_version).toBe("analytics-truth-v2");
  expect(["browser_signal", "automation_likely", "unverified_client"]).toContain(landingReceipt.evidence_class);

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
    const eventId = `event_probe_${crypto.randomUUID().replaceAll("-", "")}`;
    const request = () => fetch("/api/growth/event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: "landing_view", event_id: eventId, growth })
    });
    const first = await request();
    const firstBody = await first.json();
    const duplicate = await request();
    return {
      eventId,
      first: { status: first.status, body: firstBody },
      duplicate: { status: duplicate.status, body: await duplicate.json() }
    };
  });
  expect(receiptProbe.eventId).toMatch(/^event_probe_[0-9a-f]{32}$/);
  expect(receiptProbe.first.status).toBe(200);
  expect(receiptProbe.first.body.accepted).toBe(true);
  expect(receiptProbe.first.body.duplicate).toBe(false);
  expect(receiptProbe.first.body.event_fingerprint).toMatch(/^[0-9a-f]{64}$/);
  expect(receiptProbe.first.body.scope_fingerprint).toMatch(/^[0-9a-f]{64}$/);
  expect(receiptProbe.first.body.continuity_cookie).toMatch(/^growth-v2\./);

  expect(receiptProbe.duplicate.status).toBe(200);
  expect(receiptProbe.duplicate.body.accepted).toBe(true);
  expect(receiptProbe.duplicate.body.duplicate).toBe(true);
  expect(receiptProbe.duplicate.body.event_fingerprint).toBe(receiptProbe.first.body.event_fingerprint);
  expect(receiptProbe.duplicate.body.scope_fingerprint).toBe(receiptProbe.first.body.scope_fingerprint);
  expect(receiptProbe.duplicate.body.continuity_cookie).toBe(receiptProbe.first.body.continuity_cookie);

  let createPayload = null;
  page.on("request", (request) => {
    if (request.url().includes("/api/rooms/create")) createPayload = request.postDataJSON();
  });

  await page.getByRole("button", { name: /create a game/i }).click();
  await page.getByLabel(/^your nickname$/i).fill("GrowthHost");
  await page.getByRole("button", { name: /create a game/i }).click();
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

test("obvious automation is classified without storing or trusting a forged evidence class", async ({ request }) => {
  const response = await request.post("/api/growth/event", {
    headers: { "user-agent": "Googlebot/2.1" },
    data: {
      event: "landing_view",
      event_id: "event_bot_12345678",
      evidence_class: "server_authoritative",
      growth: {
        visitor_id: "visitor_bot_12345678",
        session_id: "session_bot_12345678",
        campaign_id: "bot-probe"
      }
    }
  });
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.measurement_version).toBe("analytics-truth-v2");
  expect(body.evidence_class).toBe("automation_likely");
  expect(body.traffic_class).toBe("automation_likely");
});
