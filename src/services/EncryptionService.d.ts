/**
 * TypeScript declarations for EncryptionService
 * 
 * AIDEV-NOTE: Type definitions for encryption service
 */

export interface EncryptedBatch {
  version: string;
  algorithm: string;
  iv: string;
  data: string;
  checksum: string;
  salt?: string; // AIDEV-NOTE: Added salt field for batch-specific encryption
  metadata: {
    batchId: string;
    documentCount: number;
    originalSize?: number;
    compressedSize?: number;
    encryptedSize?: number;
    size?: number;
  };
}

export class EncryptionService {
  algorithm: string;
  keyLength: number;
  ivLength: number;
  pbkdf2Iterations: number;
  saltLength: number;

  constructor();

  /**
   * Derives encryption key from password using PBKDF2
   */
  deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey>;

  /**
   * Initialize with encryption key
   */
  initialize(keyMaterial: ArrayBuffer): Promise<void>;

  /**
   * Check if encryption service is ready
   */
  isInitialized(): boolean;

  /**
   * Generates cryptographically secure random bytes
   */
  generateRandomBytes(length: number): Uint8Array;

  /**
   * Encrypt batch data for cold storage
   */
  encryptBatch(batchData: any): Promise<EncryptedBatch>;

  /**
   * Decrypt batch data from cold storage
   */
  decryptBatch(encryptedBatch: EncryptedBatch): Promise<any>;

  /**
   * Exports key material for worker communication
   */
  exportKey(key: CryptoKey): Promise<ArrayBuffer>;

  /**
   * Imports key material in worker
   */
  importKey(keyMaterial: ArrayBuffer): Promise<CryptoKey>;

  /**
   * Securely clears sensitive data from memory
   */
  clearBuffer(buffer: Uint8Array): void;

  /**
   * Securely clear encryption key from memory
   */
  clearKey(): void;

  /**
   * Create test batch for validation
   */
  createTestBatch(): Promise<any>;
}

export declare const encryptionService: EncryptionService;