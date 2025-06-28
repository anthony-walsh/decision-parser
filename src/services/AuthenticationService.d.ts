/**
 * TypeScript declarations for AuthenticationService
 */

export interface AuthState {
  isAuthenticated: boolean;
  isInitialized: boolean;
  hasChallenge: boolean;
}

export declare class AuthenticationService {
  constructor();
  
  isAuthenticated: boolean;
  encryptionKey: CryptoKey | null;
  keyDerivationSalt: Uint8Array | null;
  currentPassword: string | null; // AIDEV-NOTE: Added for cold storage authentication
  
  needsPasswordSetup(): boolean;
  setupPassword(password: string): Promise<boolean>;
  verifyPassword(password: string): Promise<boolean>;
  resetPassword(): Promise<boolean>;
  getKeyMaterialForWorker(): Promise<ArrayBuffer>;
  getUserPassword(): string; // AIDEV-NOTE: Added for batch-specific key derivation
  getAuthState(): AuthState;
  
  private deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey>;
  private createAuthChallenge(key: CryptoKey): Promise<any>;
  private validateChallenge(key: CryptoKey, challenge: any): Promise<boolean>;
  private validatePasswordStrength(password: string): boolean;
  private clearIndexedDB(databaseName: string): Promise<void>;
}

export declare const authService: AuthenticationService;