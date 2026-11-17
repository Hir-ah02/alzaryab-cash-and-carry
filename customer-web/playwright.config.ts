import { defineConfig, devices } from '@playwright/test';

/**
 * Run through `npm run test:e2e:isolated`, which prepares an isolated database schema
 * and starts the servers these tests talk to (see scripts/e2e.sh).
 * Tests share one seeded catalogue and change stock, so they run one at a time.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results/artifacts',
  use: {
    baseURL: process.env.E2E_SHOP ?? 'http://localhost:5176',
    channel: 'chrome', // the installed Google Chrome
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: 'chrome' }, testIgnore: /responsive/ },
    { name: 'responsive', use: { channel: 'chrome' }, testMatch: /responsive/ },
  ],
});
