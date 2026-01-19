import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import ShakePage from './pages/ShakePage.vue';
import AdminPage from './pages/AdminPage.vue';

const routes = [
  { path: '/', component: ShakePage },
  { path: '/admin', component: AdminPage },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

const app = createApp(App);
app.use(router);
app.mount('#app');


