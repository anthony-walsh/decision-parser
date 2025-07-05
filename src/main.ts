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

// AIDEV-NOTE: Initialize service provider and DI container
async function initializeApplication() {
  let router: ReturnType<typeof createRouter>;
  let app: ReturnType<typeof createApp>;
  
  try {
    console.log('[Main] === APPLICATION INITIALIZATION START ===');
    console.log(`[Main] Timestamp: ${new Date().toISOString()}`);

    // Initialize DI container with all services FIRST
    console.log('[Main] STEP 1: Initializing dependency injection services...');
    await initializeServices();

    console.log('[Main] STEP 1 COMPLETE: DI container initialized successfully');

    // Validate critical services are available before proceeding
    console.log('[Main] STEP 2: Validating critical service availability...');
    const { container } = await import('./services/serviceRegistry');
    
    const criticalServices = ['authentication', 'encryption', 'searchHistory', 'logger'];
    const missingServices = criticalServices.filter(service => !container.has(service));
    
    if (missingServices.length > 0) {
      throw new Error(`Critical services missing: ${missingServices.join(', ')}`);
    }
    
    console.log('[Main] STEP 2 COMPLETE: All critical services available');

    // Create router AFTER services are validated
    console.log('[Main] STEP 3: Creating Vue Router...');
    const routes = [
      // AIDEV-NOTE: Unified search interface is now the primary route
      { path: '/', name: 'search', component: UnifiedSearchView },
    ];

    router = createRouter({
      history: createWebHistory('/decision-parser/'),
      routes
    });

    console.log('[Main] STEP 3 COMPLETE: Vue Router created');

    // Create Vue app
    console.log('[Main] STEP 4: Creating Vue application...');
    app = createApp(App);

    console.log('[Main] STEP 4 COMPLETE: Vue application created');

    // Configure PrimeVue
    console.log('[Main] STEP 5: Configuring PrimeVue...');
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
    console.log('[Main] STEP 5 COMPLETE: PrimeVue configured');

    // Install router
    console.log('[Main] STEP 6: Installing Vue Router...');
    app.use(router);
    console.log('[Main] STEP 6 COMPLETE: Vue Router installed');

    // Mount application
    console.log('[Main] STEP 7: Mounting Vue application...');
    app.mount('#app');
    console.log('[Main] STEP 7 COMPLETE: Vue application mounted');

    console.log('[Main] === APPLICATION INITIALIZATION COMPLETE ===');

  } catch (error) {
    console.error('[Main] Application initialization failed:', error);
    console.error('[Main] Error details:', error);

    // Fall back to basic initialization without new services
    console.warn('[Main] Falling back to legacy mode...');
    
    try {
      // Create basic router for fallback
      const fallbackRoutes = [
        { path: '/', name: 'search', component: UnifiedSearchView },
      ];

      const fallbackRouter = createRouter({
        history: createWebHistory('/decision-parser/'),
        routes: fallbackRoutes
      });

      const fallbackApp = createApp(App);
      
      fallbackApp.use(PrimeVue, {
        unstyled: true
      });
      fallbackApp.use(fallbackRouter);
      fallbackApp.mount('#app');
      
      console.log('[Main] Fallback initialization completed');
    } catch (fallbackError) {
      console.error('[Main] Fallback initialization also failed:', fallbackError);
      // Display error message to user
      document.body.innerHTML = `
        <div style="padding: 20px; color: red; font-family: Arial;">
          <h2>Application Failed to Initialize</h2>
          <p>There was an error starting the application. Please refresh the page or check the browser console for details.</p>
          <pre>${error instanceof Error ? error.message : 'Unknown error'}</pre>
        </div>
      `;
    }
  }
}

// Initialize the application
initializeApplication();