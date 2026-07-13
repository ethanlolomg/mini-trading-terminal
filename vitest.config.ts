/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'
import path from 'path'

// Reuses the same `@` alias as vite.config.ts so tests can import app modules.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    // Unit tests live next to source under src/**; integration tests under tests/**.
    include: ['src/**/*.{test,spec}.ts', 'tests/**/*.{test,spec}.ts'],
  },
})
