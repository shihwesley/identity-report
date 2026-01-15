import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.d.ts', 'src/types/**'],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80
      }
    },
    testTimeout: 10000,
    hookTimeout: 10000,
    // Use project-based configuration for different environments
    projects: [
      {
        // Node environment for unit tests (crypto, sync, etc. - no DOM needed)
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: [
            'tests/unit/**/*.test.ts'
          ],
          exclude: ['tests/e2e/**', 'tests/contracts/**', 'node_modules/**'],
          setupFiles: ['./tests/setup/vitest.setup.ts']
        }
      },
      {
        // jsdom environment for unit tests that use React hooks
        extends: true,
        test: {
          name: 'unit-react',
          environment: 'jsdom',
          include: [
            'tests/unit/**/*.test.tsx'
          ],
          exclude: ['tests/e2e/**', 'tests/contracts/**', 'node_modules/**'],
          setupFiles: ['./tests/setup/vitest.setup.ts']
        }
      },
      {
        // jsdom environment for component tests (need DOM)
        extends: true,
        test: {
          name: 'component',
          environment: 'jsdom',
          include: ['tests/component/**/*.test.tsx'],
          exclude: ['node_modules/**'],
          setupFiles: ['./tests/setup/vitest.setup.ts']
        }
      },
      {
        // Node environment for integration tests (middleware, API routes)
        extends: true,
        test: {
          name: 'integration',
          environment: 'node',
          include: ['tests/integration/**/*.test.ts'],
          exclude: ['tests/e2e/**', 'node_modules/**'],
          setupFiles: ['./tests/setup/vitest.setup.ts']
        }
      }
    ]
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@fixtures': path.resolve(__dirname, './tests/fixtures')
    }
  }
})
