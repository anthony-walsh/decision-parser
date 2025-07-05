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
  // Ensure WASM files and cold storage assets are included
  assetsInclude: ['**/*.wasm', '**/cold-storage/**/*'],
  worker: {
    format: 'es',
    rollupOptions: {
      output: {
        // Ensure workers are properly chunked for production
        entryFileNames: 'workers/[name]-[hash].js',
        chunkFileNames: 'workers/chunks/[name]-[hash].js'
      }
    }
  },
  optimizeDeps: {
    include: ['vue', 'vue-router', 'fuzzysort'],
    // AIDEV-NOTE: Exclude large dependencies that are loaded dynamically
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
    target: 'esnext', // Support for modern browsers with WASM and Workers
    rollupOptions: {
      external: [],
      output: {
        manualChunks: (id) => {
          // SQL.js and absurd-sql - large dependencies
          if (id.includes('sql.js') || id.includes('absurd-sql')) {
            return 'sql-wasm';
          }
          
          // PDF.js - separate for better caching
          if (id.includes('pdfjs-dist') || id.includes('pdf-parse')) {
            return 'pdf-worker';
          }
          
          // Core Vue framework
          if (id.includes('vue') && !id.includes('vue-router')) {
            return 'vue-core';
          }
          
          // Vue Router separately for code splitting
          if (id.includes('vue-router')) {
            return 'vue-router';
          }
          
          // Search utilities  
          if (id.includes('fuzzysort')) {
            return 'search-utils';
          }
          
          // Services layer - group related services
          if (id.includes('/services/') && (
            id.includes('MemoryManager') || 
            id.includes('PerformanceMonitor') || 
            id.includes('BrowserResourceManager')
          )) {
            return 'performance-services';
          }
          
          // Storage services
          if (id.includes('/services/') && (
            id.includes('Storage') || 
            id.includes('Encryption') || 
            id.includes('Authentication')
          )) {
            return 'storage-services';
          }
          
          // Workers - keep separate for proper loading
          if (id.includes('/workers/')) {
            return 'workers';
          }
          
          // Node modules that are large but not categorized above
          if (id.includes('node_modules') && id.length > 200) {
            return 'vendor-large';
          }
          
          // Regular vendor chunks
          if (id.includes('node_modules')) {
            return 'vendor';
          }
          
          // Default - let Vite decide
          return undefined;
        },
        // Optimize chunk naming for production
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          // Special handling for WASM files
          if (assetInfo.names?.[0]?.endsWith('.wasm')) {
            return 'sql-wasm/[name][extname]'
          }
          // Cold storage assets
          if (assetInfo.names?.[0]?.includes('cold-storage')) {
            return 'cold-storage/[name][extname]'
          }
          // CSS files
          if (assetInfo.names?.[0]?.endsWith('.css')) {
            return 'assets/[name]-[hash][extname]'
          }
          // Images and fonts
          if (assetInfo.names?.[0]?.match(/\.(png|jpe?g|gif|svg|ico|webp|avif)$/)) {
            return 'assets/images/[name]-[hash][extname]'
          }
          if (assetInfo.names?.[0]?.match(/\.(woff2?|eot|ttf|otf)$/)) {
            return 'assets/fonts/[name]-[hash][extname]'
          }
          // Regular assets
          return 'assets/[name]-[hash][extname]'
        }
      }
    },
    // Production optimizations
    minify: 'terser',
    // Increase chunk size warning limit for SQLite chunks
    chunkSizeWarningLimit: 1000,
    // Enable source maps for debugging but use cheaper option for performance
    sourcemap: 'source-map',
    // Additional optimizations
    reportCompressedSize: false, // Faster builds
    cssCodeSplit: true, // Split CSS for better caching
    assetsInlineLimit: 4096, // Inline small assets
    // Optimize dependencies
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true
    }
  },
  define: {
    // AIDEV-NOTE: PDF.js worker for current implementation
    'import.meta.env.PDFJS_WORKER_SRC': JSON.stringify('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs'),
    
    // AIDEV-NOTE: Future SQLite WASM configuration (when migration is complete)
    'import.meta.env.SQLJS_WASM_URL': JSON.stringify('/decision-parser/sql-wasm/sql-wasm.wasm'),
    'import.meta.env.COLD_STORAGE_BASE': JSON.stringify('/decision-parser/cold-storage/'),
    
    // AIDEV-NOTE: Performance configuration for new architecture
    'import.meta.env.MEMORY_WARNING_THRESHOLD': JSON.stringify(200 * 1024 * 1024), // 200MB
    'import.meta.env.MEMORY_CRITICAL_THRESHOLD': JSON.stringify(300 * 1024 * 1024), // 300MB
    'import.meta.env.HOT_STORAGE_LIMIT': JSON.stringify(5000), // 5000 documents
    'import.meta.env.COLD_BATCH_CACHE_SIZE': JSON.stringify(100 * 1024 * 1024), // 100MB
    
    // AIDEV-NOTE: Migration feature flags (can be enabled gradually)
    'import.meta.env.ENABLE_NEW_AUTHENTICATION': JSON.stringify(false),
    'import.meta.env.ENABLE_NEW_HOT_STORAGE': JSON.stringify(false),
    'import.meta.env.ENABLE_NEW_COLD_STORAGE': JSON.stringify(true),
    'import.meta.env.ENABLE_WORKERS': JSON.stringify(false)
  },
  // Preview server configuration for testing builds
  preview: {
    host: '0.0.0.0',
    port: 4173,
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin'
    }
  }
})