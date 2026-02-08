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
        component: () => import('../components/Dashboard.vue'),
        meta: { requiresAuth: true }
    },
    {
        path: '/new-transaction',
        name: 'new-transaction',
        component: () => import('../components/NewTransaction.vue'),
        meta: { requiresAuth: true }
    },
    {
        path: '/new-category',
        name: 'new-category',
        component: () => import('../components/Category.vue'),
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