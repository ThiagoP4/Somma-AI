<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { PhFingerprint, PhSignOut, PhShieldCheck } from '@phosphor-icons/vue';
import { verifyBiometric, getBiometricConfig, clearSessionBiometricUnlocked } from '../services/biometricAuth';
import { supabase } from '../services/supabase';
import logoUrl from '../assets/somma-logo.svg';

const emit = defineEmits(['unlocked']);
const router = useRouter();

const isVerifying = ref(false);
const errorMsg = ref('');
const userEmail = ref(getBiometricConfig()?.email || '');

const triggerUnlock = async () => {
    if (isVerifying.value) return;
    isVerifying.value = true;
    errorMsg.value = '';
    try {
        const ok = await verifyBiometric();
        if (ok) {
            emit('unlocked');
        }
    } catch (err: any) {
        errorMsg.value = err?.name === 'NotAllowedError'
            ? 'Leitura cancelada. Toque no botão abaixo para tentar novamente.'
            : (err?.message || 'Não foi possível validar sua digital.');
    } finally {
        isVerifying.value = false;
    }
};

const handleFallbackLogout = async () => {
    clearSessionBiometricUnlocked();
    await supabase.auth.signOut({ scope: 'local' });
    emit('unlocked');
    await router.replace('/login?password=1');
};

onMounted(() => {
    // Dispara o sensor de digital automaticamente ao abrir o app no celular
    setTimeout(() => {
        triggerUnlock();
    }, 250);
});
</script>

<template>
    <div class="lock-overlay" role="dialog" aria-modal="true" aria-label="Desbloqueio biométrico Somma AI">
        <div class="lock-glow"></div>
        <div class="lock-card">
            <div class="lock-brand">
                <img :src="logoUrl" alt="Somma AI" class="lock-logo" />
                <span>Somma <strong>AI</strong></span>
            </div>

            <div class="finger-circle" :class="{ pulsing: isVerifying }">
                <PhFingerprint size="44" weight="duotone" />
            </div>

            <h2>Desbloqueie seu Workspace</h2>
            <p v-if="userEmail" class="lock-email">{{ userEmail }}</p>
            <p class="lock-sub">
                Use sua impressão digital ou reconhecimento facial para acessar seus dados financeiros.
            </p>

            <div v-if="errorMsg" class="lock-error">
                {{ errorMsg }}
            </div>

            <button
                type="button"
                class="btn-unlock"
                :disabled="isVerifying"
                @click="triggerUnlock"
            >
                <PhFingerprint size="20" weight="bold" />
                <span>{{ isVerifying ? 'Aguardando sensor...' : 'Usar Digital / Face ID' }}</span>
            </button>

            <button type="button" class="btn-fallback" @click="handleFallbackLogout">
                <PhSignOut size="15" />
                <span>Entrar com e-mail e senha</span>
            </button>

            <div class="lock-footer">
                <PhShieldCheck size="14" weight="fill" />
                <span>Protegido por WebAuthn (Biometria do Aparelho)</span>
            </div>
        </div>
    </div>
</template>

<style scoped>
.lock-overlay {
    position: fixed;
    inset: 0;
    z-index: 99999;
    background: var(--bg-page);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    overflow: hidden;
}

.lock-glow {
    position: absolute;
    width: 420px;
    height: 420px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(99, 102, 241, 0.22) 0%, transparent 70%);
    pointer-events: none;
}

.lock-card {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 380px;
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 22px;
    padding: 2.25rem 1.75rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.9rem;
    box-shadow: var(--shadow-md);
}

.lock-brand {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
}

.lock-brand strong {
    color: var(--primary-color);
}

.lock-logo {
    width: 28px;
    height: 28px;
}

.finger-circle {
    width: 82px;
    height: 82px;
    border-radius: 50%;
    background: var(--primary-subtle);
    border: 1.5px solid rgba(99, 102, 241, 0.35);
    color: var(--primary-color);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0.35rem 0;
}

.finger-circle.pulsing {
    animation: pulseRing 1.4s ease-in-out infinite;
}

@keyframes pulseRing {
    0%, 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.35); }
    50% { box-shadow: 0 0 0 14px rgba(99, 102, 241, 0); }
}

.lock-card h2 {
    margin: 0;
    font-size: 1.25rem;
    color: var(--text-primary);
}

.lock-email {
    margin: -0.35rem 0 0 0;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--primary-color);
}

.lock-sub {
    margin: 0;
    font-size: 0.84rem;
    color: var(--text-secondary);
    line-height: 1.45;
}

.lock-error {
    width: 100%;
    background: var(--danger-bg);
    color: var(--danger-color);
    border: 1px solid rgba(244, 63, 94, 0.25);
    border-radius: 10px;
    padding: 0.55rem 0.75rem;
    font-size: 0.78rem;
    font-weight: 500;
}

.btn-unlock {
    width: 100%;
    height: 46px;
    border-radius: 12px;
    border: none;
    background: var(--primary-gradient);
    color: white;
    font-family: inherit;
    font-size: 0.92rem;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    cursor: pointer;
    box-shadow: 0 4px 16px var(--primary-glow);
    margin-top: 0.35rem;
}

.btn-unlock:disabled {
    opacity: 0.7;
    cursor: not-allowed;
}

.btn-fallback {
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-family: inherit;
    font-size: 0.8rem;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    cursor: pointer;
    padding: 0.4rem 0.75rem;
}

.btn-fallback:hover {
    color: var(--text-primary);
}

.lock-footer {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 0.7rem;
    color: var(--text-muted);
    margin-top: 0.35rem;
}
</style>
