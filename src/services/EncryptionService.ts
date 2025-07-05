/**
 * EncryptionService - AES-GCM-256 encryption for cold storage
 * 
 * Provides secure encryption/decryption for document batches using:
 * - AES-GCM-256 for encryption with authenticated encryption
 * - PBKDF2 for key derivation (600,000 iterations)
 * - Secure random IV generation
 * - Memory-safe key handling
 * 
 * AIDEV-NOTE: Migrated to TypeScript and uses shared encryption utilities
 */

import {
  ENCRYPTION_CONFIG,
  EncryptedBatch,
  BatchData,
  generateRandomBytes,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  calculateChecksum,
  validateEncryptedBatch,
  deriveKeyFromPassword,
  compressData,
  decompressData,
  clearBuffer
} from '../utils/encryptionUtils.js';

export class EncryptionService {
  private encryptionKey: CryptoKey | null;

  constructor() {
    this.encryptionKey = null;
  }

  // Getter methods for configuration (backwards compatibility)
  get algorithm(): string { return ENCRYPTION_CONFIG.algorithm; }
  get keyLength(): number { return ENCRYPTION_CONFIG.keyLength; }
  get ivLength(): number { return ENCRYPTION_CONFIG.ivLength; }
  get pbkdf2Iterations(): number { return ENCRYPTION_CONFIG.pbkdf2Iterations; }
  get saltLength(): number { return ENCRYPTION_CONFIG.saltLength; }

  /**
   * Derives encryption key from password using PBKDF2
   * AIDEV-NOTE: Now uses shared encryption utilities
   */
  async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    return await deriveKeyFromPassword(password, salt, false);
  }

  /**
   * Initialize with encryption key (from authentication service)
   */
  async initialize(keyMaterial: ArrayBuffer): Promise<void> {
    if (!keyMaterial) {
      throw new Error('No key material provided');
    }

    // Import raw key material as AES-GCM key
    this.encryptionKey = await crypto.subtle.importKey(
      'raw',
      keyMaterial,
      { name: this.algorithm, length: this.keyLength },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Generates cryptographically secure random bytes
   * AIDEV-NOTE: Now uses shared encryption utilities
   */
  generateRandomBytes(length: number): Uint8Array {
    return generateRandomBytes(length);
  }

  /**
   * Check if encryption service is ready
   */
  isInitialized(): boolean {
    return this.encryptionKey !== null;
  }

  /**
   * Encrypt batch data for cold storage
   */
  async encryptBatch(batchData: BatchData): Promise<EncryptedBatch> {
    if (!this.isInitialized()) {
      throw new Error('Encryption service not initialized');
    }

    try {
      // Convert batch data to JSON string
      const plaintext = JSON.stringify(batchData);
      
      // Compress before encryption (optional but recommended)
      const compressed = await compressData(plaintext);
      
      // Generate random IV using secure random bytes
      const iv = generateRandomBytes(this.ivLength);
      
      // Encrypt the compressed data
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        this.encryptionKey!,
        compressed
      );
      
      // Calculate checksum for integrity verification
      const checksum = await calculateChecksum(encrypted);
      
      // Return encrypted batch structure
      return {
        version: ENCRYPTION_CONFIG.version,
        algorithm: this.algorithm,
        iv: arrayBufferToBase64(iv),
        data: arrayBufferToBase64(encrypted),
        checksum: checksum,
        metadata: {
          batchId: batchData.batchId || 'unknown',
          documentCount: batchData.documents ? batchData.documents.length : 0,
          originalSize: plaintext.length,
          compressedSize: compressed.byteLength,
          encryptedSize: encrypted.byteLength
        }
      };
    } catch (error) {
      console.error('Batch encryption failed:', error);
      throw new Error('Failed to encrypt batch data');
    }
  }

  /**
   * Decrypt batch data from cold storage
   */
  async decryptBatch(encryptedBatch: EncryptedBatch): Promise<BatchData> {
    if (!this.isInitialized()) {
      throw new Error('Encryption service not initialized');
    }

    try {
      // Validate encrypted batch structure
      validateEncryptedBatch(encryptedBatch);
      
      // Parse encrypted data
      const iv = base64ToArrayBuffer(encryptedBatch.iv);
      const encryptedData = base64ToArrayBuffer(encryptedBatch.data);
      
      // Verify checksum before decryption
      const calculatedChecksum = await calculateChecksum(encryptedData);
      if (calculatedChecksum !== encryptedBatch.checksum) {
        throw new Error('Checksum verification failed - data may be corrupted');
      }
      
      // Decrypt the data
      const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv) },
        this.encryptionKey!,
        encryptedData
      );
      
      // Decompress the decrypted data
      const decompressed = await decompressData(decryptedData);
      
      // Parse JSON
      const batchData = JSON.parse(decompressed);
      
      return batchData;
    } catch (error) {
      console.error('Batch decryption failed:', error);
      throw new Error('Failed to decrypt batch data - invalid key or corrupted data');
    }
  }

  /**
   * Securely clear encryption key from memory
   */
  clearKey(): void {
    this.encryptionKey = null;
  }

  /**
   * Exports key material for worker communication
   */
  async exportKey(key: CryptoKey): Promise<ArrayBuffer> {
    return await crypto.subtle.exportKey('raw', key);
  }

  /**
   * Imports key material in worker
   * AIDEV-NOTE: Now uses shared encryption utilities
   */
  async importKey(keyMaterial: ArrayBuffer): Promise<CryptoKey> {
    return await crypto.subtle.importKey(
      'raw',
      keyMaterial,
      { name: this.algorithm, length: this.keyLength },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Securely clears sensitive data from memory
   * AIDEV-NOTE: Now uses shared encryption utilities
   */
  clearBuffer(buffer: Uint8Array | null | undefined): void {
    clearBuffer(buffer);
  }

  /**
   * Create test batch for validation
   */
  async createTestBatch(): Promise<BatchData> {
    const testBatch: BatchData = {
      batchId: 'test-001',
      documents: [
        {
          id: 'test-doc-1',
          filename: 'test-document.pdf',
          content: 'This is test content for encryption validation.',
          metadata: {
            pageCount: 1,
            title: 'Test Document'
          }
        }
      ]
    };

    return testBatch;
  }
}

// AIDEV-NOTE: Export singleton instance for consistent usage across application
export const encryptionService = new EncryptionService();