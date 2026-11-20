import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { supabase } from '../services/supabase';

export type VaultConnectionStatus = 'checking' | 'connected' | 'disconnected';

export const useVaultStore = defineStore('vault', () => {
    const status = ref<VaultConnectionStatus>('checking');
    const lastCheckedAt = ref<string | null>(null);
    const manualStealthMode = ref(false);

    // URL base do servidor Tailscale (ex: https://meu-servidor.tailxxxx.ts.net)
    // Se VITE_TAILSCALE_VAULT_URL não estiver definida, tenta extrair a origem do VITE_N8N_WEBHOOK_URL caso seja .ts.net
    const resolveTailscaleBaseUrl = (): string => {
        // 1. Verifica se o usuário salvou um endpoint customizado na tela de Configurações
        try {
            const savedPrefs = localStorage.getItem('somma_app_settings_v1');
            if (savedPrefs) {
                const parsed = JSON.parse(savedPrefs);
                if (parsed?.tailscaleVaultUrl && parsed.tailscaleVaultUrl !== 'https://somma-vault.tailnet.ts.net') {
                    return String(parsed.tailscaleVaultUrl).replace(/\/+$/, '');
                }
            }
        } catch {
            // ignora erro de parse
        }

        // 2. Variável de ambiente explícita VITE_TAILSCALE_VAULT_URL
        const explicitUrl = import.meta.env.VITE_TAILSCALE_VAULT_URL;
        if (explicitUrl) return explicitUrl.replace(/\/+$/, '');

        // 3. Fallback: extrai a origem do VITE_N8N_WEBHOOK_URL caso seja .ts.net
        const n8nUrl = import.meta.env.VITE_N8N_WEBHOOK_URL || '';
        if (n8nUrl.includes('.ts.net')) {
            try {
                const parsed = new URL(n8nUrl);
                return parsed.origin;
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

    // O Cofre só está desbloqueado se a conexão Tailscale estiver ativa E o usuário não tiver ativado o Stealth Mode manual
    const isVaultUnlocked = computed(() => {
        if (manualStealthMode.value || simulatedOffline.value) return false;
        return status.value === 'connected';
    });

    const checkTailscaleConnection = async (): Promise<boolean> => {
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
        manualStealthMode,
        simulatedOffline,
        isVaultUnlocked,
        checkTailscaleConnection,
        vaultFetch,
        toggleStealthMode,
        toggleSimulatedOffline
    };
});
