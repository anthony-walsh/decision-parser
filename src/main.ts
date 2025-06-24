import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import SearchView from './views/SearchView.vue';
import ResultsView from './views/ResultsView.vue';
import './style.css';

const routes = [
  { path: '/', name: 'search', component: SearchView },
  { path: '/results', name: 'results', component: ResultsView, props: (route: any) => ({ query: route.query.q }) }
];

const router = createRouter({
  history: createWebHistory('/decision-parser/'),
  routes
});

const app = createApp(App);
app.use(router);
app.mount('#app');