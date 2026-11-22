<script setup lang="ts">
    import { ref, computed } from 'vue';
    import { 
        PhX, PhMoon, PhSun, PhHeart, 
        PhArrowsClockwise, PhGear, PhQuestion, PhInfo, PhSignOut,
        PhHouse, PhFolders, PhTrendUp, PhSparkle, PhChartBar, PhDeviceMobile, PhDownloadSimple
    } from '@phosphor-icons/vue';
    import { useRouter, useRoute } from 'vue-router';
    import { storeToRefs } from 'pinia';
    import { supabase } from '../services/supabase';
    import { isBiometricEnabled } from '../services/biometricAuth';
    import { useProfileStore } from '../stores/useProfileStore';
    import { useAppDownload } from '../composables/useAppDownload';
    import logoUrl from '../assets/somma-logo.svg';

    defineProps<{ isOpen: boolean }>();
    const emit = defineEmits(['close']);
    const router = useRouter();
    const route = useRoute();

    const profileStore = useProfileStore();
    const { userName, avatarUrl } = storeToRefs(profileStore);
    const { isWebBrowser, latestVersion, apkDownloadUrl } = useAppDownload();

    const navigateTo = (path: string) => {
        emit('close');
        router.push(path);
    };

    const isDarkMode = ref(document.body.classList.contains('dark') || localStorage.getItem('theme') !== 'light');

    const toggleTheme = () => {
        isDarkMode.value = !isDarkMode.value;
        if (isDarkMode.value) {
            document.body.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.body.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    };

    const handleLogout = async () => {
        try {
            emit('close');
            // Se a biometria está ativa neste aparelho, faz logout 'local' para manter o refresh_token válido no servidor
            // e permitir voltar imediatamente clicando em "Entrar com Digital / Face ID" na tela /login!
            if (isBiometricEnabled()) {
                await supabase.auth.signOut({ scope: 'local' });
            } else {
                await supabase.auth.signOut();
            }
        } catch (error) {
            console.error('Erro ao fazer logout:', error);
        }
    };

    const userInitials = computed(() => {
        if (!userName.value) return 'U';
        const parts = userName.value.trim().split(' ').filter(Boolean);
        const first = parts[0] || 'U';
        const last = parts[parts.length - 1] || first;
        if (parts.length >= 2) {
            return ((first[0] || '') + (last[0] || '')).toUpperCase();
        }
        return first.substring(0, 2).toUpperCase();
    });

    const primaryNav = [
        { icon: PhHouse, title: 'Visão Geral', route: '/' },
        { icon: PhChartBar, title: 'Dashboard', route: '/dashboard' },
        { icon: PhFolders, title: 'Registros', route: '/records' },
        { icon: PhTrendUp, title: 'Investimentos', route: '/investments' },
        { icon: PhSparkle, title: 'Copilot IA', route: '/copilot', badge: 'AI' },
    ];

    const accountNav = [
        { icon: PhArrowsClockwise, title: 'Assinaturas', route: '/assinaturas' },
        { icon: PhHeart, title: 'Modo Casal', route: '/casal' },
        { icon: PhGear, title: 'Configurações', route: '/config' },
    ];

    const supportNav = [
        { icon: PhQuestion, title: 'Central de Ajuda', route: '/ajuda' },
        { icon: PhInfo, title: 'Sobre o Somma', route: '/sobre' },
    ];

    const isRouteActive = (itemRoute: string) => {
        if (itemRoute === '/') return route.path === '/';
        return route.path.startsWith(itemRoute);
    };
</script>

<template>
    <!-- Backdrop apenas no Mobile quando o drawer está aberto -->
    <Transition name="fade">
        <div v-if="isOpen" class="sidebar-backdrop" @click="emit('close')"></div>
    </Transition>

    <aside class="sidebar" :class="{ 'is-open': isOpen }" aria-label="Menu principal">
        <!-- Topo: Marca -->
        <div class="sidebar-header">
            <div
                class="brand"
                role="button"
                tabindex="0"
                aria-label="Ir para Visão Geral Somma AI"
                @click="navigateTo('/')"
                @keydown.enter="navigateTo('/')"
            >
                <img :src="logoUrl" alt="Somma Logo" class="logo-img" />
                <div class="brand-info">
                    <div class="brand-row">
                        <span class="brand-name">Somma</span>
                        <span class="brand-badge">AI</span>
                    </div>
                    <span class="brand-plan">Workspace Financeiro</span>
                </div>
            </div>
            <button class="close-btn mobile-only" @click="emit('close')" title="Fechar menu" aria-label="Fechar menu">
                <PhX size="20" />
            </button>
        </div>

        <!-- Navegação Scrollável -->
        <div class="sidebar-scroll">
            <!-- Grupo 1: Principal -->
            <div class="nav-group">
                <span class="group-label">Principal</span>
                <nav class="nav-list">
                    <button
                        v-for="item in primaryNav"
                        :key="item.route"
                        class="nav-item"
                        :class="{ active: isRouteActive(item.route) }"
                        @click="navigateTo(item.route)"
                    >
                        <component
                            :is="item.icon"
                            size="18"
                            :weight="isRouteActive(item.route) ? 'fill' : 'regular'"
                            class="nav-icon"
                        />
                        <span class="nav-label">{{ item.title }}</span>
                        <span v-if="item.badge" class="item-badge">{{ item.badge }}</span>
                    </button>
                </nav>
            </div>

            <!-- Grupo 2: Conta & Gestão -->
            <div class="nav-group">
                <span class="group-label">Conta & Gestão</span>
                <nav class="nav-list">
                    <button
                        v-for="item in accountNav"
                        :key="item.route"
                        class="nav-item"
                        :class="{ active: isRouteActive(item.route) }"
                        @click="navigateTo(item.route)"
                    >
                        <component
                            :is="item.icon"
                            size="18"
                            :weight="isRouteActive(item.route) ? 'fill' : 'regular'"
                            class="nav-icon"
                        />
                        <span class="nav-label">{{ item.title }}</span>
                    </button>
                </nav>
            </div>

            <!-- Grupo 3: Suporte & Aparência -->
            <div class="nav-group">
                <span class="group-label">Preferências</span>
                <nav class="nav-list">
                    <!-- Switch de Tema Integrado -->
                    <div class="theme-row" @click="toggleTheme">
                        <div class="theme-left">
                            <PhMoon v-if="isDarkMode" size="18" weight="duotone" class="nav-icon theme-icon" />
                            <PhSun v-else size="18" weight="duotone" class="nav-icon theme-icon" />
                            <span class="nav-label">{{ isDarkMode ? 'Modo Escuro' : 'Modo Claro' }}</span>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            :aria-checked="isDarkMode"
                            aria-label="Alternar modo escuro"
                            class="switch"
                            :class="{ active: isDarkMode }"
                            @click.stop="toggleTheme"
                        >
                            <span class="switch-thumb"></span>
                        </button>
                    </div>

                    <button
                        v-for="item in supportNav"
                        :key="item.route"
                        class="nav-item"
                        :class="{ active: isRouteActive(item.route) }"
                        @click="navigateTo(item.route)"
                    >
                        <component :is="item.icon" size="18" class="nav-icon" />
                        <span class="nav-label">{{ item.title }}</span>
                    </button>
                </nav>
            </div>
        </div>

        <!-- Banner Discreto de Download do App Android (apenas quando aberto no navegador) -->
        <div v-if="isWebBrowser" class="sidebar-download-wrap">
            <a
                :href="apkDownloadUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="sidebar-download-card"
                title="Baixar APK Android do Somma AI"
            >
                <div class="sd-icon">
                    <PhDeviceMobile size="18" weight="duotone" />
                </div>
                <div class="sd-text">
                    <strong>Baixar App Android</strong>
                    <span>APK Direto • {{ latestVersion }}</span>
                </div>
                <PhDownloadSimple size="16" weight="bold" class="sd-arrow" />
            </a>
        </div>

        <!-- Rodapé: Perfil do Usuário + Logout -->
        <div class="sidebar-footer">
            <div
                class="user-card"
                role="button"
                tabindex="0"
                :class="{ 'is-active': isRouteActive('/profile') }"
                @click="navigateTo('/profile')"
                @keydown.enter="navigateTo('/profile')"
                title="Acessar Meu Perfil"
                aria-label="Acessar Meu Perfil"
            >
                <div class="user-avatar">
                    <img v-if="avatarUrl" :src="avatarUrl" alt="Avatar" />
                    <span v-else>{{ userInitials }}</span>
                </div>
                <div class="user-meta">
                    <span class="user-name">{{ userName || 'Thiago Silva' }}</span>
                    <span class="user-email">Ver meu perfil →</span>
                </div>
            </div>
            <button class="logout-icon-btn" @click="handleLogout" title="Sair da conta" aria-label="Sair da conta">
                <PhSignOut size="18" />
            </button>
        </div>
    </aside>
</template>

<style scoped>
    .fade-enter-active, .fade-leave-active {
        transition: opacity 0.25s ease;
    }
    .fade-enter-from, .fade-leave-to {
        opacity: 0;
    }

    .sidebar-backdrop {
        display: none;
    }

    .sidebar {
        width: 256px;
        height: 100vh;
        position: sticky;
        top: 0;
        flex-shrink: 0;
        background-color: var(--bg-card);
        border-right: 1px solid var(--border-color);
        display: flex;
        flex-direction: column;
        z-index: 200;
        user-select: none;
    }

    /* === TOPO / BRAND === */
    .sidebar-header {
        height: 64px;
        padding: 0 1.25rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid var(--border-subtle);
    }

    .brand {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        cursor: pointer;
    }

    .logo-img {
        width: 32px;
        height: 32px;
        object-fit: contain;
        flex-shrink: 0;
    }

    .brand-info {
        display: flex;
        flex-direction: column;
        gap: 1px;
    }

    .brand-row {
        display: flex;
        align-items: center;
        gap: 0.35rem;
    }

    .brand-name {
        font-size: 1.05rem;
        font-weight: 700;
        letter-spacing: -0.02em;
        color: var(--text-primary);
    }

    .brand-badge {
        font-size: 0.65rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        padding: 1px 5px;
        border-radius: 5px;
        background: var(--primary-subtle);
        color: var(--primary-color);
        border: 1px solid rgba(99, 102, 241, 0.25);
    }

    .brand-plan {
        font-size: 0.7rem;
        color: var(--text-muted);
        font-weight: 500;
    }

    .mobile-only {
        display: none;
    }

    .close-btn {
        background: transparent;
        border: none;
        color: var(--text-secondary);
        width: 30px;
        height: 30px;
        border-radius: 8px;
        align-items: center;
        justify-content: center;
        cursor: pointer;
    }

    .close-btn:hover {
        background-color: var(--bg-hover);
        color: var(--text-primary);
    }

    /* === ÁREA DE NAVEGAÇÃO === */
    .sidebar-scroll {
        flex: 1;
        overflow-y: auto;
        padding: 1.15rem 0.85rem;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        scrollbar-width: thin;
        scrollbar-color: var(--border-color) transparent;
    }

    .nav-group {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
    }

    .group-label {
        font-size: 0.68rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--text-muted);
        padding: 0 0.65rem;
        margin-bottom: 0.15rem;
    }

    .nav-list {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .nav-item {
        display: flex;
        align-items: center;
        gap: 0.7rem;
        width: 100%;
        padding: 0.55rem 0.65rem;
        border-radius: 9px;
        border: 1px solid transparent;
        background: transparent;
        color: var(--text-secondary);
        font-family: inherit;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        text-align: left;
        transition: all 0.15s ease;
    }

    .nav-item:hover {
        background-color: var(--bg-hover);
        color: var(--text-primary);
    }

    .nav-icon {
        flex-shrink: 0;
        color: var(--text-muted);
        transition: color 0.15s ease;
    }

    .nav-item:hover .nav-icon {
        color: var(--text-primary);
    }

    .nav-item.active {
        background-color: var(--primary-subtle);
        color: var(--text-primary);
        font-weight: 600;
        border-color: rgba(99, 102, 241, 0.2);
    }

    .nav-item.active .nav-icon {
        color: var(--primary-color);
    }

    .nav-label {
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .item-badge {
        font-size: 0.65rem;
        font-weight: 700;
        padding: 1px 6px;
        border-radius: 99px;
        background: var(--primary-gradient);
        color: white;
    }

    .soon-pill {
        font-size: 0.65rem;
        font-weight: 600;
        padding: 1px 6px;
        border-radius: 6px;
        background-color: var(--bg-elevated);
        color: var(--text-muted);
        border: 1px solid var(--border-color);
    }

    /* === LINHA DO TEMA === */
    .theme-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.5rem 0.65rem;
        border-radius: 9px;
        cursor: pointer;
        color: var(--text-secondary);
        font-size: 0.875rem;
        font-weight: 500;
        transition: background-color 0.15s ease, color 0.15s ease;
    }

    .theme-row:hover {
        background-color: var(--bg-hover);
        color: var(--text-primary);
    }

    .theme-left {
        display: flex;
        align-items: center;
        gap: 0.7rem;
    }

    .theme-icon {
        color: var(--primary-color);
    }

    .switch {
        width: 36px;
        height: 20px;
        border-radius: 99px;
        background-color: var(--bg-elevated);
        border: 1px solid var(--border-color);
        position: relative;
        cursor: pointer;
        padding: 0;
        transition: background-color 0.2s ease, border-color 0.2s ease;
    }

    .switch.active {
        background-color: var(--primary-color);
        border-color: var(--primary-color);
    }

    .switch-thumb {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background-color: white;
        transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    }

    .switch.active .switch-thumb {
        transform: translateX(16px);
    }

    /* === DOWNLOAD APP BANNER (WEB ONLY) === */
    .sidebar-download-wrap {
        padding: 0 0.85rem 0.75rem;
    }

    .sidebar-download-card {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        padding: 0.6rem 0.75rem;
        border-radius: 11px;
        background: var(--primary-subtle);
        border: 1px solid rgba(99, 102, 241, 0.25);
        text-decoration: none;
        color: var(--text-primary);
        transition: all 0.15s ease;
    }

    .sidebar-download-card:hover {
        background: rgba(99, 102, 241, 0.22);
        border-color: var(--primary-color);
        transform: translateY(-1px);
    }

    .sd-icon {
        width: 30px;
        height: 30px;
        border-radius: 8px;
        background: var(--primary-color);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .sd-text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        line-height: 1.25;
    }

    .sd-text strong {
        font-size: 0.78rem;
        font-weight: 700;
        color: var(--text-primary);
    }

    .sd-text span {
        font-size: 0.68rem;
        color: var(--text-secondary);
    }

    .sd-arrow {
        color: var(--primary-color);
        flex-shrink: 0;
    }

    /* === RODAPÉ DO USUÁRIO === */
    .sidebar-footer {
        padding: 0.85rem;
        border-top: 1px solid var(--border-color);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
    }

    .user-card {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        flex: 1;
        min-width: 0;
        padding: 0.35rem 0.45rem;
        border-radius: 9px;
        cursor: pointer;
        transition: background-color 0.15s ease;
    }

    .user-card:hover {
        background-color: var(--bg-hover);
    }

    .user-card.is-active {
        background-color: var(--primary-subtle);
        border: 1px solid rgba(99, 102, 241, 0.25);
    }

    .user-card.is-active .user-email {
        color: var(--primary-color);
        font-weight: 600;
    }

    .user-avatar {
        width: 34px;
        height: 34px;
        border-radius: 9px;
        background: var(--primary-gradient);
        color: white;
        font-weight: 700;
        font-size: 0.8rem;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        overflow: hidden;
    }

    .user-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .user-meta {
        display: flex;
        flex-direction: column;
        min-width: 0;
    }

    .user-name {
        font-size: 0.825rem;
        font-weight: 600;
        color: var(--text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .user-email {
        font-size: 0.7rem;
        color: var(--text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .logout-icon-btn {
        width: 34px;
        height: 34px;
        border-radius: 8px;
        background: transparent;
        border: 1px solid transparent;
        color: var(--text-muted);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        flex-shrink: 0;
        transition: all 0.15s ease;
    }

    .logout-icon-btn:hover {
        background-color: var(--danger-bg);
        color: var(--danger-color);
    }

    /* === RESPONSIVIDADE MOBILE (< 1024px vira Drawer) === */
    @media (max-width: 1024px) {
        .sidebar-backdrop {
            display: block;
            position: fixed;
            inset: 0;
            background-color: rgba(0, 0, 0, 0.55);
            backdrop-filter: blur(2px);
            z-index: 9998;
        }

        .sidebar {
            position: fixed;
            top: 0;
            left: 0;
            width: min(280px, 85vw);
            height: 100vh;
            height: 100dvh;
            z-index: 9999;
            transform: translateX(-100%);
            transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: var(--shadow-md);
        }

        .sidebar-footer {
            padding-bottom: calc(0.85rem + env(safe-area-inset-bottom, 0px));
        }

        .nav-item {
            min-height: 44px;
        }

        .close-btn {
            width: 38px;
            height: 38px;
        }

        .sidebar.is-open {
            transform: translateX(0);
        }

        .mobile-only {
            display: flex;
        }
    }
</style>
