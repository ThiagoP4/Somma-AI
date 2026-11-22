<script setup lang="ts">
    import { ref, onMounted } from 'vue';
    import { storeToRefs } from 'pinia';
    import {
        PhShieldCheck, PhLockKey, PhSparkle, PhPalette, PhDatabase,
        PhArrowsClockwise, PhFloppyDisk, PhDownloadSimple, PhTrash, PhFingerprint
    } from '@phosphor-icons/vue';
    import { useVaultStore } from '../stores/useVaultStore';
    import { usePiggybankStore } from '../stores/usePiggybankStore';
    import { useAlertStore } from '../stores/useAlertStore';
    import {
        isBiometricSupported,
        getBiometricConfig,
        registerBiometricForCurrentUser,
        setAppLockOnStart,
        disableBiometric,
        verifyBiometric
    } from '../services/biometricAuth';

    const vaultStore = useVaultStore();
    const piggybankStore = usePiggybankStore();
    const { isVaultUnlocked } = storeToRefs(vaultStore);
    const { showAlert } = useAlertStore();

    const PREFS_KEY = 'somma_app_settings_v1';

    const isDarkMode = ref(document.body.classList.contains('dark') || localStorage.getItem('theme') !== 'light');

    const settings = ref({
        tailscaleVaultUrl: vaultStore.tailscaleBaseUrl || '',
        n8nWebhookUrl: import.meta.env.VITE_N8N_WEBHOOK_URL || '',
        defaultCdiMonthlyPct: 0.85,
        maxSafeInstallmentCommitmentPct: 20,
        protectEmergencyFundInAi: true,
        autoLockOutsideTailscale: true,
        defaultFilterMode: 'month' as 'month' | 'invoice'
    });

    const biometricSupported = ref(false);
    const biometricEnabled = ref(false);
    const biometricAppLock = ref(true);
    const biometricBusy = ref(false);

    onMounted(async () => {
        const raw = localStorage.getItem(PREFS_KEY);
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                settings.value = { ...settings.value, ...parsed };
            } catch {
                // ignora erro
            }
        }
        biometricSupported.value = await isBiometricSupported();
        const bioCfg = getBiometricConfig();
        biometricEnabled.value = Boolean(bioCfg?.enabled);
        biometricAppLock.value = Boolean(bioCfg?.appLockOnStart ?? true);
    });

    const handleEnableBiometric = async () => {
        biometricBusy.value = true;
        try {
            await registerBiometricForCurrentUser(biometricAppLock.value);
            biometricEnabled.value = true;
            showAlert('Digital / Biometria cadastrada com sucesso neste aparelho!', 'success');
        } catch (err: any) {
            showAlert(err?.message || 'Não foi possível ativar a biometria neste aparelho.', 'warning');
        } finally {
            biometricBusy.value = false;
        }
    };

    const handleDisableBiometric = () => {
        disableBiometric();
        biometricEnabled.value = false;
        showAlert('Login por digital desativado neste aparelho.', 'success');
    };

    const handleTestBiometricNow = async () => {
        try {
            const ok = await verifyBiometric();
            if (ok) {
                showAlert('Digital validada com sucesso pelo chip de segurança do aparelho!', 'success');
            }
        } catch (err: any) {
            showAlert(err?.message || 'Teste biométrico cancelado ou indisponível.', 'warning');
        }
    };

    const handleToggleBiometricAppLock = () => {
        biometricAppLock.value = !biometricAppLock.value;
        if (biometricEnabled.value) {
            setAppLockOnStart(biometricAppLock.value);
            showAlert(
                biometricAppLock.value
                    ? 'Tela de bloqueio por digital ativada ao abrir o app.'
                    : 'Tela de bloqueio ao abrir desativada (digital mantida na tela de login).',
                'success'
            );
        }
    };

    const toggleTheme = (dark: boolean) => {
        isDarkMode.value = dark;
        if (dark) {
            document.body.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.body.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    };

    const handleSaveSettings = () => {
        localStorage.setItem(PREFS_KEY, JSON.stringify(settings.value));
        vaultStore.tailscaleBaseUrl = settings.value.tailscaleVaultUrl.replace(/\/+$/, '');
        showAlert('Preferências do sistema salvas com sucesso!', 'success');
    };

    const handleTestTailscale = async () => {
        vaultStore.tailscaleBaseUrl = settings.value.tailscaleVaultUrl.replace(/\/+$/, '');
        const ok = await vaultStore.checkTailscaleConnection();
        await piggybankStore.fetchPiggybanks();
        if (ok) {
            showAlert('Túnel Tailscale verificado e Cofre sincronizado!', 'success');
        } else {
            showAlert('Cofre isolado: host Tailscale inacessível ou em modo de simulação offline.', 'warning');
        }
    };

    const handleExportBackup = () => {
        const payload = {
            exportedAt: new Date().toISOString(),
            settings: settings.value,
            subscriptions: JSON.parse(localStorage.getItem('somma_subscriptions_v1') || '[]'),
            coupleMode: JSON.parse(localStorage.getItem('somma_couple_mode_v1') || '{}')
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `somma_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showAlert('Backup JSON exportado!', 'success');
    };

    const handleClearLocalCache = () => {
        if (confirm('Isso limpará preferências locais salvas no navegador. Deseja continuar?')) {
            localStorage.removeItem(PREFS_KEY);
            showAlert('Cache local restaurado para os padrões.', 'success');
        }
    };
</script>

<template>
    <div class="settings-page">
        <header class="page-header">
            <div>
                <h1>Configurações do Sistema</h1>
                <p class="subtitle">Gerencie seu cofre Tailscale Zero-Trust, parâmetros matemáticos da IA e aparência</p>
            </div>
            <button class="btn-primary" @click="handleSaveSettings">
                <PhFloppyDisk size="17" weight="bold" />
                Salvar Preferências
            </button>
        </header>

        <div class="settings-grid">
            <!-- CARD 1: COFRE TAILSCALE ZERO-TRUST -->
            <section class="settings-card">
                <div class="card-top">
                    <div class="icon-badge" :class="isVaultUnlocked ? 'badge-green' : 'badge-amber'">
                        <PhShieldCheck v-if="isVaultUnlocked" size="20" weight="duotone" />
                        <PhLockKey v-else size="20" weight="duotone" />
                    </div>
                    <div class="card-titles">
                        <h2>Cofre Tailscale VPN (Arquitetura Dual-DB)</h2>
                        <p>Isolamento físico dos saldos bancários e cofrinhos na sua rede privada</p>
                    </div>
                    <span class="status-tag" :class="isVaultUnlocked ? 'ok' : 'warn'">
                        {{ isVaultUnlocked ? 'Conectado' : 'Isolado' }}
                    </span>
                </div>

                <div class="form-stack">
                    <div class="input-group">
                        <label>Endpoint do Cofre Tailscale (.ts.net)</label>
                        <input
                            type="text"
                            v-model="settings.tailscaleVaultUrl"
                            placeholder="https://meu-servidor.tailxxxx.ts.net"
                        />
                        <small class="field-hint">
                            Quando conectado à sua Tailnet, o app sincroniza `fin_piggybank` a partir deste host privado.
                        </small>
                    </div>

                    <div class="toggle-row">
                        <div class="toggle-info">
                            <strong>Bloquear Patrimônio Automaticamente Fora da VPN</strong>
                            <span>Zera os saldos de cofrinhos na memória caso o ping Tailscale falhe</span>
                        </div>
                        <button
                            type="button"
                            class="switch"
                            :class="{ active: settings.autoLockOutsideTailscale }"
                            @click="settings.autoLockOutsideTailscale = !settings.autoLockOutsideTailscale"
                        >
                            <span class="switch-thumb"></span>
                        </button>
                    </div>

                    <div class="toggle-row">
                        <div class="toggle-info">
                            <strong>Simular Desconexão da VPN (Modo de Teste)</strong>
                            <span>Permite testar como um invasor externo vê o site sem acesso ao seu Tailscale</span>
                        </div>
                        <button
                            type="button"
                            class="switch"
                            :class="{ active: vaultStore.simulatedOffline }"
                            @click="vaultStore.toggleSimulatedOffline(); piggybankStore.fetchPiggybanks();"
                        >
                            <span class="switch-thumb"></span>
                        </button>
                    </div>

                    <div class="card-actions-bar">
                        <button type="button" class="btn-secondary" @click="handleTestTailscale">
                            <PhArrowsClockwise size="16" />
                            Testar Ping Tailscale Agora
                        </button>
                    </div>
                </div>
            </section>

            <!-- CARD 2: PARÂMETROS DO COPILOT IA & MATEMÁTICA FINANCEIRA -->
            <section class="settings-card">
                <div class="card-top">
                    <div class="icon-badge badge-indigo">
                        <PhSparkle size="20" weight="duotone" />
                    </div>
                    <div class="card-titles">
                        <h2>Motor Matemático & Copilot IA</h2>
                        <p>Taxas de referência para cálculo de compras à vista vs. parceladas (VPL)</p>
                    </div>
                </div>

                <div class="form-stack">
                    <div class="row-2">
                        <div class="input-group">
                            <label>Rendimento Líquido dos Cofrinhos (% a.m.)</label>
                            <input type="number" step="0.05" v-model.number="settings.defaultCdiMonthlyPct" />
                            <small class="field-hint">Ex: 0.85% equivale a ~100% do CDI líquido</small>
                        </div>
                        <div class="input-group">
                            <label>Teto Saudável para Novas Parcelas (% da Sobra)</label>
                            <input type="number" min="5" max="80" v-model.number="settings.maxSafeInstallmentCommitmentPct" />
                            <small class="field-hint">Recomendado pelo Copilot: até 20% da margem livre</small>
                        </div>
                    </div>

                    <div class="input-group">
                        <label>Webhook do Agente n8n (Tailscale / Cloud)</label>
                        <input type="text" v-model="settings.n8nWebhookUrl" placeholder="https://n8n.seu-tailnet.ts.net/webhook/..." />
                    </div>

                    <div class="toggle-row">
                        <div class="toggle-info">
                            <strong>Proteger Reserva de Emergência nas Recomendações</strong>
                            <span>Instrui a IA a nunca sugerir o uso da Reserva de Emergência para compras de consumo</span>
                        </div>
                        <button
                            type="button"
                            class="switch"
                            :class="{ active: settings.protectEmergencyFundInAi }"
                            @click="settings.protectEmergencyFundInAi = !settings.protectEmergencyFundInAi"
                        >
                            <span class="switch-thumb"></span>
                        </button>
                    </div>
                </div>
            </section>

            <!-- CARD 3: APARÊNCIA & INTERFACE -->
            <section class="settings-card">
                <div class="card-top">
                    <div class="icon-badge badge-indigo">
                        <PhPalette size="20" weight="duotone" />
                    </div>
                    <div class="card-titles">
                        <h2>Aparência & Navegação</h2>
                        <p>Personalize o tema visual e o modo padrão de visualização de datas</p>
                    </div>
                </div>

                <div class="form-stack">
                    <div class="theme-cards-row">
                        <div
                            class="theme-choice"
                            :class="{ active: isDarkMode }"
                            @click="toggleTheme(true)"
                        >
                            <div class="preview-swatch dark-swatch">
                                <span class="sw-bar"></span>
                                <span class="sw-dot"></span>
                            </div>
                            <div class="choice-meta">
                                <strong>Obsidian Dark</strong>
                                <span>Contraste profundo com Electric Indigo</span>
                            </div>
                        </div>

                        <div
                            class="theme-choice"
                            :class="{ active: !isDarkMode }"
                            @click="toggleTheme(false)"
                        >
                            <div class="preview-swatch light-swatch">
                                <span class="sw-bar"></span>
                                <span class="sw-dot"></span>
                            </div>
                            <div class="choice-meta">
                                <strong>Slate Light</strong>
                                <span>Fundo claro editorial de alta legibilidade</span>
                            </div>
                        </div>
                    </div>

                    <div class="input-group">
                        <label>Modo de Filtro Padrão na Topbar</label>
                        <select v-model="settings.defaultFilterMode">
                            <option value="month">Calendário Mensal (1º ao último dia do mês)</option>
                            <option value="invoice">Ciclo de Fatura de Cartão de Crédito</option>
                        </select>
                    </div>
                </div>
            </section>

            <!-- CARD 4: BIOMETRIA & DIGITAL NO CELULAR -->
            <section class="settings-card">
                <div class="card-top">
                    <div class="icon-badge" :class="biometricEnabled ? 'badge-green' : 'badge-indigo'">
                        <PhFingerprint size="22" weight="duotone" />
                    </div>
                    <div class="card-titles">
                        <h2>Login por Digital / Face ID</h2>
                        <p>Use o sensor biométrico do celular (ou Windows Hello) para entrar e proteger o app</p>
                    </div>
                    <span class="status-tag" :class="biometricEnabled ? 'ok' : 'warn'">
                        {{ biometricEnabled ? 'Ativo' : 'Inativo' }}
                    </span>
                </div>

                <div class="form-stack">
                    <p class="data-desc" v-if="biometricSupported">
                        Sua biometria é validada diretamente pelo chip de segurança do seu aparelho (WebAuthn) — sua digital nunca sai do telefone.
                    </p>
                    <p class="data-desc" v-else>
                        Sensor biométrico não detectado neste navegador (para funcionar no celular, acesse pelo link HTTPS da Vercel ou pelo app Android).
                    </p>

                    <div class="toggle-row" v-if="biometricSupported">
                        <div class="toggle-info">
                            <strong>Exigir Digital ao Abrir o App (Tela de Bloqueio)</strong>
                            <span>Estilo Nubank/Inter: pede sua digital sempre que o app for aberto</span>
                        </div>
                        <button
                            type="button"
                            class="switch"
                            :class="{ active: biometricAppLock }"
                            @click="handleToggleBiometricAppLock"
                        >
                            <span class="switch-thumb"></span>
                        </button>
                    </div>

                    <div class="data-buttons">
                        <button
                            v-if="!biometricEnabled"
                            type="button"
                            class="btn-primary"
                            :disabled="!biometricSupported || biometricBusy"
                            @click="handleEnableBiometric"
                        >
                            <PhFingerprint size="18" weight="bold" />
                            {{ biometricBusy ? 'Aguardando sensor...' : 'Cadastrar Digital deste Aparelho' }}
                        </button>
                        <template v-else>
                            <button
                                type="button"
                                class="btn-secondary"
                                @click="handleTestBiometricNow"
                            >
                                <PhFingerprint size="17" />
                                Testar Digital Agora
                            </button>
                            <button
                                type="button"
                                class="btn-outline danger-outline"
                                @click="handleDisableBiometric"
                            >
                                <PhTrash size="17" />
                                Desativar Digital neste Aparelho
                            </button>
                        </template>
                    </div>
                </div>
            </section>

            <!-- CARD 5: DADOS, BACKUP & PRIVACIDADE -->
            <section class="settings-card">
                <div class="card-top">
                    <div class="icon-badge badge-indigo">
                        <PhDatabase size="20" weight="duotone" />
                    </div>
                    <div class="card-titles">
                        <h2>Portabilidade & Cache Local</h2>
                        <p>Exporte seus dados de assinaturas, modo casal e configurações</p>
                    </div>
                </div>

                <div class="form-stack">
                    <p class="data-desc">
                        Seus lançamentos principais são sincronizados com o Supabase e seus cofrinhos protegidos pelo Tailscale Vault. Você pode exportar um snapshot JSON das suas configurações locais a qualquer momento.
                    </p>

                    <div class="data-buttons">
                        <button type="button" class="btn-secondary" @click="handleExportBackup">
                            <PhDownloadSimple size="17" />
                            Exportar Backup JSON
                        </button>
                        <button type="button" class="btn-outline danger-outline" @click="handleClearLocalCache">
                            <PhTrash size="17" />
                            Redefinir Cache Local
                        </button>
                    </div>
                </div>
            </section>
        </div>
    </div>
</template>

<style scoped>
    .settings-page {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 1rem;
    }

    .page-header h1 {
        font-size: 1.75rem;
        font-weight: 700;
        letter-spacing: -0.02em;
        margin: 0 0 0.25rem 0;
        color: var(--text-primary);
    }

    .subtitle {
        margin: 0;
        color: var(--text-secondary);
        font-size: 0.925rem;
    }

    .settings-grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: 1.25rem;
        align-items: start;
    }

    .settings-card {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 16px;
        padding: 1.6rem;
        box-shadow: var(--shadow-sm);
        display: flex;
        flex-direction: column;
        gap: 1.35rem;
        min-width: 0;
        max-width: 100%;
        overflow: hidden;
    }

    .card-top {
        display: flex;
        align-items: flex-start;
        flex-wrap: wrap;
        gap: 0.85rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid var(--border-subtle);
    }

    .icon-badge {
        width: 40px;
        height: 40px;
        border-radius: 11px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .badge-indigo {
        background: var(--primary-subtle);
        color: var(--primary-color);
    }

    .badge-green {
        background: var(--success-bg);
        color: var(--success-text);
    }

    .badge-amber {
        background: rgba(245, 158, 11, 0.12);
        color: #F59E0B;
    }

    .card-titles {
        flex: 1;
        min-width: 0;
    }

    .card-titles h2 {
        margin: 0;
        font-size: 1.05rem;
        font-weight: 700;
        color: var(--text-primary);
    }

    .card-titles p {
        margin: 3px 0 0 0;
        font-size: 0.8rem;
        color: var(--text-secondary);
    }

    .status-tag {
        font-size: 0.72rem;
        font-weight: 700;
        padding: 3px 9px;
        border-radius: 99px;
        text-transform: uppercase;
    }

    .status-tag.ok {
        background: var(--success-bg);
        color: var(--success-text);
    }

    .status-tag.warn {
        background: rgba(245, 158, 11, 0.15);
        color: #F59E0B;
    }

    .form-stack {
        display: flex;
        flex-direction: column;
        gap: 1.1rem;
    }

    .row-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.85rem;
    }

    .row-2 .input-group {
        min-width: 0;
    }

    .field-hint {
        font-size: 0.74rem;
        color: var(--text-muted);
    }

    .toggle-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        padding: 0.85rem 1rem;
        border-radius: 12px;
        background: var(--bg-elevated);
        border: 1px solid var(--border-color);
    }

    .toggle-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
        flex: 1;
    }

    .toggle-info strong {
        font-size: 0.85rem;
        color: var(--text-primary);
    }

    .toggle-info span {
        font-size: 0.76rem;
        color: var(--text-secondary);
    }

    .switch {
        width: 40px;
        height: 22px;
        border-radius: 99px;
        background-color: var(--bg-card);
        border: 1px solid var(--border-color);
        position: relative;
        cursor: pointer;
        flex-shrink: 0;
        padding: 0;
        transition: all 0.2s ease;
    }

    .switch.active {
        background-color: var(--primary-color);
        border-color: var(--primary-color);
    }

    .switch-thumb {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background-color: white;
        transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .switch.active .switch-thumb {
        transform: translateX(18px);
    }

    .card-actions-bar {
        display: flex;
        justify-content: flex-end;
    }

    /* Seletor de Tema Visual */
    .theme-cards-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.85rem;
    }

    .theme-choice {
        border: 1.5px solid var(--border-color);
        background: var(--bg-elevated);
        border-radius: 12px;
        padding: 0.9rem;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        transition: all 0.15s ease;
    }

    .theme-choice.active {
        border-color: var(--primary-color);
        background: var(--primary-subtle);
    }

    .preview-swatch {
        height: 48px;
        border-radius: 8px;
        padding: 10px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .dark-swatch {
        background: #090A0F;
    }

    .light-swatch {
        background: #F8FAFC;
        border-color: #CBD5E1;
    }

    .sw-bar {
        width: 55%;
        height: 8px;
        border-radius: 4px;
        background: #6366F1;
    }

    .sw-dot {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #10B981;
    }

    .choice-meta {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .choice-meta strong {
        font-size: 0.875rem;
        color: var(--text-primary);
    }

    .choice-meta span {
        font-size: 0.74rem;
        color: var(--text-secondary);
    }

    .data-desc {
        margin: 0;
        font-size: 0.85rem;
        line-height: 1.55;
        color: var(--text-secondary);
    }

    .data-buttons {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
    }

    .danger-outline:hover {
        border-color: var(--danger-color);
        color: var(--danger-color);
        background: var(--danger-bg);
    }

    @media (max-width: 1024px) {
        .settings-grid {
            grid-template-columns: minmax(0, 1fr);
        }
    }

    @media (max-width: 640px) {
        .page-header h1 {
            font-size: 1.4rem;
        }
        .page-header .btn-primary {
            width: 100%;
        }
        .settings-card {
            padding: 1.15rem;
        }
        .row-2,
        .theme-cards-row {
            grid-template-columns: minmax(0, 1fr);
        }
        .settings-card input,
        .settings-card select {
            width: 100%;
            min-width: 0;
        }
        .data-buttons,
        .card-actions-bar {
            flex-direction: column;
        }
        .data-buttons button,
        .card-actions-bar button {
            width: 100%;
        }
    }
</style>
