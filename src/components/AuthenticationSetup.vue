<template>
  <!-- AIDEV-NOTE: Authentication Setup Component for Cold Storage Password Management -->
  <div class="min-h-screen bg-gray-900 text-white flex items-center justify-center px-4">
    <div class="max-w-md w-full space-y-6">
      <!-- Header -->
      <div class="text-center">
        <div class="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-full mb-4">
          <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
          </svg>
        </div>
        <h1 class="text-2xl font-bold text-gray-100 mb-2">
          {{ isAuthenticatedSetup ? 'Authentication Required' : 'Security Setup' }}
        </h1>
        <p class="text-gray-400">
          {{ isAuthenticatedSetup 
            ? 'Enter your password to access encrypted document archive' 
            : 'Create a password to secure your document archive'
          }}
        </p>
      </div>

      <!-- Authentication Form -->
      <div class="bg-gray-800 rounded-xl shadow-2xl border border-gray-700 p-6">
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <!-- Password Input -->
          <div>
            <label for="password" class="block text-sm font-medium text-gray-300 mb-2">
              {{ isAuthenticatedSetup ? 'Password' : 'Create Password' }}
            </label>
            <div class="relative">
              <input
                id="password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                :placeholder="isAuthenticatedSetup ? 'Enter your password' : 'Choose a secure password'"
                class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-400"
                required
                :minlength="isAuthenticatedSetup ? 1 : 12"
              />
              <button
                type="button"
                @click="togglePasswordVisibility"
                class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-200"
              >
                <svg v-if="showPassword" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"></path>
                </svg>
                <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                </svg>
              </button>
            </div>
          </div>

          <!-- Confirm Password (Setup only) -->
          <div v-if="!isAuthenticatedSetup">
            <label for="confirmPassword" class="block text-sm font-medium text-gray-300 mb-2">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              v-model="confirmPassword"
              :type="showPassword ? 'text' : 'password'"
              placeholder="Confirm your password"
              class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-400"
              required
              minlength="12"
            />
            <p v-if="!isAuthenticatedSetup && password && confirmPassword && password !== confirmPassword" class="text-red-400 text-xs mt-1">
              Passwords do not match
            </p>
          </div>

          <!-- Security Requirements (Setup only) -->
          <div v-if="!isAuthenticatedSetup" class="bg-blue-900/20 border border-blue-800/30 rounded-lg p-3">
            <h4 class="text-sm font-medium text-blue-300 mb-2">Password Requirements</h4>
            <ul class="text-xs text-blue-200 space-y-1">
              <li class="flex items-center">
                <span :class="password.length >= 12 ? 'text-green-400' : 'text-gray-400'" class="mr-2">•</span>
                At least 12 characters long
              </li>
              <li class="flex items-center">
                <span :class="/[A-Z]/.test(password) ? 'text-green-400' : 'text-gray-400'" class="mr-2">•</span>
                Contains uppercase letter
              </li>
              <li class="flex items-center">
                <span :class="/[a-z]/.test(password) ? 'text-green-400' : 'text-gray-400'" class="mr-2">•</span>
                Contains lowercase letter  
              </li>
              <li class="flex items-center">
                <span :class="/[0-9]/.test(password) ? 'text-green-400' : 'text-gray-400'" class="mr-2">•</span>
                Contains number
              </li>
              <li class="flex items-center">
                <span :class="/[^A-Za-z0-9]/.test(password) ? 'text-green-400' : 'text-gray-400'" class="mr-2">•</span>
                Contains special character
              </li>
            </ul>
          </div>

          <!-- Error Message -->
          <div v-if="error" class="bg-red-900/20 border border-red-800/30 rounded-lg p-3">
            <div class="flex items-center">
              <svg class="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <p class="text-red-300 text-sm">{{ error }}</p>
            </div>
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            :disabled="isLoading || (!isAuthenticatedSetup && (!isPasswordValid || password !== confirmPassword))"
            class="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-lg hover:from-blue-600 hover:to-cyan-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 focus:ring-offset-gray-800 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
          >
            <div v-if="isLoading" class="flex items-center justify-center">
              <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              {{ isAuthenticatedSetup ? 'Authenticating...' : 'Creating Security...' }}
            </div>
            <span v-else>
              {{ isAuthenticatedSetup ? 'Unlock Archive' : 'Setup Security' }}
            </span>
          </button>
        </form>

        <!-- Additional Actions -->
        <div class="mt-4 pt-4 border-t border-gray-700">
          <div v-if="isAuthenticatedSetup" class="flex justify-between items-center">
            <button
              @click="skipColdStorage"
              class="text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              Skip archive access
            </button>
            <button
              @click="showResetConfirmation = true"
              class="text-sm text-red-400 hover:text-red-300 transition-colors"
            >
              Reset password
            </button>
          </div>
          <div v-else class="text-center">
            <p class="text-xs text-gray-500">
              Password encrypts your document archive. Lost passwords cannot be recovered.
            </p>
          </div>
        </div>
      </div>

      <!-- Security Features Info -->
      <div class="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
        <h4 class="text-sm font-medium text-gray-300 mb-2 flex items-center">
          <svg class="w-4 h-4 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
          </svg>
          Security Features
        </h4>
        <ul class="text-xs text-gray-400 space-y-1">
          <li>• AES-256-GCM encryption for all archived documents</li>
          <li>• PBKDF2 key derivation with 600,000 iterations</li>
          <li>• No passwords stored - challenge-response authentication</li>
          <li>• Secure key management between browser and workers</li>
        </ul>
      </div>
    </div>

    <!-- Reset Confirmation Modal -->
    <div v-if="showResetConfirmation" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-gray-800 rounded-xl max-w-md w-full mx-4 shadow-2xl border border-gray-700">
        <div class="p-6">
          <div class="flex items-center mb-4">
            <div class="w-12 h-12 bg-red-900/20 rounded-full flex items-center justify-center mr-4">
              <svg class="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <h3 class="text-lg font-semibold text-white">Reset Password</h3>
          </div>
          
          <p class="text-gray-300 mb-4">
            Resetting your password will permanently delete all encrypted documents in cold storage. 
            This action cannot be undone.
          </p>
          
          <div class="bg-red-900/20 border border-red-800/30 rounded-lg p-3 mb-4">
            <p class="text-red-300 text-sm font-medium">Data Loss Warning:</p>
            <ul class="text-red-200 text-xs mt-1 space-y-1">
              <li>• All archived documents will be permanently deleted</li>
              <li>• Recent documents in hot storage will be preserved</li>
              <li>• You will need to re-upload archived documents</li>
            </ul>
          </div>
          
          <div class="flex space-x-3">
            <button
              @click="showResetConfirmation = false"
              class="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500/50 transition-colors"
            >
              Cancel
            </button>
            <button
              @click="confirmReset"
              class="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-colors"
            >
              Reset & Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useStorageStore } from '@/stores';
