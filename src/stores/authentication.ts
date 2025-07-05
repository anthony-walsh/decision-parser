/**
 * Authentication Store Module
 * 
 * Manages authentication state for cold storage access
 * AIDEV-NOTE: Extracted from stores/index.ts for better modularity
 */

import { reactive } from 'vue';

// AIDEV-NOTE: Authentication state interface
export interface AuthenticationState {
  isAuthenticated: boolean;
  isInitialized: boolean;
  hasChallenge: boolean;
}

// AIDEV-NOTE: Reactive authentication state
export const authenticationState = reactive<AuthenticationState>({
  isAuthenticated: false,
  isInitialized: false,
  hasChallenge: false
});

// AIDEV-NOTE: Authentication actions
export const useAuthenticationStore = () => {
  
  const authActions = {
    // AIDEV-NOTE: Initialize authentication service
    async initialize() {
      try {
        // Authentication service initialization logic
        authenticationState.isInitialized = true;
        console.log('[AuthStore] Authentication service initialized');
      } catch (error) {
        console.error('[AuthStore] Authentication initialization failed:', error);
        throw error;
      }
    },

    // AIDEV-NOTE: Set authentication status
    setAuthenticated(isAuthenticated: boolean) {
      authenticationState.isAuthenticated = isAuthenticated;
      console.log(`[AuthStore] Authentication status set to: ${isAuthenticated}`);
    },

    // AIDEV-NOTE: Set challenge status
    setHasChallenge(hasChallenge: boolean) {
      authenticationState.hasChallenge = hasChallenge;
      console.log(`[AuthStore] Challenge status set to: ${hasChallenge}`);
    },

    // AIDEV-NOTE: Set initialized status
    setInitialized(isInitialized: boolean) {
      authenticationState.isInitialized = isInitialized;
      console.log(`[AuthStore] Initialized status set to: ${isInitialized}`);
    },

    // AIDEV-NOTE: Reset authentication state
    reset() {
      authenticationState.isAuthenticated = false;
      authenticationState.hasChallenge = false;
      console.log('[AuthStore] Authentication state reset');
    },

    // AIDEV-NOTE: Get current authentication status
    getStatus() {
      return {
        isAuthenticated: authenticationState.isAuthenticated,
        isInitialized: authenticationState.isInitialized,
        hasChallenge: authenticationState.hasChallenge
      };
    }
  };

  return {
    // State
    state: authenticationState,
    
    // Actions
    ...authActions
  };
};