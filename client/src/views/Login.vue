<script setup lang="ts">
    import { ref, onMounted } from 'vue';
    import { useRouter } from 'vue-router';
    import { supabase } from '../services/supabase';
    import {
        PhEnvelope, PhLockKey, PhArrowRight, PhUser, PhPhone,
        PhEye, PhEyeSlash, PhSparkle, PhShieldCheck, PhChartLineUp, PhCheckCircle, PhFingerprint,
        PhDeviceMobile, PhDownloadSimple
    } from '@phosphor-icons/vue';
    import { useAlertStore } from '../stores/useAlertStore';
    import { useAppDownload } from '../composables/useAppDownload';
    import {
        getBiometricConfig,
        isBiometricSupported,
        registerBiometricForCurrentUser,
        loginWithBiometric,
        syncBiometricSessionToken,
        markSessionBiometricUnlocked
    } from '../services/biometricAuth';
    import logoUrl from '../assets/somma-logo.svg';

    const { showAlert } = useAlertStore();
    const { isAndroidWeb, latestVersion, apkDownloadUrl, deferredPwaPrompt, installDesktopApp } = useAppDownload();

    const router = useRouter();
    const loading = ref(false);
    const isSignUp = ref(false);
    const showPassword = ref(false);
    const email = ref('');
    const password = ref('');
    const errorMessage = ref('');
    const firstName = ref('');
    const lastName = ref('');  
    const phone = ref('');

    const canUseBiometricLogin = ref(false);
    const isBiometricFirstView = ref(false);
    const deviceSupportsBiometric = ref(false);
    const showBiometricPrompt = ref(false);
    const biometricEmail = ref('');
    const biometricLoading = ref(false);

    onMounted(async () => {
        const cfg = getBiometricConfig();
        const supported = await isBiometricSupported();
        deviceSupportsBiometric.value = supported;
        if (cfg?.enabled && supported) {
            canUseBiometricLogin.value = true;
            isBiometricFirstView.value = true;
            biometricEmail.value = cfg.email;
            // Estilo Nubank / Mercado Pago: já solicita a digital automaticamente ao abrir!
            setTimeout(() => {
                if (isBiometricFirstView.value) {
                    handleBiometricLogin();
                }
            }, 250);
        }
    });

    const handleActivateBiometricAfterLogin = async () => {
        biometricLoading.value = true;
        try {
            await registerBiometricForCurrentUser(true);
            showAlert('Digital ativada! Nas próximas vezes, entre apenas encostando o dedo.', 'success');
        } catch (err: any) {
            showAlert(
                err?.name === 'NotAllowedError'
                    ? 'Cadastro da digital cancelado. Você pode ativar depois nas Configurações.'
                    : (err?.message || 'Não foi possível ativar a digital agora.'),
                'warning'
            );
        } finally {
            biometricLoading.value = false;
            showBiometricPrompt.value = false;
            await router.replace('/');
        }
    };

    const handleSkipBiometricPrompt = async () => {
        showBiometricPrompt.value = false;
        await router.replace('/');
    };

    const handleBiometricLogin = async () => {
        biometricLoading.value = true;
        errorMessage.value = '';
        try {
            await loginWithBiometric();
            localStorage.setItem('lastActivity', Date.now().toString());
            showAlert('Autenticado com digital!', 'success');
            await router.replace('/');
        } catch (err: any) {
            errorMessage.value = err?.name === 'NotAllowedError'
                ? 'Leitura biométrica cancelada.'
                : (err?.message || 'Não foi possível entrar com a digital.');
        } finally {
            biometricLoading.value = false;
        }
    };

    const switchMode = (signup: boolean) => {
        isSignUp.value = signup;
        errorMessage.value = '';
    };

    const handleAuth = async () => {
        loading.value = true;
        errorMessage.value = '';

        const cleanEmail = email.value.trim();

        try {
            if (isSignUp.value) {
                const { error: authError } = await supabase.auth.signUp({
                    email: cleanEmail,
                    password: password.value,
                    options: {
                        data: {
                            first_name: firstName.value,
                            last_name: lastName.value,
                            phone: phone.value
                        }
                    }
                });
                if (authError) throw authError;
                showAlert('Cadastro realizado! Verifique seu email para confirmar a conta.', 'success');
                isSignUp.value = false;
            } else {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: cleanEmail,
                    password: password.value,
                });
                if (error) throw error;
                if (data.session?.user) {
                    syncBiometricSessionToken(data.session.user.id, data.session.refresh_token);
                }
                localStorage.setItem('lastActivity', Date.now().toString());
                markSessionBiometricUnlocked();

                // Se o aparelho suporta digital/Face ID e ainda não está ativado, pergunta na hora (estilo Nubank/Inter)!
                const existingBio = getBiometricConfig();
                if (deviceSupportsBiometric.value && !existingBio?.enabled) {
                    showBiometricPrompt.value = true;
                    return;
                }

                showAlert('Login realizado com sucesso!', 'success');
                await router.replace('/');
            }
        } catch (error) {
            console.error('Erro de autenticação:', error);
            errorMessage.value = 'Credenciais inválidas ou erro na conexão. Verifique seus dados e tente novamente.';
        } finally {
            loading.value = false;
        }
    };
