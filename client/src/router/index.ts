import { createRouter, createWebHistory } from 'vue-router';
import { supabase } from '../services/supabase';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
        path: '/login',
        name: 'login',
        component: () => import('../views/Login.vue'),
        meta: { requiresGuest: true }
    },
    {    
        path: '/',
        name: 'dashboard',
        component: () => import('../views/Dashboard.vue'),
        meta: { requiresAuth: true }
    },
    {
        path: '/records',
        name: 'records',
        component: () => import('../views/Records.vue'),
        meta: { requiresAuth: true }
    },
    {
        path: '/copilot',
        name: 'copilot',
        component: () => import('../views/Copilot.vue'),
        meta: { requiresAuth: true }
    }
    ]
});

router.beforeEach(async (to, _from, next) => {
    const { data: { session } } = await supabase.auth.getSession();
    const isAuthenticated = !!session;

    if (to.meta.requiresAuth && !isAuthenticated) {
        next('/login');
    } else if (to.meta.requiresGuest && isAuthenticated) {
        next('/');
    } else {
        next();
    }
});

export default router;