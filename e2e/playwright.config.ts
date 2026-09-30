import { defineConfig, devices } from '@playwright/test';

import { undeclaredSpecs } from './needs';

/**
 * Chromium-only end-to-end. Every test drives the suite's own fixture page (the bare
 * consumer Vite app, which imports the repo's built `dist` — so `pnpm build` in the package
 * root must run first; the CI job and the README both do). With `TAI_E2E_TARGET` set the run
 * builds nothing and drives a running stack, but nothing here a stack could serve, so every
 * test is skipped (its `needs('fixture-page')` is unmet) and no server is started. One worker
 * keeps the shared wasm runtime warm and the runs deterministic.
 */

// The run drives a running stack (`TAI_E2E_TARGET` set) instead of booting the fixture page's
// Vite server. The base URL stays the fixture origin: with a target set every test is skipped,
// so nothing navigates to it.
const TARGET = !!process.env.TAI_E2E_TARGET?.trim();
const baseURL = 'http://localhost:4321';

export default defineConfig({
  testDir: './tests',
  // A spec that declares no needs is built-stack only: a run against a target leaves it out.
  testIgnore: TARGET ? undeclaredSpecs() : [],
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }], ['junit', { outputFile: 'junit.xml' }]],
  timeout: 60_000,
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: TARGET
    ? undefined
    : {
        command: 'pnpm exec vite --port 4321 --strictPort',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
