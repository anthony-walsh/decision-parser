#!/usr/bin/env node

/**
 * Build Validation Script
 * 
 * Validates that all required assets are present and properly configured
 * after the build process completes.
 * 
 * AIDEV-NOTE: Production build validation for absurd-sql migration
 */

import { readFileSync, existsSync, statSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const distDir = join(projectRoot, 'dist');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function formatSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

function validateDistExists() {
  if (!existsSync(distDir)) {
    log('❌ dist/ directory not found. Run `npm run build` first.', 'red');
    process.exit(1);
  }
  log('✅ dist/ directory exists', 'green');
}

function validateSQLiteAssets() {
  const sqlWasmDir = join(distDir, 'sql-wasm');
  const wasmFile = join(sqlWasmDir, 'sql-wasm.wasm');
  
  if (!existsSync(sqlWasmDir)) {
    log('❌ sql-wasm/ directory missing from dist/', 'red');
    return false;
  }
  
  if (!existsSync(wasmFile)) {
    log('❌ sql-wasm.wasm file missing from dist/sql-wasm/', 'red');
    return false;
  }
  
  const wasmSize = statSync(wasmFile).size;
  log(`✅ SQLite WASM file present (${formatSize(wasmSize)})`, 'green');
  
  // Validate WASM file is reasonable size (should be ~600KB)
  if (wasmSize < 500000 || wasmSize > 2000000) {
    log(`⚠️ WASM file size unusual: ${formatSize(wasmSize)}`, 'yellow');
  }
  
  return true;
}

function validateColdStorageAssets() {
  const coldStorageDir = join(distDir, 'cold-storage');
  const indexFile = join(coldStorageDir, 'storage-index.json');
  
  if (!existsSync(coldStorageDir)) {
    log('❌ cold-storage/ directory missing from dist/', 'red');
    return false;
  }
  
  if (!existsSync(indexFile)) {
    log('❌ storage-index.json missing from dist/cold-storage/', 'red');
    return false;
  }
  
  // Validate index file structure
  try {
    const indexContent = JSON.parse(readFileSync(indexFile, 'utf8'));
    
    if (!indexContent.version || !indexContent.metadata) {
      log('❌ Invalid storage-index.json structure', 'red');
      return false;
    }
    
    log(`✅ Cold storage index valid (${indexContent.totalBatches} batches)`, 'green');
    return true;
    
  } catch (error) {
    log(`❌ Error reading storage-index.json: ${error.message}`, 'red');
    return false;
  }
}

function validateWorkerAssets() {
  const workersDir = join(distDir, 'workers');
  const expectedWorkers = [
    'hotStorageWorker',
    'coldStorageWorker',
    'migrationWorker'
  ];
  
  if (!existsSync(workersDir)) {
    log('❌ workers/ directory missing from dist/', 'red');
    return false;
  }
  
  const workerFiles = readdirSync(workersDir).filter(f => f.endsWith('.js'));
  log(`✅ Found ${workerFiles.length} worker files in dist/workers/`, 'green');
  
  // Check for expected worker patterns
  for (const expectedWorker of expectedWorkers) {
    const found = workerFiles.some(file => file.includes(expectedWorker));
    if (found) {
      log(`  ✅ ${expectedWorker} found`, 'green');
    } else {
      log(`  ⚠️ ${expectedWorker} not found (may use different naming)`, 'yellow');
    }
  }
  
  return true;
}

function validateAssetSizes() {
  const assetsDir = join(distDir, 'assets');
  
  if (!existsSync(assetsDir)) {
    log('❌ assets/ directory missing from dist/', 'red');
    return false;
  }
  
  const assetFiles = readdirSync(assetsDir);
  let totalSize = 0;
  const largeAssets = [];
  
  for (const file of assetFiles) {
    const filePath = join(assetsDir, file);
    const size = statSync(filePath).size;
    totalSize += size;
    
    // Flag assets larger than 1MB
    if (size > 1024 * 1024) {
      largeAssets.push({ file, size });
    }
  }
  
  log(`✅ Total asset size: ${formatSize(totalSize)}`, 'green');
  
  if (largeAssets.length > 0) {
    log('⚠️ Large assets detected:', 'yellow');
    for (const asset of largeAssets) {
      log(`  - ${asset.file}: ${formatSize(asset.size)}`, 'yellow');
    }
  }
  
  // Warn if total size is very large
  if (totalSize > 50 * 1024 * 1024) { // 50MB
    log(`⚠️ Total asset size is large: ${formatSize(totalSize)}`, 'yellow');
  }
  
  return true;
}

function validateIndexHTML() {
  const indexFile = join(distDir, 'index.html');
  
  if (!existsSync(indexFile)) {
    log('❌ index.html missing from dist/', 'red');
    return false;
  }
  
  const indexContent = readFileSync(indexFile, 'utf8');
  
  // Check for required elements
  const checks = [
    { pattern: /<script.*type="module"/, name: 'ES module script' },
    { pattern: /\/decision-parser\//, name: 'Base path configuration' },
    { pattern: /<link.*stylesheet/, name: 'Stylesheet link' }
  ];
  
  for (const check of checks) {
    if (check.pattern.test(indexContent)) {
      log(`  ✅ ${check.name} found`, 'green');
    } else {
      log(`  ⚠️ ${check.name} not found`, 'yellow');
    }
  }
  
  log('✅ index.html validated', 'green');
  return true;
}

function validateBuildManifest() {
  const manifestFile = join(distDir, '.vite', 'manifest.json');
  
  if (!existsSync(manifestFile)) {
    log('⚠️ Build manifest not found (not required)', 'yellow');
    return true;
  }
  
  try {
    const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
    const entryPoints = Object.keys(manifest).length;
    log(`✅ Build manifest valid (${entryPoints} entry points)`, 'green');
    return true;
  } catch (error) {
    log(`⚠️ Error reading build manifest: ${error.message}`, 'yellow');
    return true; // Not critical
  }
}

// Main validation function
function validateBuild() {
  log('🚀 Starting build validation...', 'blue');
  log('=====================================', 'blue');
  
  let allValid = true;
  
  // Core validations
  validateDistExists();
  allValid &= validateSQLiteAssets();
  allValid &= validateColdStorageAssets();
  allValid &= validateWorkerAssets();
  allValid &= validateAssetSizes();
  allValid &= validateIndexHTML();
  allValid &= validateBuildManifest();
  
  log('=====================================', 'blue');
  
  if (allValid) {
    log('🎉 Build validation completed successfully!', 'green');
    log('All required assets are present and properly configured.', 'green');
  } else {
    log('❌ Build validation failed!', 'red');
    log('Some required assets are missing or incorrectly configured.', 'red');
    process.exit(1);
  }
}

// Run validation if script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  validateBuild();
}

export { validateBuild };