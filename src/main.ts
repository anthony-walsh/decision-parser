import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import UnifiedSearchView from './views/UnifiedSearchView.vue';
import './style.css';

// AIDEV-NOTE: PrimeVue setup for enhanced UI components
import PrimeVue from 'primevue/config';
import Aura from '@primevue/themes/aura';
import StyleClass from 'primevue/styleclass';


// Import worker preload module to ensure workers are included in build
import './workers/index';

// Service provider removed - using DI container directly

// Import DI container and service registry
import { initializeServices } from './services/serviceRegistry';

// Window interface for debugging - serviceProvider removed

const routes = [
  // AIDEV-NOTE: Unified search interface is now the primary route
  { path: '/', name: 'search', component: UnifiedSearchView },
];

const router = createRouter({
  history: createWebHistory('/decision-parser/'),
  routes
});

const app = createApp(App);

// AIDEV-NOTE: Initialize service provider and DI container
async function initializeApplication() {
  try {
    console.log('[Main] Initializing application with dependency injection...');

    // Initialize DI container with all services
    await initializeServices();

    console.log('[Main] DI container initialized successfully');

    // AIDEV-NOTE: Configure PrimeVue in unstyled mode for complete custom styling
    app.use(PrimeVue, {
      theme: {
        preset: Aura,
        options: {
          prefix: 'p',
          darkModeSelector: 'system',
          cssLayer: false
        }
      }
    });
    app.directive('styleclass', StyleClass);
    app.use(router);
    app.mount('#app');

    console.log('[Main] Application initialized successfully');

  } catch (error) {
    console.error('[Main] Application initialization failed:', error);

    // Fall back to basic initialization without new services
    console.warn('[Main] Falling back to legacy mode...');
    app.use(PrimeVue, {
      unstyled: true
    });
    app.use(router);
    app.mount('#app');
  }
}

// Initialize the application
initializeApplication();