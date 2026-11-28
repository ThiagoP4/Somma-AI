import { createRouter, createWebHistory } from 'vue-router';
import { AuthApiError } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { isBiometricEnabled, clearSessionBiometricUnlocked } from '../services/biometricAuth';

const INACTIVITY_TIMEOUT = 24 * 60 * 60 * 1000;

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
            name: 'home',
            component: () => import('../views/Home.vue'),
            meta: { requiresAuth: true }
        },
        {
            path: '/dashboard',
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
            path: '/investments',
            name: 'investments',
            component: () => import('../views/Investments.vue'),
            meta: { requiresAuth: true }
        },
        {
            path: '/profile',
            name: 'profile',
            component: () => import('../views/Profile.vue'),
            meta: { requiresAuth: true }
        },
        {
            path: '/copilot',
            name: 'copilot',
            component: () => import('../views/Copilot.vue'),
            meta: { requiresAuth: true }
        },
        {
            path: '/assinaturas',
            name: 'subscriptions',
            component: () => import('../views/Subscriptions.vue'),
            meta: { requiresAuth: true }
        },
        {
            path: '/casal',
            name: 'couple',
            component: () => import('../views/CoupleMode.vue'),
            meta: { requiresAuth: true }
        },
        {
            path: '/config',
            name: 'settings',
            component: () => import('../views/Settings.vue'),
            meta: { requiresAuth: true }
        },
        {
            path: '/ajuda',
            name: 'help',
            component: () => import('../views/HelpCenter.vue'),
            meta: { requiresAuth: true }
        },
        {
            path: '/sobre',
            name: 'about',
            component: () => import('../views/About.vue'),
            meta: { requiresAuth: true }
        }
    ]
});

router.beforeEach(async (to, from, next) => {
    const { data: { session }, error } = await supabase.auth.getSession();
    const isAuthenticated = !!session;

    if (error && error instanceof AuthApiError && error.message?.includes('Invalid refresh token')) {
        await supabase.auth.signOut();
        localStorage.removeItem('supabase.auth.token');
    }

    if (isAuthenticated) {
        const lastActivity = localStorage.getItem('lastActivity');
        const now = Date.now();

        // Se o usuário acabou de sair da tela /login, nunca aplica o timeout antigo de 24h!
        if (from.path !== '/login' && lastActivity && (now - parseInt(lastActivity)) > INACTIVITY_TIMEOUT) {
            localStorage.removeItem('lastActivity');
            // Se a digital estiver ativa no celular, NÃO revoga o refresh_token no servidor!
            // Faz apenas signOut local (ou exige a digital novamente) para que a digital continue funcionando mesmo após 24h+ sem abrir o app.
            if (isBiometricEnabled()) {
                clearSessionBiometricUnlocked();
                await supabase.auth.signOut({ scope: 'local' });
            } else {
                await supabase.auth.signOut();
            }
            return next('/login');
        }
        localStorage.setItem('lastActivity', now.toString());
    }

    if (to.meta.requiresAuth && !isAuthenticated) {
        next('/login');
    } else if (to.meta.requiresGuest && isAuthenticated && import.meta.env.MODE !== 'mock') {
        next('/');
    } else {
        next();
    }
});

export default router;