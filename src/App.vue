<template>
  <div id="app">
    <!-- Authentication Setup Modal/Overlay -->
    <AuthenticationSetup 
      v-if="shouldShowAuthentication"
      :is-setup="authenticationIsSetup"
      @authentication-complete="handleAuthenticationComplete"
      @skip-cold-storage="handleSkipColdStorage"
      @reset-password="handlePasswordReset"
    />
    
    <!-- Main Application -->
    <router-view v-else />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { SearchEngine } from '@/utils/searchEngine';
import { authService } from '@/services/AuthenticationService.js';
import { useStorageStore } from '@/stores';
import AuthenticationSetup from '@/components/AuthenticationSetup.vue';

// Store
const store = useStorageStore();

// Search engine state
let searchEngine: SearchEngine | null = null;
const initializationError = ref<string | null>(null);
const isInitializing = ref(true);

// Authentication state
const showAuthenticationSetup = ref(false);
const authenticationIsSetup = ref(false);
const isAuthenticated = ref(false);

// AIDEV-NOTE: Check if authentication setup is needed
const shouldShowAuthentication = computed(() => {
  // For now, only show authentication when explicitly requested
  // This allows users to use the app without cold storage if they prefer
  return showAuthenticationSetup.value;
});

onMounted(async () => {
  // AIDEV-NOTE: Initialize authentication state first
  try {
    const authState = authService.getAuthState();
    authenticationIsSetup.value = authState.hasChallenge;
    isAuthenticated.value = authState.isAuthenticated;
    
    console.log('[App] Authentication state:', authState);
    
    // Update store with authentication state
    await store.auth.setInitialized(authState.isInitialized);
    await store.auth.setAuthenticated(authState.isAuthenticated);
  } catch (error) {
    console.error('[App] Failed to initialize authentication:', error);
  }
  
  // Initialize search engine
  try {
    searchEngine = new SearchEngine();
    await searchEngine.initialize();
    
    // Make search engine available globally
    if (typeof window !== 'undefined') {
      window.searchEngine = searchEngine;
      window.searchEngineStatus = {
        initialized: true,
        error: null,
        isInitializing: false
      };
      
    }
    isInitializing.value = false;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown initialization error';
    
    initializationError.value = errorMessage;
    isInitializing.value = false;
    
    // Make error status available globally
    if (typeof window !== 'undefined') {
      window.searchEngine = null;
      window.searchEngineStatus = {
        initialized: false,
        error: errorMessage,
        isInitializing: false
      };
    }
  }
});

// AIDEV-NOTE: Authentication event handlers
async function handleAuthenticationComplete(success: boolean) {
  console.log('[App] Authentication completed:', success);
  
  if (success) {
    isAuthenticated.value = true;
    showAuthenticationSetup.value = false;
    
    // Update store state
    await store.auth.setAuthenticated(true);
    
    // Authenticate cold storage if available
    try {
      console.log('[App] Starting cold storage authentication...');
      const password = await authService.getUserPassword();
      console.log('[App] Password retrieved successfully for cold storage authentication');
      
      await store.coldStorage.authenticateWithPassword(password);
      console.log('[App] Cold storage authenticated successfully');
      
      // Verify authentication worked
      const authState = store.state.coldStorage.isAuthenticated;
      console.log('[App] Cold storage authentication state:', authState);
    } catch (error) {
      console.error('[App] Failed to authenticate cold storage:', error);
      console.error('[App] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        authServiceState: authService.getAuthState()
      });
    }
  }
}

function handleSkipColdStorage() {
  console.log('[App] User chose to skip cold storage');
  showAuthenticationSetup.value = false;
  // User can continue with local storage only
}

async function handlePasswordReset() {
  console.log('[App] Password reset initiated');
  
  try {
    // Reset authentication state
    isAuthenticated.value = false;
    authenticationIsSetup.value = false;
    showAuthenticationSetup.value = false;
    
    // Update store state
    await store.auth.setAuthenticated(false);
    await store.auth.setInitialized(false);
    
    console.log('[App] Password reset completed');
  } catch (error) {
    console.error('[App] Failed to complete password reset:', error);
  }
}

// AIDEV-NOTE: Global function to show authentication (called from other components)
function showAuthentication(forSetup = false) {
  authenticationIsSetup.value = forSetup;
  showAuthenticationSetup.value = true;
}

// Make authentication functions available globally
declare global {
  interface Window {
    showAuthentication: (forSetup?: boolean) => void;
  }
}

if (typeof window !== 'undefined') {
  window.showAuthentication = showAuthentication;
}

// Make search engine available globally
declare global {
  interface Window {
    searchEngine: SearchEngine | null;
    searchEngineStatus: {
      initialized: boolean;
      error: string | null;
      isInitializing: boolean;
    };
  }
}
</script>