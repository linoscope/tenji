import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Base path: '/' locally; the Pages workflow sets BASE_PATH=/tenji/ for the
  // deployed build so assets resolve under the project-site path.
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    // Playwright e2e specs live under e2e/ and must not be run by Vitest.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
