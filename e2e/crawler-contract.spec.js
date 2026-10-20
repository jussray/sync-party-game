import { test, expect } from "@playwright/test";

const deniedAgents = ["GPTBot", "ClaudeBot", "Google-Extended", "CCBot"];
const privatePaths = ["/api/", "/control-room", "/control-room.html", "/usage", "/usage.html"];
const unknownNavigationPaths = ["/about-us", "/legal", "/team", "/definitely-not-a-sync-route"];

test("machine-facing crawler contract is explicit and excludes private surfaces", async ({ request }) => {
  const robotsResponse = await request.get("/robots.txt");
  expect(robotsResponse.ok()).toBeTruthy();
  const robots = await robotsResponse.text();
  expect(robots).not.toMatch(/<!doctype|<html/i);

  for (const agent of deniedAgents) {
    expect(robots).toContain(`User-agent: ${agent}\nDisallow: /`);
  }
  for (const path of privatePaths) {
    expect(robots).toContain(`Disallow: ${path}`);
  }
  expect(robots).toContain("Sitemap: https://sync-party-game.mcgill-raylene.workers.dev/sitemap.xml");

  const policyResponse = await request.get("/crawlers.json");
  expect(policyResponse.ok()).toBeTruthy();
  const policy = await policyResponse.json();
  expect(policy.policy).toMatchObject({
    public_discovery: true,
    citation: true,
    user_directed_retrieval: true,
    model_training: false,
    bulk_harvesting: false,
    private_access: false,
    execution_authority: false
  });
  expect(policy.public_discovery_agents).toEqual(expect.arrayContaining([
    "OAI-SearchBot",
    "ChatGPT-User",
    "Claude-SearchBot",
    "Claude-User",
    "Googlebot"
  ]));

  const llmsResponse = await request.get("/llms.txt");
  expect(llmsResponse.ok()).toBeTruthy();
  const llms = await llmsResponse.text();
  expect(llms).toContain("Public indexing, citation, and user-directed retrieval are allowed.");
  expect(llms).toContain("Model training and bulk harvesting are not granted.");

  const sitemapResponse = await request.get("/sitemap.xml");
  expect(sitemapResponse.ok()).toBeTruthy();
  const sitemap = await sitemapResponse.text();
  expect(sitemap).toContain("https://sync-party-game.mcgill-raylene.workers.dev/");
  expect(sitemap).toContain("https://sync-party-game.mcgill-raylene.workers.dev/chat/");
  for (const path of privatePaths) {
    expect(sitemap).not.toContain(path);
  }
});

test("unknown navigation paths return a real 404 instead of impersonating the home page", async ({ page }) => {
  for (const path of unknownNavigationPaths) {
    const response = await page.goto(path);
    expect(response?.status(), `${path} should be a 404`).toBe(404);
    await expect(page.getByRole("heading", { name: "Page not found." })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  }
});
