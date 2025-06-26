import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import UnifiedSearchView from './views/UnifiedSearchView.vue';
import './style.css';

// Import worker preload module to ensure workers are included in build
import './workers/index';

const routes = [
  // AIDEV-NOTE: Unified search interface is now the primary route
  { path: '/', name: 'search', component: UnifiedSearchView },
];

const router = createRouter({
  history: createWebHistory('/decision-parser/'),
  routes
});

const app = createApp(App);
app.use(router);
app.mount('#app');