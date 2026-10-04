import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    timeout: 30_000,
    retries: process.env.CI ? 1 : 0,
    use: { baseURL: 'http://localhost:4174', trace: 'retain-on-failure' },
    webServer: {
        command: 'npm run build && npm run preview',
        url: 'http://localhost:4174',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
    projects: [
        { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
        { name: 'phone', use: { ...devices['Pixel 7'] } },
    ],
});
