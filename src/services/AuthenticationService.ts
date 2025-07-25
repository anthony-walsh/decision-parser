/**
 * Challenge-Response Authentication Service
 * 
 * Implements password verification without storing passwords by using
 * encrypted challenges that can only be decrypted with the correct key.
 * 
 * AIDEV-NOTE: Migrated to TypeScript for improved type safety
 */

interface AuthChallenge {
  version: string;
  salt: number[];
  encrypted: {
    iv: number[];
    data: number[];
  };
  expectedResponse: number[];
}

interface AuthState {
  isAuthenticated: boolean;
  isInitialized: boolean;
  hasChallenge: boolean;
}

export class AuthenticationService {
  private isAuthenticated: boolean;
  private encryptionKey: CryptoKey | null;
  private keyDerivationSalt: Uint8Array | null;

  constructor() {
    this.isAuthenticated = false;
    this.encryptionKey = null;
    this.keyDerivationSalt = null;
    // AIDEV-NOTE: Removed currentPassword storage - security vulnerability fixed
    // Password is no longer stored in memory to prevent exposure via memory dumps
  }

  /**
   * Check if password setup is needed (first time use)
   * AIDEV-NOTE: Enhanced with logging for debugging authentication flow
   */
  needsPasswordSetup(): boolean {
    const hasChallenge = !!localStorage.getItem('authChallenge');
    console.log('[AuthenticationService] Checking password setup need:', { hasChallenge, needsSetup: !hasChallenge });
    return !hasChallenge;
  }

  /**
   * Set up password authentication on first use
   * AIDEV-NOTE: Enhanced with detailed logging for password setup flow
   */
  async setupPassword(password: string): Promise<boolean> {
    console.log('[AuthenticationService] Starting password setup...');
    
    if (!this.validatePasswordStrength(password)) {
      console.error('[AuthenticationService] Password validation failed - insufficient strength');
      throw new Error('Password does not meet strength requirements');
    }
    console.log('[AuthenticationService] Password strength validation passed');

    try {
      console.log('[AuthenticationService] Generating key derivation salt...');
      // Generate salt for key derivation
      this.keyDerivationSalt = crypto.getRandomValues(new Uint8Array(32));
      console.log('[AuthenticationService] Salt generated successfully');
      
      console.log('[AuthenticationService] Deriving encryption key from password...');
      // Derive encryption key from password
      const key = await this.deriveKeyFromPassword(password, this.keyDerivationSalt);
      console.log('[AuthenticationService] Encryption key derived successfully');
      
      console.log('[AuthenticationService] Creating authentication challenge...');
      // Create challenge data
      const challenge = await this.createAuthChallenge(key);
      console.log('[AuthenticationService] Authentication challenge created');
      
      console.log('[AuthenticationService] Storing challenge and salt in localStorage...');
      // Store challenge and salt
      localStorage.setItem('authChallenge', JSON.stringify(challenge));
      localStorage.setItem('keyDerivationSalt', Array.from(this.keyDerivationSalt).join(','));
      console.log('[AuthenticationService] Authentication data stored successfully');
      
      // Set authenticated state
      this.isAuthenticated = true;
      this.encryptionKey = key;
      // AIDEV-NOTE: Password no longer stored - security improvement
      console.log('[AuthenticationService] Password setup completed successfully');
      
      return true;
    } catch (error) {
      console.error('[AuthenticationService] Password setup failed:', error);
      throw new Error('Failed to setup password authentication');
    }
  }

  /**
   * Verify password using challenge-response
   * AIDEV-NOTE: Enhanced with detailed logging for password verification flow
   */
  async verifyPassword(password: string): Promise<boolean> {
    console.log('[AuthenticationService] Starting password verification...');
    
    try {
      console.log('[AuthenticationService] Retrieving stored challenge and salt...');
      // Get stored challenge and salt
      const challengeData = localStorage.getItem('authChallenge');
      const saltData = localStorage.getItem('keyDerivationSalt');
      
      if (!challengeData || !saltData) {
        console.error('[AuthenticationService] Missing authentication data:', { hasChallenge: !!challengeData, hasSalt: !!saltData });
        throw new Error('No authentication challenge found');
      }
      console.log('[AuthenticationService] Authentication data found in localStorage');

      console.log('[AuthenticationService] Parsing stored authentication data...');
      // Parse stored data
      const challenge = JSON.parse(challengeData);
      const salt = new Uint8Array(saltData.split(',').map(Number));
      console.log('[AuthenticationService] Authentication data parsed successfully');
      
      console.log('[AuthenticationService] Deriving key from provided password...');
      // Derive key from password
      const key = await this.deriveKeyFromPassword(password, salt);
      console.log('[AuthenticationService] Key derivation completed');
      
      console.log('[AuthenticationService] Validating challenge with derived key...');
      // Attempt to decrypt challenge
      const isValid = await this.validateChallenge(key, challenge);
      console.log('[AuthenticationService] Challenge validation result:', { isValid });
      
      if (isValid) {
        this.isAuthenticated = true;
        this.encryptionKey = key;
        this.keyDerivationSalt = salt;
        // AIDEV-NOTE: Password no longer stored - security improvement
        console.log('[AuthenticationService] Password verification successful');
        return true;
      } else {
        console.log('[AuthenticationService] Password verification failed - invalid password');
        return false;
      }
    } catch (error) {
      console.error('[AuthenticationService] Password verification failed:', error);
      return false;
    }
  }

