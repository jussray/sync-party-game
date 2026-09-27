import { test, expect } from "@playwright/test";

test("Sync control room records privacy-safe lifecycle truth and renders standalone", async ({ page, request }) => {
  const beforeResponse = await request.get("/api/control-room/snapshot");
  expect(beforeResponse.ok()).toBe(true);
  const before = await beforeResponse.json();
  const beforeSeq = before.control?.seq || 0;
  const beforeRooms = before.control?.counters?.ROOM_CREATED || 0;

  const createResponse = await request.post("/api/rooms/create", {
    data: { name: "ControlHost" }
  });
  expect(createResponse.ok()).toBe(true);
  const created = await createResponse.json();
  expect(created.code).toMatch(/^[A-Z0-9]{5}$/);

  const snapshotResponse = await request.get("/api/control-room/snapshot");
  expect(snapshotResponse.ok()).toBe(true);
  const snapshot = await snapshotResponse.json();

  expect(snapshot.schema).toBe("sync-control-room/v1");
  expect(snapshot.service).toBe("sync-party-game");
  expect(snapshot.authority).toMatchObject({
    repository: "jussray/sync-party-game",
    source_branch: "main",
    production_branch: "production"
  });
  expect(snapshot.proof.required).toBe("Playwright");
  expect(snapshot.relay).toMatchObject({
    target: "Founder Control Room",
    mode: "privacy-safe-pull",
    endpoint: "/api/control-room/snapshot"
  });
  expect(snapshot.control.seq).toBeGreaterThan(beforeSeq);
  expect(snapshot.control.counters.ROOM_CREATED).toBeGreaterThanOrEqual(beforeRooms + 1);
  expect(snapshot.control.rooms_observed).toBeGreaterThanOrEqual(1);
  expect(snapshot.control.control_fingerprint).toMatch(/^[0-9a-f]{64}$/);
  expect(snapshot.control.continuity_cookie).toMatch(/^sync-control-v1\.[0-9a-f]{16}\.[0-9]+$/);
  expect(snapshot.control.rooms).toBeUndefined();
  expect(JSON.stringify(snapshot)).not.toContain(created.code);
  expect(JSON.stringify(snapshot)).not.toContain("ControlHost");

  await page.goto("/control-room");
  await expect(page.getByRole("heading", { name: /SYNC CONTROL ROOM/i })).toBeVisible();
  await expect(page.getByTestId("runtime-status")).toContainText(/RUNTIME VERIFIED|LOCAL \/ UNVERIFIED/);
  await expect(page.locator("#eventsRecorded")).not.toHaveText("0");
  await expect(page.locator("#controlFingerprint")).toContainText(snapshot.control.control_fingerprint);
  await expect(page.locator("#continuityCookie")).toContainText("sync-control-v1.");
  await expect(page.getByText(created.code, { exact: true })).toHaveCount(0);
  await expect(page.getByText("ControlHost", { exact: true })).toHaveCount(0);

  await page.screenshot({
    path: "test-results/sync-control-room.png",
    fullPage: true
  });
});
