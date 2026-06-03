import { defineConfig } from '@playwright/test'

// One-off, opt-in e2e (real Supabase). Run with `npm run test:e2e`.
// NOT part of the required gates (test/typecheck/lint/build).
// The build picks up .env, so when Supabase env vars are present the app shows
// the Share UI; the spec skips itself when that UI is absent.
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    timeout: 180_000,
    reuseExistingServer: true,
  },
})
