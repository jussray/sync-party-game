import { test, expect } from "@playwright/test";

// Real multiplayer proof: two independent browser contexts (separate storage, cookies, sockets)
// against the real Worker + Durable Object (local `wrangler dev` or PLAYWRIGHT_BASE_URL).
const MODES = ["Classic Sync", "Twin", "Odd One Out", "Reverse", "Perfect Sync"];
const deviceOptions = ({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch }) =>
  Object.fromEntries(Object.entries({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch }).filter(([, v]) => v !== undefined));
const shots = (testInfo, page, name) => page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });

async function fingerprint(page) {
  const el = page.locator("#fingerprint");
  return { seq: Number(await el.getAttribute("data-seq")), hash: await el.getAttribute("data-hash") };
}
async function expectSameAuthority(host, guest) {
  await expect.poll(async () => JSON.stringify(await fingerprint(guest))).toBe(JSON.stringify(await fingerprint(host)));
}
async function noHorizontalScroll(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}
// Record every STATE frame a page receives over the wire.
function recordStates(page) {
  const frames = [];
  page.on("websocket", (ws) => ws.on("framereceived", ({ payload }) => {
    try { const message = JSON.parse(payload); if (message.type === "STATE") frames.push(message.state); } catch {}
  }));
  return frames;
}

