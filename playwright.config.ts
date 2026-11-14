import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;

/**
 * Browser tests run against the production build served by `vite preview`, so the service
 * worker and PWA precache are the real ones. Touch input is driven per engine in
 * tests/e2e/support/touch.ts.
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : 4,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'ipad',
      testIgnore: /desktop\.spec\.ts/,
      use: {
        ...devices['iPad (gen 7) landscape'],
        browserName: 'webkit',
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      name: 'tablet-chromium',
      testIgnore: /desktop\.spec\.ts/,
      use: {
        browserName: 'chromium',
        viewport: { width: 1180, height: 820 },
        deviceScaleFactor: 2,
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      // Desktop should work too: a plain mouse, no touch at all.
      name: 'desktop-chromium',
      testMatch: /desktop\.spec\.ts/,
      use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 800 },
        hasTouch: false,
        isMobile: false,
      },
    },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: BASE_URL,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
});
