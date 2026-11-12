import { test, expect } from "@playwright/test";

test("SYNC home presents three distinct experiences without replacing the live game", async ({ page }) => {
  await page.goto("/");
  const worlds = page.getByRole("region", { name: "Three ways to read the room." });
  await expect(worlds).toBeVisible();
  await expect(worlds.locator(".sync-world")).toHaveCount(3);

  await expect(worlds.getByRole("link", { name: /Live Site SYNC, play/i })).toHaveAttribute("href", "#app");
  await expect(worlds.getByRole("link", { name: /Chat SYNC, explore/i })).toHaveAttribute("href", "/chat/");
  await expect(worlds.getByRole("link", { name: /Lovable SYNC, visit/i })).toHaveAttribute("href", "https://sync-playtest.lovable.app/");
  await expect(worlds.getByText("PLAYTEST EXPERIENCE")).toBeVisible();

  // The existing authoritative multiplayer controls must still render.
  await expect(page.getByRole("button", { name: /create a game/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /join a game/i })).toBeVisible();
});

test("three-edition selector remains accessible on mobile and Chat links to its real route", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const worlds = page.getByRole("region", { name: "Three ways to read the room." });
  await expect(worlds.locator(".sync-world")).toHaveCount(3);
  await expect(worlds.getByRole("link", { name: /Lovable SYNC, visit/i })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);

  await worlds.getByRole("link", { name: /Chat SYNC, explore/i }).click();
  await expect(page).toHaveURL(/\/chat\/$/);
  await expect(page.getByText(/predict the prompt/i).first()).toBeVisible();
});
