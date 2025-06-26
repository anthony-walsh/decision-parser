import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  base: '/decision-parser/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  worker: {
    format: 'es'
  },
  optimizeDeps: {
    include: ['vue', 'vue-router', 'dexie', 'fuzzysort'],
    exclude: ['pdfjs-dist', 'sql.js', 'absurd-sql']
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    hmr: false,
    headers: {
      // Required for SQLite WASM and SharedArrayBuffer
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin'
    }
  },
  build: {
    rollupOptions: {
      external: [],
      output: {
        manualChunks: {
          // Separate SQL.js and absurd-sql into their own chunks
          'sql-wasm': ['sql.js', 'absurd-sql']
        }
      }
    },
    // Ensure WASM files are included as assets
    assetsInclude: ['**/*.wasm']
  },
  define: {
    'import.meta.env.PDFJS_WORKER_SRC': JSON.stringify('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs'),
    // Define SQL.js WASM location
    'import.meta.env.SQLJS_WASM_URL': JSON.stringify('/decision-parser/sql-wasm/sql-wasm.wasm')
  }
})