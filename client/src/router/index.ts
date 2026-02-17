import { createRouter, createWebHistory } from 'vue-router';
import { supabase } from '../services/supabase';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
        path: '/login',
        name: 'login',
        component: () => import('../views/Login.vue')
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
    }
    ]
});

router.beforeEach(async (to, _from, next) => {
    const { data: { session } } = await supabase.auth.getSession();

    if (to.meta.requiresAuth && !session) {
        next('/login');
    } else if (to.path === '/login' && session) {
        next('/');
    } else {
        next();
    }
});

export default router;