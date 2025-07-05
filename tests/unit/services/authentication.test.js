/**
 * Authentication Service Tests
 * 
 * Comprehensive testing of the challenge-response authentication system
 * AIDEV-NOTE: Critical security testing for offline password verification
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AuthenticationService } from '../../../src/services/AuthenticationService.js'

describe('AuthenticationService', () => {
  let authService
  let mockCrypto

  beforeEach(() => {
    // Reset authentication service state
    authService = new AuthenticationService()
    
    // Enhanced crypto mock for authentication testing
    mockCrypto = {
      getRandomValues: vi.fn((arr) => {
        // Predictable values for testing
        for (let i = 0; i < arr.length; i++) {
          arr[i] = i % 256
        }
        return arr
      }),
      subtle: {
        importKey: vi.fn(() => Promise.resolve('mock-key')),
        exportKey: vi.fn(() => Promise.resolve('mock-exported-key')),
        deriveKey: vi.fn(() => Promise.resolve('mock-derived-key')),
        encrypt: vi.fn(() => Promise.resolve({
          ciphertext: new ArrayBuffer(32),
          iv: new ArrayBuffer(12),
          tag: new ArrayBuffer(16)
        })),
        decrypt: vi.fn(() => Promise.resolve(new ArrayBuffer(32))),
        digest: vi.fn(() => Promise.resolve(new ArrayBuffer(32)))
      }
    }
    
    // Replace global crypto
    global.crypto = mockCrypto
    Object.defineProperty(window, 'crypto', { value: mockCrypto })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Password Setup', () => {
    it('should initialize with no password set', () => {
      expect(authService.isPasswordSet()).toBe(false)
      expect(authService.isAuthenticated()).toBe(false)
    })

    it('should set up password with proper key derivation', async () => {
      const password = 'test-password-123'
      const result = await authService.setupPassword(password)

      expect(result.success).toBe(true)
      expect(result.challengeData).toBeDefined()
      expect(mockCrypto.subtle.deriveKey).toHaveBeenCalled()
      expect(mockCrypto.subtle.encrypt).toHaveBeenCalled()
    })

    it('should generate unique challenge data for each setup', async () => {
      const password = 'test-password'
      
      const result1 = await authService.setupPassword(password)
      await authService.resetPassword()
      const result2 = await authService.setupPassword(password)

      expect(result1.challengeData).not.toEqual(result2.challengeData)
    })

    it('should reject weak passwords', async () => {
      const weakPasswords = ['', '123', 'password', 'abc']
      
      for (const weakPassword of weakPasswords) {
        const result = await authService.setupPassword(weakPassword)
        expect(result.success).toBe(false)
        expect(result.error).toContain('password requirements')
      }
    })

    it('should enforce minimum password length', async () => {
      const shortPassword = '1234567' // 7 characters
      const result = await authService.setupPassword(shortPassword)

      expect(result.success).toBe(false)
      expect(result.error).toContain('8 characters')
    })

    it('should require password complexity', async () => {
      const simplePassword = 'password123' // No special chars or uppercase
      const result = await authService.setupPassword(simplePassword)

      expect(result.success).toBe(false)
      expect(result.error).toContain('complexity')
    })
  })

  describe('Challenge-Response Authentication', () => {
    beforeEach(async () => {
      // Set up a password for testing authentication
      await authService.setupPassword('TestPassword123!')
    })

    it('should authenticate with correct password', async () => {
      const result = await authService.authenticate('TestPassword123!')

      expect(result.success).toBe(true)
      expect(result.keyMaterial).toBeDefined()
      expect(authService.isAuthenticated()).toBe(true)
    })

    it('should reject incorrect password', async () => {
      const result = await authService.authenticate('WrongPassword123!')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid password')
      expect(authService.isAuthenticated()).toBe(false)
    })

    it('should handle authentication attempts with no password set', async () => {
      await authService.resetPassword()
      const result = await authService.authenticate('AnyPassword123!')

      expect(result.success).toBe(false)
      expect(result.error).toContain('No password configured')
    })

    it('should clear authentication state on logout', async () => {
      await authService.authenticate('TestPassword123!')
      expect(authService.isAuthenticated()).toBe(true)

      await authService.logout()
      expect(authService.isAuthenticated()).toBe(false)
    })

    it('should prevent multiple simultaneous authentication attempts', async () => {
      const password = 'TestPassword123!'
      
      // Start multiple authentication attempts
      const attempts = [
        authService.authenticate(password),
        authService.authenticate(password),
        authService.authenticate(password)
      ]

      const results = await Promise.all(attempts)
      
      // Only one should succeed, others should be rejected or queued
      const successCount = results.filter(r => r.success).length
      expect(successCount).toBeLessThanOrEqual(1)
    })
  })

  describe('Key Export/Import for Workers', () => {
    beforeEach(async () => {
      await authService.setupPassword('TestPassword123!')
      await authService.authenticate('TestPassword123!')
    })

    it('should export key material for workers', async () => {
      const keyMaterial = await authService.exportKeyForWorker()

      expect(keyMaterial).toBeDefined()
      expect(keyMaterial.key).toBeDefined()
      expect(keyMaterial.salt).toBeDefined()
      expect(mockCrypto.subtle.exportKey).toHaveBeenCalled()
    })

    it('should not export key material when not authenticated', async () => {
      await authService.logout()
      
      await expect(authService.exportKeyForWorker()).rejects.toThrow('Not authenticated')
    })

    it('should validate key material structure', async () => {
      const keyMaterial = await authService.exportKeyForWorker()

      expect(keyMaterial).toHaveProperty('key')
      expect(keyMaterial).toHaveProperty('salt')
      expect(keyMaterial).toHaveProperty('algorithm')
      expect(keyMaterial).toHaveProperty('iterations')
      expect(keyMaterial.algorithm).toBe('PBKDF2')
      expect(keyMaterial.iterations).toBe(600000)
    })

    it('should import key material in worker context', async () => {
      const exportedKey = await authService.exportKeyForWorker()
      const importedKey = await authService.importKeyFromMain(exportedKey)

      expect(importedKey).toBeDefined()
      expect(mockCrypto.subtle.importKey).toHaveBeenCalled()
    })
  })

  describe('Security Features', () => {
    it('should clear sensitive data from memory', async () => {
      await authService.setupPassword('TestPassword123!')
      await authService.authenticate('TestPassword123!')

      // Spy on the cleanup method
      const cleanupSpy = vi.spyOn(authService, '_clearSensitiveData')
      
      await authService.logout()
      expect(cleanupSpy).toHaveBeenCalled()
    })

    it('should not store plaintext passwords', async () => {
      const password = 'TestPassword123!'
      await authService.setupPassword(password)

      // Check that password is not stored anywhere
      const serviceState = JSON.stringify(authService)
      expect(serviceState).not.toContain(password)
    })

    it('should not store derived keys in localStorage', async () => {
      await authService.setupPassword('TestPassword123!')
      await authService.authenticate('TestPassword123!')

      // Check localStorage is not used for sensitive data
      expect(localStorage.setItem).not.toHaveBeenCalledWith(
        expect.stringMatching(/key|password|secret/i),
        expect.anything()
      )
    })

    it('should implement rate limiting for authentication attempts', async () => {
      await authService.setupPassword('TestPassword123!')

      // Make multiple failed attempts
      const failedAttempts = Array(10).fill().map(() => 
        authService.authenticate('WrongPassword')
      )

      const results = await Promise.all(failedAttempts)
      const lastResult = results[results.length - 1]

      // Should be rate limited after multiple failures
      expect(lastResult.success).toBe(false)
      expect(lastResult.error).toContain('rate limit' || 'too many attempts')
    })
  })

  describe('Password Reset', () => {
    beforeEach(async () => {
      await authService.setupPassword('TestPassword123!')
      await authService.authenticate('TestPassword123!')
    })

    it('should reset password and clear all data', async () => {
      const resetResult = await authService.resetPassword()

      expect(resetResult.success).toBe(true)
      expect(authService.isPasswordSet()).toBe(false)
      expect(authService.isAuthenticated()).toBe(false)
    })

    it('should allow new password setup after reset', async () => {
      await authService.resetPassword()
      const setupResult = await authService.setupPassword('NewPassword456!')

      expect(setupResult.success).toBe(true)
      expect(authService.isPasswordSet()).toBe(true)
    })

    it('should warn about data loss on reset', async () => {
      const resetResult = await authService.resetPassword()

      expect(resetResult.warning).toContain('data will be lost')
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle crypto API failures gracefully', async () => {
      // Mock crypto failure
      mockCrypto.subtle.deriveKey = vi.fn(() => Promise.reject(new Error('Crypto failed')))

      const result = await authService.setupPassword('TestPassword123!')
      expect(result.success).toBe(false)
      expect(result.error).toContain('setup failed')
    })

    it('should handle corrupted challenge data', async () => {
      await authService.setupPassword('TestPassword123!')
      
      // Corrupt the challenge data
      authService._corruptChallengeData()
      
      const result = await authService.authenticate('TestPassword123!')
      expect(result.success).toBe(false)
      expect(result.error).toContain('corrupted' || 'invalid')
    })

    it('should validate challenge data format', async () => {
      const invalidChallengeData = {
        // Missing required fields
        invalidField: 'test'
      }

      const isValid = authService._validateChallengeData(invalidChallengeData)
      expect(isValid).toBe(false)
    })

    it('should handle browser compatibility issues', async () => {
      // Mock missing crypto.subtle
      delete global.crypto.subtle

      const result = await authService.setupPassword('TestPassword123!')
      expect(result.success).toBe(false)
      expect(result.error).toContain('not supported')
    })

    it('should handle memory pressure during authentication', async () => {
      // Mock memory pressure
      const originalMemory = global.performance.memory
      global.performance.memory = { usedJSHeapSize: 500 * 1024 * 1024 } // 500MB

      await authService.setupPassword('TestPassword123!')
      const result = await authService.authenticate('TestPassword123!')

      expect(result.success).toBe(true) // Should still work
      
      // Cleanup
      global.performance.memory = originalMemory
    })
  })

  describe('Session Management', () => {
    beforeEach(async () => {
      await authService.setupPassword('TestPassword123!')
    })

    it('should maintain authentication state during session', async () => {
      await authService.authenticate('TestPassword123!')
      
      expect(authService.isAuthenticated()).toBe(true)
      expect(authService.getSessionDuration()).toBeGreaterThan(0)
    })

    it('should handle session timeout', async () => {
      await authService.authenticate('TestPassword123!')
      
      // Mock session timeout
      authService._mockSessionExpiry()
      
      expect(authService.isAuthenticated()).toBe(false)
    })

    it('should extend session on activity', async () => {
      await authService.authenticate('TestPassword123!')
      const initialExpiry = authService.getSessionExpiry()
      
      await authService.extendSession()
      const newExpiry = authService.getSessionExpiry()
      
      expect(newExpiry).toBeGreaterThan(initialExpiry)
    })
  })
})