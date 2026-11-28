import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { supabase } from '../services/supabase';

export type VaultConnectionStatus = 'checking' | 'connected' | 'disconnected';

const OWNER_DEFAULT_PRIVATE_VAULT_USER_ID = 'a6e90fd9-acd1-42d4-8888-b7e7fa0568d5';

export const useVaultStore = defineStore('vault', () => {
    const status = ref<VaultConnectionStatus>('checking');
    const lastCheckedAt = ref<string | null>(null);
    const manualStealthMode = ref(false);
    // Sessão Efêmera (somente na memória RAM desta aba) via Pareamento Criptografado com o celular
    const isEphemeralPaired = ref(false);
    const ephemeralPairedAt = ref<string | null>(null);

    const resolveSavedPrivateServerFlag = (): boolean | null => {
        try {
            const savedPrefs = localStorage.getItem('somma_app_settings_v1');
            if (savedPrefs) {
                const parsed = JSON.parse(savedPrefs);
                if (typeof parsed?.usePrivateServer === 'boolean') {
                    return parsed.usePrivateServer;
                }
            }
        } catch {
            // ignora
        }
        return null;
    };

    const usePrivateServer = ref<boolean>(resolveSavedPrivateServerFlag() ?? false);

    const syncPrivateServerDefaultForUser = (userId?: string | null) => {
        const explicitPref = resolveSavedPrivateServerFlag();
        if (explicitPref !== null) {
            usePrivateServer.value = explicitPref;
            return;
        }
        usePrivateServer.value = Boolean(
            userId &&
            userId === OWNER_DEFAULT_PRIVATE_VAULT_USER_ID &&
            tailscaleBaseUrl.value
        );
    };

    const setUsePrivateServer = (enabled: boolean) => {
        usePrivateServer.value = enabled;
        try {
            const raw = localStorage.getItem('somma_app_settings_v1');
            const parsed = raw ? JSON.parse(raw) : {};
            parsed.usePrivateServer = enabled;
            localStorage.setItem('somma_app_settings_v1', JSON.stringify(parsed));
        } catch {
            // ignora
        }
    };

    // URL base do servidor Tailscale lida exclusivamente do .env (VITE_TAILSCALE_VAULT_URL) ou do localStorage do navegador
    const resolveTailscaleBaseUrl = (): string => {
        // 1. Verifica se o usuário salvou um endpoint customizado na tela de Configurações (localStorage local do navegador)
        try {
            const savedPrefs = localStorage.getItem('somma_app_settings_v1');
            if (savedPrefs) {
                const parsed = JSON.parse(savedPrefs);
                if (parsed?.tailscaleVaultUrl) {
                    const savedUrl = String(parsed.tailscaleVaultUrl).replace(/\/+$/, '');
                    // Se o site estiver rodando em HTTPS (ex: Vercel), ignora URLs HTTP antigas salvas no localStorage para evitar bloqueio de Mixed Content/CSP
                    const isHttpsPage = typeof window !== 'undefined' && window.location.protocol === 'https:';
                    if (!isHttpsPage || savedUrl.startsWith('https://')) {
                        return savedUrl;
                    }
                }
            }
        } catch {
            // ignora erro de parse
        }

        // 2. Variável de ambiente explícita VITE_TAILSCALE_VAULT_URL (configurada na Vercel / .env local)
        const explicitUrl = import.meta.env.VITE_TAILSCALE_VAULT_URL;
        if (explicitUrl) return explicitUrl.replace(/\/+$/, '');

        // 3. Fallback: deriva a partir do VITE_N8N_WEBHOOK_URL do .env caso seja .ts.net
        const n8nUrl = import.meta.env.VITE_N8N_WEBHOOK_URL || '';
        if (n8nUrl.includes('.ts.net')) {
            try {
                const parsed = new URL(n8nUrl);
                return `${parsed.protocol}//${parsed.hostname}:8787`;
            } catch {
                return '';
            }
        }
        return '';
    };

    const tailscaleBaseUrl = ref<string>(resolveTailscaleBaseUrl());
    const isMockMode = import.meta.env.VITE_USE_MOCK === 'true' || import.meta.env.MODE === 'mock';

    // Simulação para o usuário testar o estado "Fora do Tailscale" mesmo em Mock/Dev
    const simulatedOffline = ref(localStorage.getItem('somma_simulate_vault_offline') === 'true');

    // O Cofre está desbloqueado:
    // - Para usuários padrão (sem servidor privado próprio): sempre desbloqueado (salvo no Supabase com RLS).
    // - Para quem ativou o Servidor Privado: desbloqueado quando conectado na rede privada ou sincronizado temporariamente via celular.
    const isVaultUnlocked = computed(() => {
        if (manualStealthMode.value) return false;
        if (!usePrivateServer.value) return true;
        if (isEphemeralPaired.value) return true;
        if (simulatedOffline.value) return false;
        return status.value === 'connected';
    });

    const activateEphemeralSession = (pairedAtIso?: string) => {
        isEphemeralPaired.value = true;
        manualStealthMode.value = false;
        ephemeralPairedAt.value = pairedAtIso
            ? new Date(pairedAtIso).toLocaleTimeString('pt-BR')
            : new Date().toLocaleTimeString('pt-BR');
    };

    const clearEphemeralSession = () => {
        isEphemeralPaired.value = false;
        ephemeralPairedAt.value = null;
    };

    const checkTailscaleConnection = async (): Promise<boolean> => {
        const { data: sessionData } = await supabase.auth.getSession();
        const currentUserId = sessionData.session?.user?.id || null;
        syncPrivateServerDefaultForUser(currentUserId);

        if (!usePrivateServer.value) {
            status.value = 'connected';
            lastCheckedAt.value = new Date().toLocaleTimeString('pt-BR');
            return true;
        }

        if (simulatedOffline.value) {
            status.value = 'disconnected';
            lastCheckedAt.value = new Date().toLocaleTimeString('pt-BR');
            return false;
        }

        status.value = 'checking';

        // Em modo mock (ou se tiver flag de dev), simula conectado por padrão a menos que simulatedOffline esteja true
        if (isMockMode && !tailscaleBaseUrl.value) {
            await new Promise(r => setTimeout(r, 350));
            status.value = 'connected';
            lastCheckedAt.value = new Date().toLocaleTimeString('pt-BR');
            return true;
        }

        if (!tailscaleBaseUrl.value) {
            status.value = 'disconnected';
            lastCheckedAt.value = new Date().toLocaleTimeString('pt-BR');
            return false;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2200);

        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token;

            const response = await fetch(`${tailscaleBaseUrl.value}/health`, {
                method: 'GET',
                headers: {
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.ok || response.status === 404) {
                // Se respondeu HTTP (mesmo 404 na rota /health), o host Tailscale (.ts.net) está acessível na VPN!
                status.value = 'connected';
                lastCheckedAt.value = new Date().toLocaleTimeString('pt-BR');
                return true;
            } else {
                status.value = 'disconnected';
                lastCheckedAt.value = new Date().toLocaleTimeString('pt-BR');
                return false;
            }
        } catch {
            clearTimeout(timeoutId);
            status.value = 'disconnected';
            lastCheckedAt.value = new Date().toLocaleTimeString('pt-BR');
            return false;
        }
    };

    // Helper para fazer requisições HTTP autenticadas exclusivamente para o servidor Tailscale (Arquitetura A)
    const vaultFetch = async (path: string, options: RequestInit = {}) => {
        if (!isVaultUnlocked.value || !tailscaleBaseUrl.value) {
            throw new Error('Cofre Tailscale indisponível fora da rede VPN.');
        }

        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4500);

        try {
            const res = await fetch(`${tailscaleBaseUrl.value}${path}`, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                    ...(options.headers || {})
                },
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!res.ok) {
                throw new Error(`Erro no Vault Tailscale (${res.status})`);
            }
            return await res.json();
        } catch (err) {
            clearTimeout(timeoutId);
            throw err;
        }
    };

    const toggleStealthMode = () => {
        manualStealthMode.value = !manualStealthMode.value;
        if (manualStealthMode.value) {
            clearEphemeralSession();
        }
    };

    const toggleSimulatedOffline = async () => {
        simulatedOffline.value = !simulatedOffline.value;
        localStorage.setItem('somma_simulate_vault_offline', String(simulatedOffline.value));
        await checkTailscaleConnection();
    };

    return {
        status,
        lastCheckedAt,
        tailscaleBaseUrl,
        usePrivateServer,
        manualStealthMode,
        simulatedOffline,
        isEphemeralPaired,
        ephemeralPairedAt,
        isVaultUnlocked,
        checkTailscaleConnection,
        vaultFetch,
        toggleStealthMode,
        toggleSimulatedOffline,
        activateEphemeralSession,
        clearEphemeralSession,
        setUsePrivateServer,
        syncPrivateServerDefaultForUser
    };
});
