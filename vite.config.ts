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
    exclude: ['pdfjs-dist']
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    hmr: false
  },
  define: {
    'import.meta.env.PDFJS_WORKER_SRC': JSON.stringify('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs')
  }
})