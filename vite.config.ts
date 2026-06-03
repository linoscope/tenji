import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    // Playwright e2e specs live under e2e/ and must not be run by Vitest.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
