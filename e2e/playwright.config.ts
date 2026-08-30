import { defineConfig, devices } from '@playwright/test';

/**
 * Chromium-only end-to-end. The web server is the bare consumer Vite app, which
 * imports the repo's built `dist` — so `pnpm build` in the package root must run
 * first (the CI job and the README both do). One worker keeps the shared wasm
 * runtime warm and the runs deterministic.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm exec vite --port 4321 --strictPort',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
