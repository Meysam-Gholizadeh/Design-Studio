import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  // Chart-heavy pages are CPU-intensive; more workers starve each other on typical laptops.
  workers: 2,
  retries: 0,
  // Full user journeys (build-served app, many charts) need more than the 30 s default on typical laptops.
  timeout: 60_000,
  // Lazy route chunks + many charts can take several seconds to settle on a busy machine.
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: 'npm run build && npm run preview -- --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