test("two independent browsers: 5 modes, private answers, same reveal/score/SYNC, reconnect, rematch", async ({ browser }, testInfo) => {
  test.setTimeout(150_000);
  const device = deviceOptions(testInfo.project.use);
  const hostContext = await browser.newContext({ ...device });
  const guestContext = await browser.newContext({ ...device });
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  const guestFrames = recordStates(guest);
  const hostErrors = []; const guestErrors = [];
  host.on("pageerror", (error) => hostErrors.push(error.message));
  guest.on("pageerror", (error) => guestErrors.push(error.message));

  // 1-2. landing + theme toggle
  await host.goto("/");
  await expect(host.getByText("Think alike. Beat the clock.")).toBeVisible();
  const themeButton = host.getByRole("button", { name: /Toggle light or dark theme/ });
  const initialTheme = await host.locator("html").getAttribute("data-theme");
  const toggledTheme = initialTheme === "dark" ? "light" : "dark";
  await themeButton.click();
  await expect(host.locator("html")).toHaveAttribute("data-theme", toggledTheme);
  await host.reload(); // theme preference persists
  await expect(host.locator("html")).toHaveAttribute("data-theme", toggledTheme);
  await shots(testInfo, host, "01-landing-toggled-theme");
  await themeButton.click();
  await expect(host.locator("html")).toHaveAttribute("data-theme", initialTheme);
  await noHorizontalScroll(host);

  // 3-5. host creates room
  await host.getByLabel("Your nickname", { exact: true }).fill("Ray");
  await host.getByRole("button", { name: /Create a game/ }).click();
  const code = (await host.locator(".room-code").textContent()).trim();
  expect(code).toMatch(/^[A-Z0-9]{5}$/);

  // 6-9. guest joins in an independent context
  await guest.goto("/");
  await guest.getByLabel("Room code", { exact: true }).fill(code);
  await guest.getByLabel("Nickname", { exact: true }).fill("Night");
  await guest.getByRole("button", { name: /Join a game/ }).click();

  // 10-12. presence agrees
  await expect(host.locator(".players")).toContainText("Night");
  await expect(guest.locator(".players")).toContainText("Ray");
  await expect(host.getByText(/2 connected · 2\/8 joined/)).toBeVisible();
  await expect(guest.getByText(/2 connected · 2\/8 joined/)).toBeVisible();
  await expectSameAuthority(host, guest);
  await shots(testInfo, host, "02-lobby-host");
  await shots(testInfo, guest, "02-lobby-guest");
  await expect(guest.getByRole("button", { name: /Start game/ })).toHaveCount(0);

  // 13. start
  await host.getByRole("button", { name: /Start game/ }).click();

  const hostScores = [];
  for (let round = 0; round < 5; round += 1) {
    // 14. identical round / mode / prompt
    for (const page of [host, guest]) {
      await expect(page.getByText(`Round ${round + 1} of 5`)).toBeVisible();
      await expect(page.locator(".mode-label")).toHaveText(MODES[round]);
    }
    await expect(guest.locator(".prompt")).toHaveText(await host.locator(".prompt").textContent());
    await expect(host.locator("#timer")).toHaveText(/^\d+s$/);
    await noHorizontalScroll(guest);
    if (round === 0) await shots(testInfo, guest, "03-choosing-guest");

    // Round 5 (Perfect Sync): both choose the same answer -> 100% payoff. Else: different answers.
    const hostChoice = 0; const guestChoice = round === 4 || round === 0 ? 0 : 1;

    // 15. host submits privately
    await host.locator(".choice").nth(hostChoice).click();
    await expect(host.getByText("✓ Choice locked")).toBeVisible();
    await expect(guest.locator("#lockCount")).toHaveText("1/2 locked in");

    // 16. guest cannot see host's answer: every STATE frame guest received while choosing/locked hides values
    const leaked = guestFrames.filter((s) => (s.phase === "choosing" || s.phase === "locked") && Object.values(s.answers).some((v) => v !== true));
    expect(leaked, "no answer values reach another client before reveal").toEqual([]);
    await expect(guest.locator(".choice.selected")).toHaveCount(0);

    // 18a. host cannot overwrite a locked choice, even with a hand-crafted intent on a fresh socket
    if (round === 0) {
      const overwrite = await host.evaluate(async (roomCode) => {
        const me = JSON.parse(localStorage.getItem(`sync.room.${roomCode}`));
        const proto = location.protocol === "https:" ? "wss:" : "ws:";
        const ws = new WebSocket(`${proto}//${location.host}/api/rooms/${roomCode}/ws?playerId=${me.playerId}&token=${me.resumeToken}`);
        return await new Promise((resolve) => {
          ws.onopen = () => {
            ws.send(JSON.stringify({ type: "SUBMIT_CHOICE", choiceIndex: 3 }));
            ws.send(JSON.stringify({ type: "SET_SCORE", scores: { [me.playerId]: 999 } }));
          };
          const errors = [];
          ws.onmessage = (event) => { const m = JSON.parse(event.data); if (m.type === "ERROR") errors.push(m.error); if (errors.length === 2) { ws.close(); resolve(errors); } };
          setTimeout(() => resolve(errors), 4000);
        });
      }, code);
      expect(overwrite).toEqual(["Choice already locked", "Unknown action"]);
    }

    // 17. guest submits
    await guest.locator(".choice").nth(guestChoice).click();

    // LOCK tension beat is visible to both before REVEAL
    await expect(guest.getByText("LOCKED 🔒")).toBeVisible();
    if (round === 0) await shots(testInfo, guest, "04-locked-tension-beat");

    // 19-21. same reveal, same score, same SYNC %
    await expect(host.getByText("ROOM SYNC")).toBeVisible();
    await expect(guest.getByText("ROOM SYNC")).toBeVisible();
    const expectedSync = hostChoice === guestChoice ? "100%" : "50%";
    await expect(host.locator(".sync-meter strong")).toHaveText(expectedSync);
    await expect(guest.locator(".sync-meter strong")).toHaveText(expectedSync);
    await expectSameAuthority(host, guest);
    const hostCounts = await host.locator(".result-row").allTextContents();
    expect(await guest.locator(".result-row").allTextContents()).toEqual(hostCounts);
    hostScores.push(await host.locator("#myScore").textContent());
    if (round === 4) {
      await expect(host.getByText("PERFECT SYNC ✦ Everyone matched!")).toBeVisible();
      await expect(guest.locator(".reveal-card.perfect")).toBeVisible();
      await shots(testInfo, guest, "05-perfect-sync-guest");
    }
    if (round === 1) await shots(testInfo, host, "05-reveal-host");

    // 18b. after reveal, choices cannot be changed
    await expect(guest.locator(".choice")).toHaveCount(0);

    // 22-24. guest refresh mid-game -> same identity, same authoritative state
    if (round === 2) {
      const before = await fingerprint(host);
      const identityBefore = await guest.evaluate((roomCode) => localStorage.getItem(`sync.room.${roomCode}`), code);
      expect(identityBefore).toBeTruthy();
      await guest.reload();
      await expect(guest).toHaveURL(new RegExp(`room=${code}`));
      await expect(guest.getByText("ROOM SYNC")).toBeVisible();
      await expect(guest.locator(".mode-label")).toHaveText(MODES[round]);
      await expectSameAuthority(host, guest);
      expect((await fingerprint(guest)).seq).toBeGreaterThanOrEqual(before.seq);
      await expect(guest.getByText(/Your score: \d+ pts/)).toBeVisible();
      expect(await guest.evaluate((roomCode) => localStorage.getItem(`sync.room.${roomCode}`), code)).toBe(identityBefore);
      await expect(host.locator("#fingerprint")).toBeVisible();
    }

    await expect(guest.getByRole("button", { name: /Next round|See final scores/ })).toHaveCount(0);
    await host.getByRole("button", { name: round === 4 ? /See final scores/ : /Next round/ }).click();
  }

  // 26-28. final leaderboard + room-wide final SYNC
  for (const page of [host, guest]) {
    await expect(page.getByText("GAME OVER")).toBeVisible();
    await expect(page.getByText("FINAL ROOM SYNC")).toBeVisible();
  }
  // classic 100, twin 50, odd 50, reverse 50, perfect 100 -> 70
  await expect(host.locator(".final-sync strong")).toHaveText("70%");
  await expect(guest.locator(".final-sync strong")).toHaveText("70%");
  const hostBoard = (await host.locator(".score").allTextContents()).map((t) => t.replace(" (you)", ""));
  const guestBoard = (await guest.locator(".score").allTextContents()).map((t) => t.replace(" (you)", ""));
  expect(guestBoard).toEqual(hostBoard);
  await expectSameAuthority(host, guest);
  await shots(testInfo, host, "06-results-host");
  await shots(testInfo, guest, "06-results-guest");

  // 29-30. rematch in the same room
  await expect(guest.getByRole("button", { name: /Play again/ })).toHaveCount(0);
  await host.getByRole("button", { name: /Play again/ }).click();
  for (const page of [host, guest]) {
    await expect(page.getByText("Round 1 of 5")).toBeVisible();
    await expect(page.locator(".mode-label")).toHaveText("Classic Sync");
    expect(new URL(page.url()).searchParams.get("room")).toBe(code);
  }
  await host.locator(".choice").nth(2).click();
  await guest.locator(".choice").nth(2).click();
  await expect(guest.locator(".sync-meter strong")).toHaveText("100%");
  await expect(host.getByText("Your score: 3 pts")).toBeVisible();
  await expectSameAuthority(host, guest);
  await shots(testInfo, host, "07-rematch-playable");

  // receipts: unbroken seq + hash chain ending at the state both clients show
  const receipts = await (await host.request.get(`/api/rooms/${code}/receipts`)).json();
  for (let i = 1; i < receipts.length; i += 1) {
    expect(receipts[i].seq).toBe(receipts[i - 1].seq + 1);
    expect(receipts[i].previousStateHash).toBe(receipts[i - 1].stateHash);
  }
  expect(receipts.at(-1).stateHash).toBe((await fingerprint(guest)).hash);
  await testInfo.attach("receipts.json", { body: JSON.stringify(receipts, null, 2), contentType: "application/json" });
  await testInfo.attach("scores.json", { body: JSON.stringify({ code, hostScores, hostBoard, guestBoard }, null, 2), contentType: "application/json" });

  expect(hostErrors).toEqual([]);
  expect(guestErrors).toEqual([]);
  await hostContext.close();
  await guestContext.close();
});

