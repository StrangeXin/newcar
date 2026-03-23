import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './apps/web/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3101',
    trace: 'on-first-retry',
    viewport: { width: 1440, height: 1100 },
  },
  webServer: [
    {
      command: 'cd apps/api && AI_E2E_MOCK=1 PORT=3100 npx tsx src/index.ts',
      url: 'http://127.0.0.1:3100/health',
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command: 'cd apps/web && NEXT_PUBLIC_API_URL=http://127.0.0.1:3100 npx next dev -p 3101',
      url: 'http://127.0.0.1:3101/login',
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