  /**
   * Reset password and clear all data
   * AIDEV-NOTE: Enhanced with detailed logging for password reset flow
   */
  async resetPassword(): Promise<boolean> {
    console.log('[AuthenticationService] Starting password reset...');
    
    try {
      console.log('[AuthenticationService] Clearing authentication data from localStorage...');
      // Clear all authentication data
      localStorage.removeItem('authChallenge');
      localStorage.removeItem('keyDerivationSalt');
      console.log('[AuthenticationService] Authentication data cleared from localStorage');
      
      console.log('[AuthenticationService] Clearing application databases...');
      // Clear application data (documents, search history, etc.)
      // This will be expanded when we integrate with storage services
      const databases = ['PDFSearchDatabase']; // Add other DB names as needed
      
      for (const dbName of databases) {
        try {
          console.log(`[AuthenticationService] Clearing database: ${dbName}`);
          await this.clearIndexedDB(dbName);
          console.log(`[AuthenticationService] Database ${dbName} cleared successfully`);
        } catch (error) {
          console.warn(`[AuthenticationService] Failed to clear database ${dbName}:`, error);
        }
      }
      
      console.log('[AuthenticationService] Resetting authentication state...');
      // Reset state
      this.isAuthenticated = false;
      this.encryptionKey = null;
      this.keyDerivationSalt = null;
      console.log('[AuthenticationService] Password reset completed successfully');
      
      return true;
    } catch (error) {
      console.error('[AuthenticationService] Password reset failed:', error);
      console.error('Password reset failed:', error);
      throw new Error('Failed to reset password and clear data');
    }
  }

  /**
   * Get encryption key for workers (export as raw bytes)
   */
  async getKeyMaterialForWorker(): Promise<ArrayBuffer> {
    if (!this.isAuthenticated || !this.encryptionKey) {
      throw new Error('Not authenticated');
    }
    
    return await crypto.subtle.exportKey('raw', this.encryptionKey);
  }

  /**
   * Derive encryption key from password using PBKDF2
   * AIDEV-NOTE: Enhanced with secure memory cleanup
   */
  private async deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
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
      
      // Derive AES-GCM key - AIDEV-NOTE: Made extractable for worker export
      const key = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 600000, // OWASP recommended minimum 2024
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        true, // AIDEV-NOTE: Changed to true to allow export for workers
        ['encrypt', 'decrypt']
      );
      
      return key;
    } finally {
      // AIDEV-NOTE: Security improvement - clear password from memory
      if (passwordBuffer && passwordBuffer.fill) {
        passwordBuffer.fill(0);
      }
    }
  }

  /**
   * Create encrypted challenge for password verification
   */
  private async createAuthChallenge(key: CryptoKey): Promise<AuthChallenge> {
    // Generate random challenge text
    const challengeText = crypto.getRandomValues(new Uint8Array(32));
    
    // Calculate expected response (SHA-256 of challenge)
    const expectedResponse = await crypto.subtle.digest('SHA-256', challengeText);
    
    // Encrypt the challenge text
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encryptedChallenge = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      challengeText
    );
    
    return {
      version: '1.0',
      salt: Array.from(this.keyDerivationSalt!),
      encrypted: {
        iv: Array.from(iv),
        data: Array.from(new Uint8Array(encryptedChallenge))
      },
      expectedResponse: Array.from(new Uint8Array(expectedResponse))
    };
  }

  /**
   * Validate challenge by attempting decryption
   */
  private async validateChallenge(key: CryptoKey, challenge: AuthChallenge): Promise<boolean> {
    try {
      // Decrypt challenge
      const iv = new Uint8Array(challenge.encrypted.iv);
      const encryptedData = new Uint8Array(challenge.encrypted.data);
      
      const decryptedChallenge = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encryptedData
      );
      
      // Calculate response
      const actualResponse = await crypto.subtle.digest('SHA-256', decryptedChallenge);
      const actualResponseArray = Array.from(new Uint8Array(actualResponse));
      
      // Compare with expected response
      const expectedResponse = challenge.expectedResponse;
      
      if (expectedResponse.length !== actualResponseArray.length) {
        return false;
      }
      
      for (let i = 0; i < expectedResponse.length; i++) {
        if (expectedResponse[i] !== actualResponseArray[i]) {
          return false;
        }
      }
      
      return true;
    } catch (error) {
      // Decryption failed = wrong password
      return false;
    }
  }

  /**
   * Validate password strength
   */
  private validatePasswordStrength(password: string): boolean {
    if (!password || typeof password !== 'string') {
      return false;
    }
    
    return password.length >= 12 &&
           /[A-Z]/.test(password) &&
           /[a-z]/.test(password) &&
           /[0-9]/.test(password) &&
           /[^A-Za-z0-9]/.test(password);
  }

  /**
   * Clear IndexedDB database
   */
  private async clearIndexedDB(databaseName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const deleteRequest = indexedDB.deleteDatabase(databaseName);
      
      deleteRequest.onerror = () => reject(deleteRequest.error);
      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onblocked = () => {
        console.warn(`Database ${databaseName} is blocked from deletion`);
        resolve(); // Don't fail the entire reset process
      };
    });
  }

  /**
   * AIDEV-NOTE: Secure key derivation method for cold storage
   * Derives keys without storing password in memory - security improvement
   */
  async deriveKeyForBatch(password: string, batchSalt: Uint8Array): Promise<CryptoKey> {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated');
    }
    
    // Use the same key derivation method but with batch-specific salt
    return await this.deriveKeyFromPassword(password, batchSalt);
  }

  /**
   * Get current authentication state
   */
  getAuthState(): AuthState {
    return {
      isAuthenticated: this.isAuthenticated,
      isInitialized: !this.needsPasswordSetup(),
      hasChallenge: !!localStorage.getItem('authChallenge')
    };
  }
}

// Singleton instance
export const authService = new AuthenticationService();