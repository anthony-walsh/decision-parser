/**
 * EncryptionService - AES-GCM-256 encryption for cold storage
 * 
 * Provides secure encryption/decryption for document batches using:
 * - AES-GCM-256 for encryption with authenticated encryption
 * - PBKDF2 for key derivation (600,000 iterations)
 * - Secure random IV generation
 * - Memory-safe key handling
 * 
 * AIDEV-NOTE: Security-critical component - handles encryption keys and sensitive data
 */

export class EncryptionService {
  constructor() {
    this.algorithm = 'AES-GCM';
    this.keyLength = 256;
    this.ivLength = 12; // 96 bits for GCM
    this.pbkdf2Iterations = 600000;
    this.saltLength = 32; // 256 bits
    this.encryptionKey = null;
  }

  /**
   * Derives encryption key from password using PBKDF2
   * @param {string} password - User password
   * @param {Uint8Array} salt - Random salt (32 bytes)
   * @returns {Promise<CryptoKey>} - Derived encryption key
   */
  async deriveKey(password, salt) {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    // Derive AES-GCM key
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: this.pbkdf2Iterations,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: this.algorithm, length: this.keyLength },
      false, // Not extractable for security
      ['encrypt', 'decrypt']
    );

    // Clear password from memory
    passwordBuffer.fill(0);

    return key;
  }

  /**
   * Initialize with encryption key (from authentication service)
   */
  async initialize(keyMaterial) {
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
   * @param {number} length - Number of bytes to generate
   * @returns {Uint8Array} - Random bytes
   */
  generateRandomBytes(length) {
    return crypto.getRandomValues(new Uint8Array(length));
  }

  /**
   * Check if encryption service is ready
   */
  isInitialized() {
    return this.encryptionKey !== null;
  }

  /**
   * Encrypt batch data for cold storage
   */
  async encryptBatch(batchData) {
    if (!this.isInitialized()) {
      throw new Error('Encryption service not initialized');
    }

    try {
      // Convert batch data to JSON string
      const plaintext = JSON.stringify(batchData);
      
      // Compress before encryption (optional but recommended)
      const compressed = await this.compressData(plaintext);
      
      // Generate random IV using secure random bytes
      const iv = this.generateRandomBytes(this.ivLength);
      
      // Encrypt the compressed data
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        this.encryptionKey,
        compressed
      );
      
      // Calculate checksum for integrity verification
      const checksum = await this.calculateChecksum(encrypted);
      
      // Return encrypted batch structure
      return {
        version: '1.0',
        algorithm: 'AES-GCM',
        iv: this.arrayBufferToBase64(iv),
        data: this.arrayBufferToBase64(encrypted),
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
  async decryptBatch(encryptedBatch) {
    if (!this.isInitialized()) {
      throw new Error('Encryption service not initialized');
    }

    try {
      // Validate encrypted batch structure
      this.validateEncryptedBatch(encryptedBatch);
      
      // Parse encrypted data
      const iv = this.base64ToArrayBuffer(encryptedBatch.iv);
      const encryptedData = this.base64ToArrayBuffer(encryptedBatch.data);
      
      // Verify checksum before decryption
      const calculatedChecksum = await this.calculateChecksum(encryptedData);
      if (calculatedChecksum !== encryptedBatch.checksum) {
        throw new Error('Checksum verification failed - data may be corrupted');
      }
      
      // Decrypt the data
      const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv) },
        this.encryptionKey,
        encryptedData
      );
      
      // Decompress the decrypted data
      const decompressed = await this.decompressData(decryptedData);
      
      // Parse JSON
      const batchData = JSON.parse(decompressed);
      
      return batchData;
    } catch (error) {
      console.error('Batch decryption failed:', error);
      throw new Error('Failed to decrypt batch data - invalid key or corrupted data');
    }
  }

  /**
   * Compress data using browser's compression API
   */
  async compressData(text) {
    if (!window.CompressionStream) {
      // Fallback: return text as ArrayBuffer if compression not available
      return new TextEncoder().encode(text);
    }

    try {
      const stream = new CompressionStream('gzip');
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();
      
      // Write data to compression stream
      const encoder = new TextEncoder();
      await writer.write(encoder.encode(text));
      await writer.close();
      
      // Read compressed data
      const chunks = [];
      let totalSize = 0;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        chunks.push(value);
        totalSize += value.byteLength;
      }
      
      // Combine chunks into single ArrayBuffer
      const compressed = new Uint8Array(totalSize);
      let offset = 0;
      
      for (const chunk of chunks) {
        compressed.set(chunk, offset);
        offset += chunk.byteLength;
      }
      
      return compressed.buffer;
    } catch (error) {
      console.warn('Compression failed, using uncompressed data:', error);
      return new TextEncoder().encode(text);
    }
  }

  /**
   * Decompress data using browser's decompression API
   */
  async decompressData(compressedData) {
    if (!window.DecompressionStream) {
      // Fallback: assume data is uncompressed text
      return new TextDecoder().decode(compressedData);
    }

    try {
      const stream = new DecompressionStream('gzip');
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();
      
      // Write compressed data to decompression stream
      await writer.write(new Uint8Array(compressedData));
      await writer.close();
      
      // Read decompressed data
      const chunks = [];
      let totalSize = 0;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        chunks.push(value);
        totalSize += value.byteLength;
      }
      
      // Combine chunks and decode as text
      const decompressed = new Uint8Array(totalSize);
      let offset = 0;
      
      for (const chunk of chunks) {
        decompressed.set(chunk, offset);
        offset += chunk.byteLength;
      }
      
      return new TextDecoder().decode(decompressed);
    } catch (error) {
      // Fallback: assume data is uncompressed
      console.warn('Decompression failed, treating as uncompressed:', error);
      return new TextDecoder().decode(compressedData);
    }
  }

  /**
   * Calculate SHA-256 checksum for integrity verification
   */
  async calculateChecksum(data) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Validate encrypted batch structure
   */
  validateEncryptedBatch(encryptedBatch) {
    if (!encryptedBatch || typeof encryptedBatch !== 'object') {
      throw new Error('Invalid encrypted batch: not an object');
    }

    const requiredFields = ['version', 'algorithm', 'iv', 'data', 'checksum'];
    for (const field of requiredFields) {
      if (!(field in encryptedBatch)) {
        throw new Error(`Invalid encrypted batch: missing ${field}`);
      }
    }

    if (encryptedBatch.algorithm !== 'AES-GCM') {
      throw new Error(`Unsupported encryption algorithm: ${encryptedBatch.algorithm}`);
    }

    if (encryptedBatch.version !== '1.0') {
      throw new Error(`Unsupported batch version: ${encryptedBatch.version}`);
    }
  }

  /**
   * Convert ArrayBuffer to Base64 string
   */
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert Base64 string to ArrayBuffer
   */
  base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Securely clear encryption key from memory
   */
  clearKey() {
    this.encryptionKey = null;
  }

  /**
   * Exports key material for worker communication
   * @param {CryptoKey} key - Key to export
   * @returns {Promise<ArrayBuffer>} - Raw key material
   */
  async exportKey(key) {
    return await crypto.subtle.exportKey('raw', key);
  }

  /**
   * Imports key material in worker
   * @param {ArrayBuffer} keyMaterial - Raw key material
   * @returns {Promise<CryptoKey>} - Imported key
   */
  async importKey(keyMaterial) {
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
   * @param {Uint8Array} buffer - Buffer to clear
   */
  clearBuffer(buffer) {
    if (buffer && buffer.fill) {
      buffer.fill(0);
    }
  }

  /**
   * Create test batch for validation
   */
  async createTestBatch() {
    const testBatch = {
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