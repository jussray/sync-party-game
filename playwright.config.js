import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:8787",
    trace: process.env.PW_TRACE || "retain-on-failure",
    // Optional: point at a preinstalled Chromium instead of downloading one.
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command: "npm run dev -- --port 8787",
    url: "http://127.0.0.1:8787",
    reuseExistingServer: true,
    timeout: 30_000
  }
});
