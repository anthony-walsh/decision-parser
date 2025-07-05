import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.d.ts',
        'vite.config.ts',
        'vitest.config.ts'
      ],
      thresholds: {
        functions: 85,
        statements: 85,
        branches: 75,
        lines: 85
      }
    },
    // Workers and WASM testing configuration
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true // Needed for worker and WASM testing
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  define: {
    // Test environment variables
    'import.meta.env.VITE_APP_ENV': '"test"',
    'import.meta.env.SQLJS_WASM_URL': '"/sql-wasm/sql-wasm.wasm"',
    'import.meta.env.COLD_STORAGE_BASE': '"/cold-storage/"',
    'import.meta.env.MEMORY_WARNING_THRESHOLD': '200000000',
    'import.meta.env.MEMORY_CRITICAL_THRESHOLD': '300000000'
  }
})