import { defineConfig, devices } from "@playwright/test";
import path from "path";

export const STORAGE_STATE_PATH = path.join(__dirname, "tests/e2e/.auth/user.json");

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 60000,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
    ["json", { outputFile: "test-results/results.json" }],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: STORAGE_STATE_PATH,
      },
      dependencies: ["setup"],
      testIgnore: [/auth\.setup\.ts/, /01-auth\.spec\.ts/],
    },
    {
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 7"],
        storageState: STORAGE_STATE_PATH,
      },
      dependencies: ["setup"],
      testMatch: [/02-overview\.spec\.ts/, /03-transactions\.spec\.ts/, /04-accounts\.spec\.ts/],
    },
    {
      name: "auth-tests",
      use: {
        ...devices["Desktop Chrome"],
      },
      testMatch: /01-auth\.spec\.ts/,
    },
  ],
});