</script>

<template>
    <div class="login-page">
        <!-- Lado Esquerdo: Showcase Visual & Identidade Somma AI -->
        <aside class="brand-showcase">
            <div class="ambient-glow glow-1"></div>
            <div class="ambient-glow glow-2"></div>
            <div class="grid-pattern"></div>

            <div class="showcase-top">
                <div class="brand-logo">
                    <img :src="logoUrl" alt="Somma Logo" class="logo-img" />
                    <span class="brand-name">Somma</span>
                    <span class="brand-badge">AI</span>
                </div>
            </div>

            <div class="showcase-center">
                <div class="pill-tag">
                    <PhSparkle size="14" weight="fill" />
                    <span>Inteligência Financeira Pessoal</span>
                </div>
                <h2 class="hero-title">
                    Domine seu fluxo de caixa com clareza absoluta.
                </h2>
                <p class="hero-subtitle">
                    Gerencie faturas de cartões, metas em cofrinhos e receba insights em tempo real do seu assistente financeiro com IA.
                </p>

                <!-- Preview Floating Cards -->
                <div class="preview-stack">
                    <div class="preview-card main-preview">
                        <div class="preview-header">
                            <span class="preview-label">Patrimônio & Liquidez</span>
                            <span class="preview-trend">
                                <PhChartLineUp size="14" weight="bold" /> +18.4% este mês
                            </span>
                        </div>
                        <div class="preview-balance">R$ 23.183,60</div>
                        <div class="preview-bars">
                            <div class="p-bar" style="height: 38%"></div>
                            <div class="p-bar" style="height: 52%"></div>
                            <div class="p-bar" style="height: 45%"></div>
                            <div class="p-bar" style="height: 70%"></div>
                            <div class="p-bar" style="height: 62%"></div>
                            <div class="p-bar active" style="height: 95%"></div>
                        </div>
                    </div>

                    <div class="preview-features">
                        <div class="feature-item">
                            <PhCheckCircle size="18" weight="fill" class="feat-icon" />
                            <span>Controle automático por ciclo de fatura</span>
                        </div>
                        <div class="feature-item">
                            <PhCheckCircle size="18" weight="fill" class="feat-icon" />
                            <span>Cofrinhos inteligentes que compõem saldo</span>
                        </div>
                        <div class="feature-item">
                            <PhShieldCheck size="18" weight="fill" class="feat-icon" />
                            <span>Criptografia ponta a ponta com Supabase Auth</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="showcase-footer">
                <span>© {{ new Date().getFullYear() }} Somma AI • Workspace Financeiro</span>
            </div>
        </aside>

        <!-- Lado Direito: Formulário de Autenticação -->
        <main class="auth-panel">
            <div class="auth-box">
                <!-- Logo visível apenas no mobile -->
                <div class="mobile-brand">
                    <img :src="logoUrl" alt="Somma Logo" class="logo-img" />
                    <span class="brand-name">Somma</span>
                    <span class="brand-badge">AI</span>
                </div>

                <!-- MODO 1 (ESTILO NUBANK / MERCADO PAGO): TELA SUPER SIMPLIFICADA QUANDO TEM DIGITAL -->
                <div v-if="isBiometricFirstView" class="biometric-first-box">
                    <div class="bf-finger-circle" :class="{ pulsing: biometricLoading }">
                        <PhFingerprint size="46" weight="duotone" />
                    </div>
                    <h1>Olá novamente</h1>
                    <span class="bf-email-pill">{{ biometricEmail }}</span>
                    <p class="bf-subtitle">
                        {{ biometricLoading ? 'Confirme sua digital ou Face ID para entrar...' : 'Toque abaixo para desbloquear sua conta com biometria.' }}
                    </p>

                    <div v-if="errorMessage" class="error-banner" style="width: 100%; text-align: left;">
                        {{ errorMessage }}
                    </div>

                    <button
                        type="button"
                        class="submit-btn"
                        style="width: 100%;"
                        :disabled="biometricLoading"
                        @click="handleBiometricLogin"
                    >
                        <PhFingerprint size="20" weight="bold" />
                        <span>{{ biometricLoading ? 'Aguardando sensor...' : 'Entrar com Digital / Face ID' }}</span>
                    </button>

                    <button
                        type="button"
                        class="btn-skip-bio"
                        :disabled="biometricLoading"
                        @click="isBiometricFirstView = false; errorMessage = ''"
                    >
                        Usar e-mail e senha ou criar conta
                    </button>
                </div>

                <!-- MODO 2: FORMULÁRIO PADRÃO DE E-MAIL / SENHA / CADASTRO -->
                <template v-else>
                    <div class="auth-header">
                        <h1>{{ isSignUp ? 'Criar nova conta' : 'Bem-vindo de volta' }}</h1>
                        <p>{{ isSignUp ? 'Comece a organizar sua vida financeira em segundos.' : 'Insira suas credenciais para acessar seu workspace.' }}</p>
                    </div>

                    <!-- Segmented Switcher: Entrar vs Criar Conta -->
                    <div class="auth-tabs">
                        <button
                            type="button"
                            class="auth-tab"
                            :class="{ active: !isSignUp }"
                            @click="switchMode(false)"
                        >
                            Entrar
                        </button>
                        <button
                            type="button"
                            class="auth-tab"
                            :class="{ active: isSignUp }"
                            @click="switchMode(true)"
                        >
                            Criar conta
                        </button>
                    </div>

                    <form @submit.prevent="handleAuth" class="auth-form">
                    <template v-if="isSignUp">
                        <div class="form-row">
                            <div class="field-group">
                                <label for="firstName">Nome</label>
                                <div class="input-box">
                                    <PhUser size="18" class="field-icon" />
                                    <input
                                        id="firstName"
                                        type="text"
                                        v-model="firstName"
                                        placeholder="Thiago"
                                        required
                                    />
                                </div>
                            </div>
                            <div class="field-group">
                                <label for="lastName">Sobrenome</label>
                                <div class="input-box">
                                    <input
                                        id="lastName"
                                        type="text"
                                        v-model="lastName"
                                        placeholder="Silva"
                                        required
                                        class="no-left-icon"
                                    />
                                </div>
                            </div>
                        </div>

                        <div class="field-group">
                            <label for="phone">WhatsApp / Telefone</label>
                            <div class="input-box">
                                <PhPhone size="18" class="field-icon" />
                                <input
                                    id="phone"
                                    type="tel"
                                    v-model="phone"
                                    placeholder="(27) 99999-9999"
                                    required
                                />
                            </div>
                        </div>
                    </template>

                    <div class="field-group">
                        <label for="email">E-mail</label>
                        <div class="input-box">
                            <PhEnvelope size="18" class="field-icon" />
                            <input
                                id="email"
                                type="email"
                                v-model="email"
                                placeholder="voce@exemplo.com"
                                required
                                autocomplete="email"
                            />
                        </div>
                    </div>

                    <div class="field-group">
                        <label for="password">Senha</label>
                        <div class="input-box">
                            <PhLockKey size="18" class="field-icon" />
                            <input
                                id="password"
                                :type="showPassword ? 'text' : 'password'"
                                v-model="password"
                                placeholder="Mínimo de 8 caracteres"
                                required
                                minlength="8"
                                autocomplete="current-password"
                                class="has-right-btn"
                            />
                            <button
                                type="button"
                                class="eye-btn"
                                @click="showPassword = !showPassword"
                                tabindex="-1"
                                :title="showPassword ? 'Ocultar senha' : 'Mostrar senha'"
                            >
                                <PhEyeSlash v-if="showPassword" size="18" />
                                <PhEye v-else size="18" />
                            </button>
                        </div>
                    </div>

                    <div v-if="errorMessage" class="error-banner">
                        {{ errorMessage }}
                    </div>

                    <button type="submit" class="submit-btn" :disabled="loading">
                        <span v-if="loading">Autenticando...</span>
                        <template v-else>
                            <span>{{ isSignUp ? 'Concluir cadastro' : 'Acessar painel' }}</span>
                            <PhArrowRight size="18" weight="bold" />
                        </template>
                    </button>

                    <button
                        v-if="!isSignUp && canUseBiometricLogin"
                        type="button"
                        class="btn-skip-bio"
                        @click="isBiometricFirstView = true; handleBiometricLogin()"
                    >
                        Voltar para desbloqueio com Digital
                    </button>
                </form>

                <div class="auth-footer">
                    <p>
                        {{ isSignUp ? 'Já possui uma conta?' : 'Ainda não tem acesso?' }}
                        <a href="#" @click.prevent="switchMode(!isSignUp)">
                            {{ isSignUp ? 'Fazer login' : 'Cadastre-se gratuitamente' }}
                        </a>
                    </p>
                </div>
                </template>

                <!-- Card de Download: mostra APK apenas no Android Web, ou "Instalar no PC" no Desktop quando suportado -->
                <div v-if="isAndroidWeb || deferredPwaPrompt" class="app-download-card">
                    <div class="adc-left">
                        <div class="adc-icon">
                            <PhDeviceMobile size="20" weight="duotone" />
                        </div>
                        <div class="adc-info">
                            <strong>{{ isAndroidWeb ? 'Baixar App Android' : 'Instalar Somma no PC' }}</strong>
                            <span>{{ isAndroidWeb ? `APK Direto (${latestVersion})` : 'Abre como aplicativo na sua área de trabalho' }}</span>
                        </div>
                    </div>
                    <div class="adc-actions">
                        <a
                            v-if="isAndroidWeb"
                            :href="apkDownloadUrl"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="adc-btn"
                        >
                            <PhDownloadSimple size="15" weight="bold" />
                            <span>Baixar APK</span>
                        </a>
                        <button
                            v-else-if="deferredPwaPrompt"
                            type="button"
                            class="adc-btn"
                            @click="installDesktopApp"
                        >
                            <PhDownloadSimple size="15" weight="bold" />
                            <span>Instalar</span>
                        </button>
                    </div>
                </div>
            </div>
        </main>

        <!-- Prompt Instantâneo Pós-Login: Ativar Digital / Face ID -->
        <div v-if="showBiometricPrompt" class="bio-prompt-overlay" role="dialog" aria-modal="true" aria-label="Ativar login por digital">
            <div class="bio-prompt-card">
                <div class="bio-prompt-icon">
                    <PhFingerprint size="40" weight="duotone" />
                </div>
                <h3>Ativar login com Digital / Face ID?</h3>
                <p>
                    Da próxima vez que abrir o Somma neste aparelho, você entra em 1 segundo sem precisar digitar e-mail e senha.
                </p>
                <div class="bio-prompt-actions">
                    <button
                        type="button"
                        class="submit-btn"
                        :disabled="biometricLoading"
                        @click="handleActivateBiometricAfterLogin"
                    >
                        <PhFingerprint size="20" weight="bold" />
                        <span>{{ biometricLoading ? 'Aguardando sensor...' : 'Ativar Digital Agora' }}</span>
                    </button>
                    <button
                        type="button"
                        class="btn-skip-bio"
                        :disabled="biometricLoading"
                        @click="handleSkipBiometricPrompt"
                    >
                        Agora não, ir para o app
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
    .login-page {
        min-height: 100vh;
        width: 100%;
        display: grid;
        grid-template-columns: 1.1fr 1fr;
        background-color: #090A0F;
        color: #F8FAFC;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }

    /* =========================================
       LADO ESQUERDO: SHOWCASE VISUAL
       ========================================= */
    .brand-showcase {
        position: relative;
        overflow: hidden;
        padding: 3rem 4rem;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        background: radial-gradient(120% 100% at 0% 0%, #131629 0%, #090A0F 70%);
        border-right: 1px solid rgba(255, 255, 255, 0.07);
    }

    .ambient-glow {
        position: absolute;
        border-radius: 50%;
        filter: blur(90px);
        pointer-events: none;
        z-index: 0;
    }

    .glow-1 {
        width: 420px;
        height: 420px;
        background: rgba(99, 102, 241, 0.18);
        top: -120px;
        left: -100px;
    }

    .glow-2 {
        width: 360px;
        height: 360px;
        background: rgba(139, 92, 246, 0.14);
        bottom: -80px;
        right: -60px;
    }

    .grid-pattern {
        position: absolute;
        inset: 0;
        background-image: 
            linear-gradient(to right, rgba(255, 255, 255, 0.025) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.025) 1px, transparent 1px);
        background-size: 40px 40px;
        mask-image: radial-gradient(ellipse at center, black 35%, transparent 80%);
        -webkit-mask-image: radial-gradient(ellipse at center, black 35%, transparent 80%);
        pointer-events: none;
        z-index: 0;
    }

    .showcase-top,
    .showcase-center,
    .showcase-footer {
        position: relative;
        z-index: 1;
    }

    .brand-logo {
        display: inline-flex;
        align-items: center;
        gap: 0.65rem;
    }

    .logo-img {
        width: 34px;
        height: 34px;
        object-fit: contain;
    }

    .brand-name {
        font-size: 1.25rem;
        font-weight: 700;
        letter-spacing: -0.03em;
        color: #F8FAFC;
    }

    .brand-badge {
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        padding: 2px 7px;
        border-radius: 6px;
        background: rgba(99, 102, 241, 0.15);
        color: #818CF8;
        border: 1px solid rgba(99, 102, 241, 0.3);
    }

    .showcase-center {
        max-width: 520px;
        margin: auto 0;
    }

    .pill-tag {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        padding: 5px 12px;
        border-radius: 99px;
        background: rgba(99, 102, 241, 0.12);
        border: 1px solid rgba(99, 102, 241, 0.28);
        color: #A5B4FC;
        font-size: 0.78rem;
        font-weight: 600;
        margin-bottom: 1.25rem;
    }

    .hero-title {
        font-size: 2.35rem;
        font-weight: 800;
        line-height: 1.15;
        letter-spacing: -0.03em;
        color: #FFFFFF;
        margin: 0 0 1rem 0;
    }

    .hero-subtitle {
        font-size: 1rem;
        line-height: 1.6;
        color: #94A3B8;
        margin: 0 0 2.25rem 0;
    }

    /* Card Flutuante de Preview */
    .preview-stack {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .preview-card {
        background: rgba(18, 20, 28, 0.75);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.09);
        border-radius: 16px;
        padding: 1.5rem;
        box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.6);
    }

    .preview-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
    }

    .preview-label {
        font-size: 0.8rem;
        font-weight: 500;
        color: #94A3B8;
    }

    .preview-trend {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.75rem;
        font-weight: 600;
        color: #34D399;
        background: rgba(16, 185, 129, 0.12);
        padding: 3px 8px;
        border-radius: 99px;
    }

    .preview-balance {
        font-size: 1.9rem;
        font-weight: 800;
        letter-spacing: -0.03em;
        color: #F8FAFC;
        margin-bottom: 1.25rem;
        font-feature-settings: "tnum";
    }

    .preview-bars {
        display: flex;
        align-items: flex-end;
        gap: 10px;
        height: 54px;
    }

    .p-bar {
        flex: 1;
        background: rgba(99, 102, 241, 0.22);
        border-radius: 6px 6px 2px 2px;
        transition: height 0.3s ease;
    }

    .p-bar.active {
        background: linear-gradient(180deg, #818CF8 0%, #6366F1 100%);
        box-shadow: 0 0 16px rgba(99, 102, 241, 0.45);
    }

    .preview-features {
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
    }

    .feature-item {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        font-size: 0.875rem;
        color: #CBD5E1;
        font-weight: 500;
    }

    .feat-icon {
        color: #6366F1;
        flex-shrink: 0;
    }

    .showcase-footer {
        font-size: 0.78rem;
        color: #64748B;
    }

    /* =========================================
       LADO DIREITO: PAINEL DE AUTENTICAÇÃO
       ========================================= */
    .auth-panel {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2.5rem;
        background-color: var(--bg-page);
        color: var(--text-primary);
    }

    .auth-box {
        width: 100%;
        max-width: 420px;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .mobile-brand {
        display: none;
        align-items: center;
        gap: 0.55rem;
        margin-bottom: 0.5rem;
    }

    .auth-header h1 {
        font-size: 1.75rem;
        font-weight: 800;
        letter-spacing: -0.025em;
        color: var(--text-primary);
        margin: 0 0 0.4rem 0;
    }

    .auth-header p {
        font-size: 0.925rem;
        color: var(--text-secondary);
        margin: 0;
        line-height: 1.5;
    }

    /* Segmented Tabs (Entrar / Criar conta) */
    .auth-tabs {
        display: grid;
        grid-template-columns: 1fr 1fr;
        background-color: var(--bg-card);
        padding: 4px;
        border-radius: 12px;
        border: 1px solid var(--border-color);
        gap: 4px;
    }

    .auth-tab {
        background: transparent;
        border: none;
        color: var(--text-secondary);
        font-family: inherit;
        font-size: 0.875rem;
        font-weight: 600;
        padding: 0.6rem;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .auth-tab:hover {
        color: var(--text-primary);
    }

    .auth-tab.active {
        background-color: var(--primary-subtle);
        color: var(--primary-color);
    }

    /* Formulário */
    .auth-form {
        display: flex;
        flex-direction: column;
        gap: 1.15rem;
    }

    .form-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.85rem;
    }

    .field-group {
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
    }

    .field-group label {
        font-size: 0.825rem;
        font-weight: 600;
        color: var(--text-secondary);
    }

    .input-box {
        position: relative;
        display: flex;
        align-items: center;
    }

    .field-icon {
        position: absolute;
        left: 14px;
        color: var(--text-muted);
        pointer-events: none;
        transition: color 0.15s ease;
    }

    .input-box:focus-within .field-icon {
        color: var(--primary-color);
    }

    .input-box input {
        width: 100%;
        height: 44px;
        padding: 0 1rem 0 42px;
        border-radius: 10px;
        border: 1px solid var(--border-color);
        background-color: var(--bg-card);
        color: var(--text-primary);
        font-size: 0.925rem;
        font-family: inherit;
        transition: all 0.15s ease;
    }

    .input-box input.no-left-icon {
        padding-left: 1rem;
    }

    .input-box input.has-right-btn {
        padding-right: 42px;
    }

    .input-box input:focus {
        outline: none;
        border-color: var(--primary-color);
        box-shadow: 0 0 0 3px var(--primary-subtle);
    }

    .input-box input::placeholder {
        color: var(--text-muted);
        opacity: 0.8;
    }

    .eye-btn {
        position: absolute;
        right: 10px;
        width: 30px;
        height: 30px;
        border-radius: 7px;
        background: transparent;
        border: none;
        color: var(--text-muted);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: color 0.15s ease, background-color 0.15s ease;
    }

    .eye-btn:hover {
        color: var(--text-primary);
        background-color: var(--bg-hover);
    }

    .error-banner {
        background-color: var(--danger-bg);
        border: 1px solid rgba(244, 63, 94, 0.25);
        color: var(--danger-text);
        padding: 0.75rem 1rem;
        border-radius: 10px;
        font-size: 0.825rem;
        font-weight: 500;
        line-height: 1.4;
    }

    .submit-btn {
        margin-top: 0.35rem;
        height: 46px;
        width: 100%;
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        background: var(--primary-gradient);
        color: #FFFFFF;
        font-family: inherit;
        font-size: 0.95rem;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        cursor: pointer;
        box-shadow: 0 4px 16px var(--primary-glow);
        transition: transform 0.15s ease, box-shadow 0.2s ease, opacity 0.2s ease;
    }

    .submit-btn:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 6px 22px var(--primary-glow);
        opacity: 0.96;
    }

    .submit-btn:active:not(:disabled) {
        transform: translateY(0);
    }

    .submit-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        box-shadow: none;
    }

    .biometric-divider {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        color: var(--text-muted);
        font-size: 0.75rem;
        margin: 0.25rem 0;
    }

    .biometric-divider::before,
    .biometric-divider::after {
        content: '';
        flex: 1;
        height: 1px;
        background: var(--border-color);
    }

    .biometric-btn {
        width: 100%;
        padding: 0.7rem 1rem;
        border-radius: 12px;
        border: 1px solid rgba(99, 102, 241, 0.35);
        background: var(--primary-subtle);
        color: var(--text-primary);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        cursor: pointer;
        font-family: inherit;
        transition: all 0.15s ease;
    }

    .biometric-btn:hover:not(:disabled) {
        background: rgba(99, 102, 241, 0.22);
        border-color: var(--primary-color);
    }

    .biometric-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .bio-btn-text {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        line-height: 1.25;
    }

    .bio-btn-text strong {
        font-size: 0.875rem;
        color: var(--primary-color);
    }

    .bio-btn-text small {
        font-size: 0.72rem;
        color: var(--text-secondary);
    }

    /* Tela Super Simplificada de Digital (Estilo Nubank / Mercado Pago) */
    .biometric-first-box {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 0.85rem;
        padding: 1rem 0 0.5rem;
    }

    .bf-finger-circle {
        width: 84px;
        height: 84px;
        border-radius: 50%;
        background: var(--primary-subtle);
        border: 1.5px solid rgba(99, 102, 241, 0.4);
        color: var(--primary-color);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 0.25rem;
    }

    .bf-finger-circle.pulsing {
        animation: bfPulse 1.4s ease-in-out infinite;
    }

    @keyframes bfPulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.35); }
        50% { box-shadow: 0 0 0 14px rgba(99, 102, 241, 0); }
    }

    .biometric-first-box h1 {
        margin: 0;
        font-size: 1.6rem;
        color: var(--text-primary);
    }

    .bf-email-pill {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 99px;
        background: var(--bg-elevated);
        border: 1px solid var(--border-color);
        font-size: 0.78rem;
        font-weight: 600;
        color: var(--text-secondary);
    }

    .bf-subtitle {
        margin: 0 0 0.4rem 0;
        font-size: 0.86rem;
        color: var(--text-secondary);
        line-height: 1.45;
    }

    /* Prompt Pós-Login de Biometria */
    .bio-prompt-overlay {
        position: fixed;
        inset: 0;
        z-index: 9999;
        background: rgba(9, 10, 15, 0.78);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.25rem;
    }

    .bio-prompt-card {
        width: 100%;
        max-width: 390px;
        background: var(--bg-card);
        border: 1px solid rgba(99, 102, 241, 0.35);
        border-radius: 20px;
        padding: 2rem 1.5rem;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 0.85rem;
        box-shadow: var(--shadow-md);
    }

    .bio-prompt-icon {
        width: 72px;
        height: 72px;
        border-radius: 50%;
        background: var(--primary-subtle);
        border: 1px solid rgba(99, 102, 241, 0.35);
        color: var(--primary-color);
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .bio-prompt-card h3 {
        margin: 0;
        font-size: 1.15rem;
        color: var(--text-primary);
    }

    .bio-prompt-card p {
        margin: 0;
        font-size: 0.85rem;
        line-height: 1.45;
        color: var(--text-secondary);
    }

    .bio-prompt-actions {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-top: 0.4rem;
    }

    .btn-skip-bio {
        width: 100%;
        padding: 0.65rem;
        border-radius: 10px;
        background: transparent;
        border: 1px solid var(--border-color);
        color: var(--text-secondary);
        font-family: inherit;
        font-size: 0.82rem;
        font-weight: 600;
        cursor: pointer;
    }

    .btn-skip-bio:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
    }

    /* Card de Download Direto do App na Tela de Login */
    .app-download-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        padding: 0.8rem 0.95rem;
        border-radius: 14px;
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        margin-top: 0.25rem;
    }

    .adc-left {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        min-width: 0;
    }

    .adc-icon {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        background: var(--primary-subtle);
        color: var(--primary-color);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .adc-info {
        display: flex;
        flex-direction: column;
        gap: 1px;
        min-width: 0;
    }

    .adc-info strong {
        font-size: 0.82rem;
        color: var(--text-primary);
    }

    .adc-info span {
        font-size: 0.7rem;
        color: var(--text-secondary);
    }

    .adc-actions {
        display: flex;
        gap: 0.4rem;
        flex-shrink: 0;
    }

    .adc-btn {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 0.45rem 0.75rem;
        border-radius: 9px;
        background: var(--primary-color);
        color: white;
        text-decoration: none;
        border: none;
        font-family: inherit;
        font-size: 0.75rem;
        font-weight: 700;
        cursor: pointer;
        transition: background-color 0.15s ease;
    }

    .adc-btn:hover {
        background: var(--primary-hover);
    }

    .adc-btn.pwa-btn {
        background: var(--bg-elevated);
        color: var(--text-primary);
        border: 1px solid var(--border-color);
    }

    .auth-footer {
        text-align: center;
        font-size: 0.875rem;
        color: var(--text-secondary);
        padding-top: 0.5rem;
        border-top: 1px solid var(--border-color);
    }

    .auth-footer p {
        margin: 0;
    }

    .auth-footer a {
        color: var(--primary-color);
        font-weight: 600;
        text-decoration: none;
        margin-left: 4px;
    }

    .auth-footer a:hover {
        text-decoration: underline;
    }

    /* Responsividade Tablet / Mobile */
    @media (max-width: 960px) {
        .login-page {
            grid-template-columns: 1fr;
        }

        .brand-showcase {
            display: none;
        }

        .mobile-brand {
            display: inline-flex;
        }

        .auth-panel {
            padding: 2rem 1.25rem;
        }
    }

    @media (max-width: 480px) {
        .form-row {
            grid-template-columns: 1fr;
        }
    }
</style>
