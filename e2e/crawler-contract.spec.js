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
  expect(robots).toContain("Sitemap: https://sync.jussco.company/sitemap.xml");

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
  expect(llms).toContain("Search indexing, short attributed citation, and user-directed retrieval of public descriptions are welcome.");
  expect(llms).toContain("Model training, bulk harvesting, and commercial reuse are not granted.");

  const sitemapResponse = await request.get("/sitemap.xml");
  expect(sitemapResponse.ok()).toBeTruthy();
  const sitemap = await sitemapResponse.text();
  expect(sitemap).toContain("https://sync.jussco.company/");
  expect(sitemap).toContain("https://sync.jussco.company/chat/");
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

test("both public SYNC editions have canonical, search and structured game metadata", async ({ request }) => {
  for (const [path, title, canonical] of [
    ["/", "SYNC Party", "https://sync.jussco.company/"],
    ["/chat/", "Chat SYNC", "https://sync.jussco.company/chat/"]
  ]) {
    const response = await request.get(path);
    expect(response.ok()).toBeTruthy();
    const html = await response.text();
    expect(html).toContain(`<link rel="canonical" href="${canonical}"`);
    expect(html).toMatch(/<meta name="description"/);
    expect(html).toMatch(/<meta property="og:url"/);
    const jsonText = html.split('<script type="application/ld+json">')[1]?.split("</script>")[0];
    expect(jsonText).toBeTruthy();
    const schema = JSON.parse(jsonText);
    expect(schema["@type"]).toBe("VideoGame");
    expect(schema.name).toBe(title);
    expect(schema.url).toBe(canonical);
  }
});