import { authService } from '@/services/AuthenticationService.js';

// Component props
interface Props {
  isSetup?: boolean; // true if password already exists, false for initial setup
}

const props = withDefaults(defineProps<Props>(), {
  isSetup: false
});

// Emits
const emit = defineEmits<{
  authenticationComplete: [success: boolean];
  skipColdStorage: [];
  resetPassword: [];
}>();

// Store
const store = useStorageStore();

// Form state
const password = ref('');
const confirmPassword = ref('');
const showPassword = ref(false);
const isLoading = ref(false);
const error = ref('');
const showResetConfirmation = ref(false);

// AIDEV-NOTE: Determine setup mode based on authentication service state
const isAuthenticatedSetup = computed(() => {
  // Check if authentication challenge exists (means password is already set up)
  const authState = authService.getAuthState();
  return props.isSetup || authState.hasChallenge;
});

// Password validation
const isPasswordValid = computed(() => {
  if (isAuthenticatedSetup.value) return password.value.length > 0; // Existing password just needs to be entered
  
  // New password requirements - updated to match AuthenticationService requirements
  return password.value.length >= 12 &&
         /[A-Z]/.test(password.value) &&
         /[a-z]/.test(password.value) &&
         /[0-9]/.test(password.value) &&
         /[^A-Za-z0-9]/.test(password.value);
});

