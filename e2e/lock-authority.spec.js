import { test, expect } from "@playwright/test";

// Proves the server-authoritative LOCK beat, wire-level answer privacy, identical state fingerprints,
// the receipts continuity chain, and host-authority transfer. Real Worker + Durable Object, no mocks.
const MODES = ["Classic Sync", "Twin", "Odd One Out", "Reverse", "Perfect Sync"];
const LAPTOP = { viewport: { width: 1280, height: 800 } };
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

async function fingerprint(page) {
  const el = page.locator("#fingerprint");
  return `${await el.getAttribute("data-seq")}:${await el.getAttribute("data-hash")}`;
}
async function expectSameAuthority(a, b) {
  await expect.poll(async () => (await fingerprint(b)) === (await fingerprint(a)) && (await fingerprint(a)) !== "null:null").toBe(true);
}
function recordStates(page) {
  const frames = [];
  page.on("websocket", (ws) => ws.on("framereceived", ({ payload }) => {
    try { const message = JSON.parse(payload); if (message.type === "STATE") frames.push(message.state); } catch {}
  }));
  return frames;
}
async function createRoom(page, name) {
  await page.goto("/");
  await page.getByRole("button", { name: /Create a game/i }).click();
  await page.getByLabel(/^your nickname$/i).fill(name);
  await page.getByRole("button", { name: /Create a game/i }).click();
  const code = (await page.locator(".room-code").textContent()).trim();
  expect(code).toMatch(/^[A-Z0-9]{5}$/);
  return code;
}
async function joinRoom(page, code, name) {
  await page.goto("/");
  await page.getByRole("button", { name: /Join a game/i }).click();
  await page.getByLabel(/^room code$/i).fill(code);
  await page.getByLabel(/^nickname$/i).fill(name);
  await page.getByRole("button", { name: /Join a game/i }).click();
}

test("LOCK beat, private answers on the wire, identical fingerprints and receipts across all five modes", async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const hostContext = await browser.newContext(LAPTOP);
  const guestContext = await browser.newContext(PHONE);
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  const guestFrames = recordStates(guest);

  const code = await createRoom(host, "Ray");
  await joinRoom(guest, code, "Night");
  await expect(host.getByText(/2 connected/i).first()).toBeVisible();
  await expectSameAuthority(host, guest);
  await host.locator("#startBtn").click();

  for (let round = 0; round < 5; round += 1) {
    for (const page of [host, guest]) {
      await expect(page.getByText(`Round ${round + 1} of 5`)).toBeVisible();
      await expect(page.locator(".mode-label")).toHaveText(MODES[round]);
    }
    const guestChoice = round === 0 || round === 4 ? 0 : 1;
    await host.locator(".choice").nth(0).click();
    await expect(guest.locator("#lockCount")).toHaveText("1/2 locked in");
    await expect(guest.locator(".choice").nth(guestChoice)).toBeEnabled();
    await guest.locator(".choice").nth(guestChoice).click();

    // LOCKED: choices gone, answers still private, then the room alarm reveals
    await expect(guest.getByRole("heading", { name: "LOCKED 🔒" })).toBeVisible();
    if (round === 0) await guest.screenshot({ path: testInfo.outputPath("locked-phone.png"), fullPage: true });
    const leaked = guestFrames.filter((s) => (s.phase === "choosing" || s.phase === "locked") && Object.values(s.answers).some((v) => v !== true));
    expect(leaked, "no answer values reach another client before reveal").toEqual([]);
    expect(guestFrames.some((s) => s.phase === "locked" && s.roundIndex === round)).toBe(true);

    const expected = guestChoice === 0 ? "100%" : "50%";
    await expect(host.locator(".sync-readout strong")).toHaveText(expected);
    await expect(guest.locator(".sync-readout strong")).toHaveText(expected);
    expect(await guest.locator(".answer-result").allTextContents()).toEqual(await host.locator(".answer-result").allTextContents());
    await expectSameAuthority(host, guest);
    if (round === 4) await guest.screenshot({ path: testInfo.outputPath("perfect-sync-phone.png"), fullPage: true });
    await host.locator("#nextBtn").click();
  }

  // classic 100, twin 50, odd 50, reverse 50, perfect 100 -> 70
  await expect(host.locator(".final-sync strong")).toHaveText("70%");
  await expect(guest.locator(".final-sync strong")).toHaveText("70%");
  await expectSameAuthority(host, guest);

  const receipts = await (await host.request.get(`/api/rooms/${code}/receipts`)).json();
  for (let i = 1; i < receipts.length; i += 1) {
    expect(receipts[i].seq).toBe(receipts[i - 1].seq + 1);
    expect(receipts[i].previousStateHash).toBe(receipts[i - 1].stateHash);
  }
  expect(receipts.filter((r) => r.event.startsWith("ROUND_LOCKED")).length).toBe(5);
  expect(receipts.filter((r) => r.event === "ROUND_REVEALED").length).toBe(5);
  expect(`${receipts.at(-1).seq}:${receipts.at(-1).stateHash}`).toBe(await fingerprint(guest));
  expect(JSON.stringify(receipts)).not.toContain("resumeToken");
  await testInfo.attach("receipts.json", { body: JSON.stringify(receipts, null, 2), contentType: "application/json" });
  await hostContext.close();
  await guestContext.close();
});

test("host authority transfers to a connected player when the host drops", async ({ browser }) => {
  const contexts = await Promise.all([browser.newContext(LAPTOP), browser.newContext(PHONE), browser.newContext(PHONE)]);
  const [host, first, second] = await Promise.all(contexts.map((context) => context.newPage()));
  const code = await createRoom(host, "Host");
  await joinRoom(first, code, "First");
  await joinRoom(second, code, "Second");
  await expect(host.getByText(/3 connected/i).first()).toBeVisible();
  await expect(first.locator("#startBtn")).toHaveCount(0);

  await contexts[0].close();
  // earliest-joined connected player becomes host and can drive the room
  await expect(first.locator("#startBtn")).toBeVisible();
  await expect(second.locator("#startBtn")).toHaveCount(0);
  await first.locator("#startBtn").click();
  await expect(second.getByText("Round 1 of 5")).toBeVisible();
  await expectSameAuthority(first, second);
  await Promise.all(contexts.slice(1).map((context) => context.close()));
});
