import { defineConfig } from '@playwright/test';

// Default run: Playwright's implicit chromium-only project. Set E2E_ENGINES
// to a comma-separated list (chromium, firefox, webkit) to run the suites
// against multiple engine families on machines that have those browsers and
// their system dependencies installed.
const engines = (process.env.E2E_ENGINES ?? '')
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean);

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  projects: engines.length
    ? engines.map((name) => ({ name, use: { browserName: name } }))
    : undefined,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4174',
    viewport: { width: 375, height: 1200 },
    colorScheme: 'light',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4174',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: !process.env.CI,
  },
});
