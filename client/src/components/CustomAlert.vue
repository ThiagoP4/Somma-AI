<script setup lang="ts">
    import { computed } from 'vue';
    import { storeToRefs } from 'pinia';
    import { useAlertStore } from '../stores/useAlertStore';
    import { PhCheckCircle, PhXCircle, PhWarning, PhInfo, PhX } from '@phosphor-icons/vue';

    const alertStore = useAlertStore();
    const { isOpen, message, type, alertKey, durationMs } = storeToRefs(alertStore);

    const alertTitle = computed(() => {
        if (type.value === 'success') return 'Tudo certo';
        if (type.value === 'error') return 'Algo deu errado';
        if (type.value === 'warning') return 'Atenção';
        return 'Informação';
    });
</script>

<template>
    <transition name="toast-slide">
        <div
            v-if="isOpen"
            :key="alertKey"
            class="custom-alert"
            :class="type"
            role="status"
            aria-live="polite"
        >
            <div class="alert-glow" aria-hidden="true"></div>

            <div class="alert-icon-badge">
                <PhCheckCircle v-if="type === 'success'" size="20" weight="fill" />
                <PhXCircle v-else-if="type === 'error'" size="20" weight="fill" />
                <PhWarning v-else-if="type === 'warning'" size="20" weight="fill" />
                <PhInfo v-else size="20" weight="fill" />
            </div>

            <div class="alert-body">
                <strong class="alert-title">{{ alertTitle }}</strong>
                <span class="message">{{ message }}</span>
            </div>

            <button
                type="button"
                class="close-btn"
                @click="alertStore.closeAlert()"
                aria-label="Fechar notificação"
            >
                <PhX size="16" weight="bold" />
            </button>

            <div class="progress-track" aria-hidden="true">
                <div
                    class="progress-bar"
                    :style="{ animationDuration: `${durationMs}ms` }"
                ></div>
            </div>
        </div>
    </transition>
</template>

<style scoped>
    .custom-alert {
        position: fixed;
        top: calc(1.25rem + env(safe-area-inset-top, 0px));
        right: 1.5rem;
        display: flex;
        align-items: flex-start;
        gap: 0.85rem;
        padding: 0.9rem 1rem 1.05rem 0.95rem;
        border-radius: 14px;
        background: color-mix(in srgb, var(--bg-card) 92%, transparent);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        border: 1px solid var(--border-color);
        box-shadow: 0 18px 40px -10px rgba(0, 0, 0, 0.45), 0 4px 12px rgba(0, 0, 0, 0.2);
        color: var(--text-primary);
        min-width: 310px;
        max-width: 420px;
        z-index: 99999;
        overflow: hidden;
    }

    .alert-glow {
        position: absolute;
        top: -28px;
        left: -28px;
        width: 110px;
        height: 110px;
        border-radius: 50%;
        pointer-events: none;
        opacity: 0.22;
        filter: blur(14px);
    }

    .alert-icon-badge {
        position: relative;
        z-index: 1;
        width: 34px;
        height: 34px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        margin-top: 1px;
    }

    .alert-body {
        position: relative;
        z-index: 1;
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .alert-title {
        font-size: 0.8rem;
        font-weight: 700;
        letter-spacing: 0.01em;
    }

    .message {
        font-size: 0.84rem;
        font-weight: 500;
        line-height: 1.4;
        color: var(--text-secondary);
        word-break: break-word;
    }

    .close-btn {
        position: relative;
        z-index: 1;
        background: transparent;
        border: none;
        color: var(--text-muted);
        width: 28px;
        height: 28px;
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: background-color 0.15s ease, color 0.15s ease;
    }

    .close-btn:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
    }

    /* Barra de progresso regressiva na base */
    .progress-track {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        height: 3px;
        background: rgba(255, 255, 255, 0.06);
    }

    .progress-bar {
        height: 100%;
        width: 100%;
        transform-origin: left center;
        animation-name: shrinkToast;
        animation-timing-function: linear;
        animation-fill-mode: forwards;
    }

    @keyframes shrinkToast {
        from { transform: scaleX(1); }
        to { transform: scaleX(0); }
    }

    /* === VARIANTES SEMÂNTICAS === */
    .custom-alert.success {
        border-color: rgba(16, 185, 129, 0.35);
    }
    .custom-alert.success .alert-glow,
    .custom-alert.success .progress-bar {
        background: #10B981;
    }
    .custom-alert.success .alert-icon-badge {
        background: rgba(16, 185, 129, 0.16);
        color: #34D399;
    }
    .custom-alert.success .alert-title {
        color: #34D399;
    }

    .custom-alert.error {
        border-color: rgba(244, 63, 94, 0.38);
    }
    .custom-alert.error .alert-glow,
    .custom-alert.error .progress-bar {
        background: #F43F5E;
    }
    .custom-alert.error .alert-icon-badge {
        background: rgba(244, 63, 94, 0.16);
        color: #FB7185;
    }
    .custom-alert.error .alert-title {
        color: #FB7185;
    }

    .custom-alert.warning {
        border-color: rgba(245, 158, 11, 0.38);
    }
    .custom-alert.warning .alert-glow,
    .custom-alert.warning .progress-bar {
        background: #F59E0B;
    }
    .custom-alert.warning .alert-icon-badge {
        background: rgba(245, 158, 11, 0.16);
        color: #FBBF24;
    }
    .custom-alert.warning .alert-title {
        color: #FBBF24;
    }

    .custom-alert.info {
        border-color: rgba(99, 102, 241, 0.38);
    }
    .custom-alert.info .alert-glow,
    .custom-alert.info .progress-bar {
        background: #6366F1;
    }
    .custom-alert.info .alert-icon-badge {
        background: rgba(99, 102, 241, 0.16);
        color: #818CF8;
    }
    .custom-alert.info .alert-title {
        color: #818CF8;
    }

    /* Animação fluida estilo macOS / Linear */
    .toast-slide-enter-active {
        transition: all 0.28s cubic-bezier(0.22, 1, 0.36, 1);
    }
    .toast-slide-leave-active {
        transition: all 0.2s ease-in;
    }
    .toast-slide-enter-from {
        transform: translateY(-14px) scale(0.96);
        opacity: 0;
    }
    .toast-slide-leave-to {
        transform: translateY(-10px) scale(0.97);
        opacity: 0;
    }

    @media (max-width: 640px) {
        .custom-alert {
            top: calc(0.85rem + env(safe-area-inset-top, 0px));
            left: 0.85rem;
            right: 0.85rem;
            min-width: auto;
            max-width: none;
        }
    }
</style>
