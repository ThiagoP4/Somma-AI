import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {    
        path: '/',
        name: 'dashboard',
        component: () => import('../components/Dashboard.vue')
    },
    {
        path: '/new-transaction',
        name: 'new-transaction',
        component: () => import('../components/NewTransaction.vue')
    }
    ]
});

export default router;