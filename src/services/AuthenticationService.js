/**
 * Challenge-Response Authentication Service
 * 
 * Implements password verification without storing passwords by using
 * encrypted challenges that can only be decrypted with the correct key.
 */

export class AuthenticationService {
  constructor() {
    this.isAuthenticated = false;
    this.encryptionKey = null;
    this.keyDerivationSalt = null;
  }

  /**
   * Check if password setup is needed (first time use)
   */
  needsPasswordSetup() {
    return !localStorage.getItem('authChallenge');
  }

  /**
   * Set up password authentication on first use
   */
  async setupPassword(password) {
    if (!this.validatePasswordStrength(password)) {
      throw new Error('Password does not meet strength requirements');
    }

    try {
      // Generate salt for key derivation
      this.keyDerivationSalt = crypto.getRandomValues(new Uint8Array(32));
      
      // Derive encryption key from password
      const key = await this.deriveKeyFromPassword(password, this.keyDerivationSalt);
      
      // Create challenge data
      const challenge = await this.createAuthChallenge(key);
      
      // Store challenge and salt
      localStorage.setItem('authChallenge', JSON.stringify(challenge));
      localStorage.setItem('keyDerivationSalt', Array.from(this.keyDerivationSalt).join(','));
      
      // Set authenticated state
      this.isAuthenticated = true;
      this.encryptionKey = key;
      
      return true;
    } catch (error) {
      console.error('Password setup failed:', error);
      throw new Error('Failed to setup password authentication');
    }
  }

  /**
   * Verify password using challenge-response
   */
  async verifyPassword(password) {
    try {
      // Get stored challenge and salt
      const challengeData = localStorage.getItem('authChallenge');
      const saltData = localStorage.getItem('keyDerivationSalt');
      
      if (!challengeData || !saltData) {
        throw new Error('No authentication challenge found');
      }

      // Parse stored data
      const challenge = JSON.parse(challengeData);
      const salt = new Uint8Array(saltData.split(',').map(Number));
      
      // Derive key from password
      const key = await this.deriveKeyFromPassword(password, salt);
      
      // Attempt to decrypt challenge
      const isValid = await this.validateChallenge(key, challenge);
      
      if (isValid) {
        this.isAuthenticated = true;
        this.encryptionKey = key;
        this.keyDerivationSalt = salt;
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error('Password verification failed:', error);
      return false;
    }
  }

  /**
   * Reset password and clear all data
   */
  async resetPassword() {
    try {
      // Clear all authentication data
      localStorage.removeItem('authChallenge');
      localStorage.removeItem('keyDerivationSalt');
      
      // Clear application data (documents, search history, etc.)
      // This will be expanded when we integrate with storage services
      const databases = ['PDFSearchDatabase']; // Add other DB names as needed
      
      for (const dbName of databases) {
        try {
          await this.clearIndexedDB(dbName);
        } catch (error) {
          console.warn(`Failed to clear database ${dbName}:`, error);
        }
      }
      
      // Reset state
      this.isAuthenticated = false;
      this.encryptionKey = null;
      this.keyDerivationSalt = null;
      
      return true;
    } catch (error) {
      console.error('Password reset failed:', error);
      throw new Error('Failed to reset password and clear data');
    }
  }

  /**
   * Get encryption key for workers (export as raw bytes)
   */
  async getKeyMaterialForWorker() {
    if (!this.isAuthenticated || !this.encryptionKey) {
      throw new Error('Not authenticated');
    }
    
    return await crypto.subtle.exportKey('raw', this.encryptionKey);
  }

  /**
   * Derive encryption key from password using PBKDF2
   */
  async deriveKeyFromPassword(password, salt) {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);
    
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
        iterations: 600000, // OWASP recommended minimum 2024
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    
    return key;
  }

  /**
   * Create encrypted challenge for password verification
   */
  async createAuthChallenge(key) {
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
      salt: Array.from(this.keyDerivationSalt),
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
  async validateChallenge(key, challenge) {
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
  validatePasswordStrength(password) {
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
  async clearIndexedDB(databaseName) {
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
   * Get current authentication state
   */
  getAuthState() {
    return {
      isAuthenticated: this.isAuthenticated,
      isInitialized: !this.needsPasswordSetup(),
      hasChallenge: !!localStorage.getItem('authChallenge')
    };
  }
}

// Singleton instance
export const authService = new AuthenticationService();