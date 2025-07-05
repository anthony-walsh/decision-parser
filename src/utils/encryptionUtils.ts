/**
 * Shared Encryption Utilities
 * 
 * Common encryption functions used by both main thread and worker contexts
 * to eliminate code duplication and ensure consistent implementation.
 * 
 * AIDEV-NOTE: Extracted from EncryptionService to resolve DRY violations
 */

// Encryption configuration constants
export const ENCRYPTION_CONFIG = {
  algorithm: 'AES-GCM' as const,
  keyLength: 256,
  ivLength: 12, // 96 bits for GCM
  pbkdf2Iterations: 600000,
  saltLength: 32, // 256 bits
  version: '1.0'
} as const;

// Type definitions for encrypted data structures
export interface EncryptedBatch {
  version: string;
  algorithm: string;
  iv: string; // Base64 encoded
  data: string; // Base64 encoded
  checksum: string;
  metadata: {
    batchId: string;
    documentCount: number;
    originalSize: number;
    compressedSize: number;
    encryptedSize: number;
  };
}

export interface BatchData {
  batchId?: string;
  documents?: Array<{
    id: string;
    filename: string;
    content: string;
    metadata: Record<string, any>;
  }>;
  [key: string]: any;
}

/**
 * Generate cryptographically secure random bytes
 */
export function generateRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

/**
 * Convert ArrayBuffer to Base64 string
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
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
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Calculate SHA-256 checksum for integrity verification
 */
export async function calculateChecksum(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate encrypted batch structure
 */
export function validateEncryptedBatch(encryptedBatch: any): asserts encryptedBatch is EncryptedBatch {
  if (!encryptedBatch || typeof encryptedBatch !== 'object') {
    throw new Error('Invalid encrypted batch: not an object');
  }

  const requiredFields = ['version', 'algorithm', 'iv', 'data', 'checksum'];
  for (const field of requiredFields) {
    if (!(field in encryptedBatch)) {
      throw new Error(`Invalid encrypted batch: missing ${field}`);
    }
  }

  if (encryptedBatch.algorithm !== ENCRYPTION_CONFIG.algorithm) {
    throw new Error(`Unsupported encryption algorithm: ${encryptedBatch.algorithm}`);
  }

  if (encryptedBatch.version !== ENCRYPTION_CONFIG.version) {
    throw new Error(`Unsupported batch version: ${encryptedBatch.version}`);
  }
}

/**
 * Derive encryption key from password using PBKDF2
 * AIDEV-NOTE: Enhanced with secure memory cleanup
 */
export async function deriveKeyFromPassword(
  password: string, 
  salt: Uint8Array,
  extractable: boolean = false
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  
  try {
    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );
    
    // Derive AES-GCM key
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: ENCRYPTION_CONFIG.pbkdf2Iterations,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: ENCRYPTION_CONFIG.algorithm, length: ENCRYPTION_CONFIG.keyLength },
      extractable,
      ['encrypt', 'decrypt']
    );
    
    return key;
  } finally {
    // Security improvement - clear password from memory
    if (passwordBuffer && passwordBuffer.fill) {
      passwordBuffer.fill(0);
    }
  }
}

/**
 * Compress data using browser's compression API with fallback
 */
export async function compressData(text: string): Promise<ArrayBuffer> {
  if (!globalThis.CompressionStream) {
    // Fallback: return text as ArrayBuffer if compression not available
    return new TextEncoder().encode(text).buffer;
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
    const chunks: Uint8Array[] = [];
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
    return new TextEncoder().encode(text).buffer;
  }
}

/**
 * Decompress data using browser's decompression API with fallback
 */
export async function decompressData(compressedData: ArrayBuffer): Promise<string> {
  if (!globalThis.DecompressionStream) {
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
    const chunks: Uint8Array[] = [];
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
 * Securely clear sensitive data from memory
 */
export function clearBuffer(buffer: Uint8Array | null | undefined): void {
  if (buffer && buffer.fill) {
    buffer.fill(0);
  }
}