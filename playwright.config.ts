import { defineConfig, devices } from '@playwright/test';

/* Play-tests for the farm world and the first session. They run against the dev server, where ?dev exposes the
   game's state (src/dev/hook.ts). Run: npm test (installs nothing: run `npx playwright install chromium` once). */

const PORT = Number(process.env.LIMA_PORT ?? 5199);

export default defineConfig({
  testDir: 'tests',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.LIMA_URL ?? `http://localhost:${PORT}/`,
    viewport: { width: 874, height: 402 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 874, height: 402 },
        // the 3D farm needs WebGL: software rendering on machines without a GPU
        launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
      },
    },
  ],
  webServer: process.env.LIMA_URL
    ? undefined
    : { command: `npm run dev -- --port ${PORT} --strictPort`, url: `http://localhost:${PORT}/`, reuseExistingServer: !process.env.CI, timeout: 120_000 },
});
