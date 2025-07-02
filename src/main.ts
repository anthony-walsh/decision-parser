import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import UnifiedSearchView from './views/UnifiedSearchView.vue';
import './style.css';

// Import worker preload module to ensure workers are included in build
import './workers/index';

// Import service provider for gradual migration
import { serviceProvider } from './services/ServiceProvider.js';

// Extend window interface for debugging
declare global {
  interface Window {
    serviceProvider?: any;
  }
}

const routes = [
  // AIDEV-NOTE: Unified search interface is now the primary route
  { path: '/', name: 'search', component: UnifiedSearchView },
];

const router = createRouter({
  history: createWebHistory('/decision-parser/'),
  routes
});

const app = createApp(App);

// AIDEV-NOTE: Initialize service provider for migration strategy
async function initializeApplication() {
  try {
    console.log('[Main] Initializing application with service provider...');
    
    // Initialize service provider with current configuration
    await serviceProvider.initialize();
    
    // Make service provider globally accessible for debugging
    if (typeof window !== 'undefined') {
      window.serviceProvider = serviceProvider;
    }
    
    // Log current system status
    console.log('[Main] System status:', serviceProvider.getSystemStatus());
    
    app.use(router);
    app.mount('#app');
    
    console.log('[Main] Application initialized successfully');
    
  } catch (error) {
    console.error('[Main] Application initialization failed:', error);
    
    // Fall back to basic initialization without new services
    console.warn('[Main] Falling back to legacy mode...');
    app.use(router);
    app.mount('#app');
  }
}

// Initialize the application
initializeApplication();