import { defineConfig, devices } from '@playwright/test';

// BASE_URL points at whatever we are verifying: a local container during
// development, or a Cloud Run candidate revision URL during a release check.
const baseURL = process.env.BASE_URL || 'http://localhost:8080';

const DESKTOP = { width: 1280, height: 800 };

export default defineConfig({
  testDir: './e2e',
  // Zero retries keeps the demo honest: a failure is a real failure.
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['json', { outputFile: 'playwright-report/results.json' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      // Functional + screenshot specs. No video: keeps verification runs fast.
      name: 'chromium',
      testIgnore: /demo\.spec\.js/,
      use: { ...devices['Desktop Chrome'], viewport: DESKTOP },
    },
    {
      // Walkthrough recording for PR comments and demo decks.
      name: 'demo',
      testMatch: /demo\.spec\.js/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: DESKTOP,
        video: { mode: 'on', size: DESKTOP },
      },
    },
  ],
});
