#!/usr/bin/env node

/**
 * Encrypt Test Data Script
 * 
 * Creates encrypted version of test-batch-001.json using Node.js crypto
 * Compatible with browser EncryptionService for development testing
 * 
 * AIDEV-NOTE: Node.js equivalent of browser EncryptionService for test data generation
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash, randomBytes, pbkdf2, createCipheriv } from 'crypto';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Node.js crypto doesn't have SubtleCrypto, so we'll use the built-in crypto module
const pbkdf2Async = promisify(pbkdf2);

class NodeEncryptionService {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32; // 256 bits / 8
    this.ivLength = 12; // 96 bits for GCM
    this.pbkdf2Iterations = 600000;
    this.saltLength = 32; // 256 bits
  }

  /**
   * Derives encryption key from password using PBKDF2
   */
  async deriveKey(password, salt) {
    const key = await pbkdf2Async(password, salt, this.pbkdf2Iterations, this.keyLength, 'sha256');
    return key;
  }

  /**
   * Generates cryptographically secure random bytes
   */
  generateRandomBytes(length) {
    return randomBytes(length);
  }

  /**
   * Encrypt batch data for cold storage
   */
  async encryptBatch(batchData, password) {
    try {
      // Convert batch data to JSON string
      const plaintext = JSON.stringify(batchData);
      
      // Generate random salt and IV
      const salt = this.generateRandomBytes(this.saltLength);
      const iv = this.generateRandomBytes(this.ivLength);
      
      // Derive encryption key
      const key = await this.deriveKey(password, salt);
      
      // Create AES-GCM cipher
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      
      // Encrypt the data
      let encrypted = cipher.update(plaintext, 'utf8');
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      
      // Get the authentication tag
      const authTag = cipher.getAuthTag();
      
      // Combine encrypted data with auth tag
      const encryptedWithTag = Buffer.concat([encrypted, authTag]);
      
      // Calculate checksum for integrity verification
      const checksum = this.calculateChecksum(encryptedWithTag);
      
      // Return encrypted batch structure compatible with browser format
      return {
        version: '1.0',
        algorithm: 'AES-GCM',
        salt: salt.toString('base64'),
        iv: iv.toString('base64'),
        data: encryptedWithTag.toString('base64'),
        checksum: checksum,
        metadata: {
          batchId: batchData.metadata?.batchId || 'unknown',
          documentCount: batchData.documents ? batchData.documents.length : 0,
          originalSize: plaintext.length,
          encryptedSize: encryptedWithTag.length,
          created: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Batch encryption failed:', error);
      throw new Error('Failed to encrypt batch data');
    }
  }

  /**
   * Calculate SHA-256 checksum for integrity verification
   */
  calculateChecksum(data) {
    const hash = createHash('sha256');
    hash.update(data);
    return hash.digest('hex');
  }
}

/**
 * Main function to encrypt test data
 */
async function encryptTestData() {
  console.log('🔐 Encrypting test data...');
  
  try {
    const testDataPath = join(projectRoot, 'public', 'cold-storage', 'test-batch-001.json');
    const encryptedDataPath = join(projectRoot, 'public', 'cold-storage', 'test-batch-001-encrypted.json');
    
    // Read the unencrypted test data
    console.log('📖 Reading test data from:', testDataPath);
    const testData = JSON.parse(readFileSync(testDataPath, 'utf8'));
    
    // Use the test password from CLAUDE.md
    const testPassword = 'TestPassword123!';
    
    // Create encryption service
    const encryptionService = new NodeEncryptionService();
    
    // Encrypt the test data
    console.log('🔒 Encrypting with test password...');
    const encryptedBatch = await encryptionService.encryptBatch(testData, testPassword);
    
    // Write the encrypted data
    console.log('💾 Writing encrypted data to:', encryptedDataPath);
    writeFileSync(encryptedDataPath, JSON.stringify(encryptedBatch, null, 2));
    
    // Display results
    console.log('✅ Encryption completed successfully!');
    console.log(`📊 Original size: ${encryptedBatch.metadata.originalSize} bytes`);
    console.log(`📊 Encrypted size: ${encryptedBatch.metadata.encryptedSize} bytes`);
    console.log(`📊 Document count: ${encryptedBatch.metadata.documentCount}`);
    console.log(`🔑 Checksum: ${encryptedBatch.checksum.substring(0, 16)}...`);
    
  } catch (error) {
    console.error('❌ Encryption failed:', error.message);
    process.exit(1);
  }
}

// Run encryption if script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  encryptTestData();
}

export { encryptTestData, NodeEncryptionService };