// AIDEV-NOTE: Initialize component based on authentication state
onMounted(async () => {
  try {
    // Check if authentication is already set up by checking for stored challenge
    const authState = authService.getAuthState();
    console.log('[AuthenticationSetup] Component mounted, auth state:', authState);
    
    if (!authState.isInitialized && !authState.hasChallenge) {
      console.log('[AuthenticationSetup] No authentication setup found, component in setup mode');
    }
    
    // Initialize store authentication state based on service state
    if (!store.state.authentication.isInitialized) {
      await store.auth.setInitialized(authState.isInitialized);
      await store.auth.setAuthenticated(authState.isAuthenticated);
    }
  } catch (authError) {
    console.error('Failed to initialize authentication:', authError);
    error.value = 'Failed to initialize authentication system';
  }
});

// Form submission handler
async function handleSubmit() {
  if (isLoading.value) return;
  
  error.value = '';
  isLoading.value = true;
  
  try {
    if (isAuthenticatedSetup.value) {
      // Authenticate with existing password
      console.log('[AuthenticationSetup] Attempting authentication with existing password');
      const success = await authService.verifyPassword(password.value);
      
      if (success) {
        console.log('[AuthenticationSetup] Authentication successful');
        await store.auth.setAuthenticated(true);
        emit('authenticationComplete', true);
      } else {
        console.log('[AuthenticationSetup] Authentication failed - invalid password');
        error.value = 'Invalid password. Please try again.';
      }
    } else {
      // Setup new password
      if (password.value !== confirmPassword.value) {
        error.value = 'Passwords do not match.';
        return;
      }
      
      if (!isPasswordValid.value) {
        error.value = 'Password does not meet security requirements.';
        return;
      }
      
      console.log('[AuthenticationSetup] Setting up new password authentication');
      const success = await authService.setupPassword(password.value);
      
      if (success) {
        console.log('[AuthenticationSetup] Password setup successful');
        await store.auth.setAuthenticated(true);
        await store.auth.setInitialized(true);
        emit('authenticationComplete', true);
      } else {
        console.log('[AuthenticationSetup] Password setup failed');
        error.value = 'Failed to setup authentication. Please try again.';
      }
    }
  } catch (err) {
    console.error('Authentication error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Authentication failed. Please try again.';
    error.value = errorMessage;
    console.log('[AuthenticationSetup] Authentication error:', errorMessage);
  } finally {
    isLoading.value = false;
  }
}

// Toggle password visibility
function togglePasswordVisibility() {
  showPassword.value = !showPassword.value;
}

// Skip cold storage access
function skipColdStorage() {
  emit('skipColdStorage');
}

// Confirm password reset
async function confirmReset() {
  isLoading.value = true;
  try {
    console.log('[AuthenticationSetup] Performing password reset and data cleanup');
    
    // Reset authentication using the service (clears all data)
    await authService.resetPassword();
    
    // Update store state
    await store.auth.setAuthenticated(false);
    await store.auth.setInitialized(false);
    
    console.log('[AuthenticationSetup] Password reset completed successfully');
    emit('resetPassword');
  } catch (err) {
    console.error('Reset failed:', err);
    const errorMessage = err instanceof Error ? err.message : 'Failed to reset password. Please try again.';
    error.value = errorMessage;
    console.log('[AuthenticationSetup] Password reset error:', errorMessage);
  } finally {
    isLoading.value = false;
    showResetConfirmation.value = false;
  }
}
</script>