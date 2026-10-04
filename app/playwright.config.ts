import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    timeout: 60_000,
    fullyParallel: true,
    retries: process.env.CI ? 1 : 0,
    use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure' },
    webServer: {
        command: 'npm run build:e2e && npm run preview',
        url: 'http://localhost:4173',
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
    },
    projects: [
        { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 900 } }, testIgnore: /phone/ },
        { name: 'phone', use: { ...devices['Pixel 7'] }, testMatch: /phone/ },
    ],
});
