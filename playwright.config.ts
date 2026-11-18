import { defineConfig } from '@playwright/test';

// e2e/extension.spec.ts loads the built extension (.output/chrome-mv3) into Chromium against a
// YouTube-shaped fixture page. e2e/live.spec.ts uses the real youtube.com, only with LIVE=1
// (`pnpm e2e:live`): it needs the network and breaks when YouTube changes, so CI doesn't run it.
export default defineConfig({
  testDir: 'e2e',
  testIgnore: process.env.LIVE ? [] : ['live.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { trace: 'retain-on-failure' },
});