test("accessibility: keyboard path, toggles, muted play info, reduced motion", async ({ browser }, testInfo) => {
  const context = await browser.newContext({ ...deviceOptions(testInfo.project.use), reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/");
  const sound = page.getByRole("button", { name: /Toggle party sound/ });
  await expect(sound).toHaveAttribute("aria-pressed", "false"); // muted by default
  await sound.click();
  await expect(sound).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("status")).toHaveText("Party sound on");
  await sound.click();
  await expect(sound).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText(/never carries required game information/)).toBeVisible();
  // keyboard only: focus nickname, type, Enter submits create form
  await page.getByLabel("Your nickname", { exact: true }).focus();
  await page.keyboard.type("Keys");
  await page.keyboard.press("Enter");
  await expect(page.locator(".room-code")).toHaveText(/^[A-Z0-9]{5}$/);
  await page.keyboard.press("Tab");
  const focused = await page.evaluate(() => document.activeElement?.tagName);
  expect(["A", "BUTTON"]).toContain(focused);
  // reduced motion honored
  const duration = await page.evaluate(() => { const el = document.createElement("div"); el.className = "timer danger"; document.body.append(el); return getComputedStyle(el).animationDuration; });
  expect(parseFloat(duration)).toBeLessThan(0.01);
  // share link with no identity pre-fills the room code and asks for a nickname
  const code = (await page.locator(".room-code").textContent()).trim();
  const other = await (await browser.newContext(deviceOptions(testInfo.project.use))).newPage();
  await other.goto(`/?room=${code}`);
  await expect(other.getByLabel("Room code", { exact: true })).toHaveValue(code);
  await expect(other.getByLabel("Nickname", { exact: true })).toBeFocused();
  await noHorizontalScroll(page);
  await context.close();
});
