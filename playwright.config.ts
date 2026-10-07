import { defineConfig, devices } from '@playwright/test';
import * as os from 'node:os';

/**
 * Playwright E2E test config
 * Used to test the complete user flows of the web app
 */

// Dedicated port for E2E tests, to avoid conflicts with the dev server
const E2E_PORT = process.env.E2E_PORT || 15555;
const BASE_URL = `http://localhost:${E2E_PORT}`;

export default defineConfig({
  // Test directory
  testDir: './tests/e2e',

  // Run tests fully in parallel
  // Each test uses an independent BrowserContext and database name, fully isolated
  fullyParallel: true,

  // No retries on failure in CI; retry once in local development
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,

  // Use fewer workers in CI; locally the concurrency is limited by default, to avoid instability on Windows/Chromium under high concurrency such as
  // ERR_CONNECTION_RESET / ERR_INSUFFICIENT_RESOURCES / worker crashes.
  // Override with E2E_WORKERS if you want it faster.
  workers: (() => {
    if (process.env.CI) return 1

    const raw = process.env.E2E_WORKERS
    if (raw) {
      const parsed = Number(raw)
      if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed)
    }

    // Defaults to 2 (or fewer), which is more stable on resource-constrained machines.
    return Math.min(2, os.cpus().length || 1)
  })(),

  // Test report config
  reporter: [
    ['html', { open: 'never' }],
    ['list']
  ],

  // Shared settings
  use: {
    // Base URL
    baseURL: BASE_URL,

    // Collect the trace of failed tests
    trace: 'on-first-retry',

    // Screenshot config
    screenshot: 'only-on-failure',

    // Video config
    video: 'retain-on-failure',
  },

  // Project config - different browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // Uncomment if you need to test other browsers
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },

    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  // Automatically start the dev server dedicated to E2E tests
  webServer: {
    // E2E depends on the dist artifacts of the workspace packages (@prompt-optimizer/core/@prompt-optimizer/ui),
    // build first and then start the web dev server, to avoid running against a stale dist causing abnormal interactions/events.
    command: `pnpm -F @prompt-optimizer/core build && pnpm -F @prompt-optimizer/ui build && pnpm -F @prompt-optimizer/web dev --port ${E2E_PORT}`,
    url: BASE_URL,
    // Provide a minimal "enable" environment variable for Vite: make the built-in SiliconFlow image model selectable under E2E (VCR replay),
    // avoiding the UI not rendering the corresponding option for lack of a real key on the local machine, which would make the existing VCR fixtures unreachable.
    env: {
      ...process.env,
      VITE_SILICONFLOW_API_KEY: process.env.VITE_SILICONFLOW_API_KEY || 'vcr',
      VITE_DEEPSEEK_API_KEY: process.env.VITE_DEEPSEEK_API_KEY || 'vcr',
    },
    // By default, do not reuse an existing server, so that every test uses the latest build artifacts.
    reuseExistingServer: false,
    timeout: 120 * 1000,
  },
});
