/**
 * Deployment Configuration
 * 
 * Configuration for static asset management and production deployment
 * AIDEV-NOTE: Production deployment settings for GitHub Pages and asset optimization
 */

export const deploymentConfig = {
  // Base configuration
  base: '/decision-parser/',

  // Asset paths
  paths: {
    sqlWasm: '/decision-parser/sql-wasm/',
    coldStorage: '/decision-parser/cold-storage/',
    workers: '/decision-parser/workers/',
    assets: '/decision-parser/assets/'
  },

  // Cold storage configuration
  coldStorage: {
    // Maximum batch size (15MB)
    maxBatchSize: 15 * 1024 * 1024,

    // Cache configuration
    maxCacheSize: 100 * 1024 * 1024, // 100MB

    // Batch naming pattern
    batchNamePattern: 'documents-batch-{id}.json',

    // Index file
    indexFile: 'storage-index.json',

    // Encryption settings
    encryption: {
      algorithm: 'AES-GCM',
      keyDerivation: 'PBKDF2',
      iterations: 600000
    },

    // Content-Type headers for proper serving
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=31536000', // 1 year cache
      'Access-Control-Allow-Origin': '*'
    }
  },

  // SQLite WASM configuration
  sqlWasm: {
    files: [
      'sql-wasm.wasm'
    ],

    // Headers for WASM files
    headers: {
      'Content-Type': 'application/wasm',
      'Cache-Control': 'public, max-age=31536000', // 1 year cache
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin'
    }
  },

  // Worker configuration
  workers: {
    // Worker files that will be created during build
    files: [
      'coldStorageWorker',
      'migrationWorker',
      'pdfProcessor'
    ],

    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=31536000',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin'
    }
  },

  // Performance optimizations
  performance: {
    // Chunk size limits
    maxChunkSize: 1000, // 1MB warning threshold

    // Compression
    gzip: true,
    brotli: true,

    // Source maps in production
    sourcemap: true,

    // Bundle analysis
    bundleAnalyzer: process.env.ANALYZE === 'true'
  },

  // GitHub Pages specific settings
  githubPages: {
    // Custom domain (if used)
    domain: null,

    // 404 handling for SPA
    spa404: true,

    // CNAME file generation
    generateCname: false,

    // Asset optimization
    optimizeAssets: true
  },

  // Security headers
  security: {
    // Content Security Policy
    csp: {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-eval'", "'wasm-unsafe-eval'"],
      'worker-src': ["'self'", 'blob:'],
      'connect-src': ["'self'", 'https://cdnjs.cloudflare.com'],
      'img-src': ["'self'", 'data:', 'blob:'],
      'style-src': ["'self'", "'unsafe-inline'"],
      'font-src': ["'self'"]
    },

    // Additional security headers
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    }
  },

  // Development configuration
  development: {
    // Hot reload settings
    hmr: false, // Disabled for worker compatibility

    // CORS headers for development
    cors: true,

    // Dev server configuration  
    server: {
      host: '0.0.0.0',
      port: 5173,
      open: false
    },

    // Preview server for testing builds
    preview: {
      host: '0.0.0.0',
      port: 4173,
      open: false
    }
  }
};

export default deploymentConfig;