<script setup lang="ts">
    import { storeToRefs } from 'pinia';
    import { useAlertStore } from '../stores/useAlertStore';
    import { PhCheckCircle, PhWarningCircle, PhX } from '@phosphor-icons/vue';

    const alertStore = useAlertStore();
    const { isOpen, message, type } = storeToRefs(alertStore);
    
</script>

<template>
    <transition name="slide-fade">
        <div v-if="isOpen" class="custom-alert" :class="type">
            <div class="alert-icon">
                <PhCheckCircle v-if="type === 'success'" size="24" weight="fill" />
                <PhWarningCircle v-else-if="type === 'error'" size="24" weight="fill" />
            </div>
            <span class="message">{{ message }}</span>
            <button class="close-btn" @click="alertStore.closeAlert()">
                <PhX size="20" weight="bold" />
            </button>
        </div>
    </transition>
</template>
<style scoped>
    .custom-alert {
        position: fixed;
        top: 2rem;
        right: 2rem;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        background-color: var(--bg-card);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
        border-left: 6px solid;
        color: var(--text-primary);
        min-width: 300px;
        z-index: 99999;
    }

    .custom-alert.success {
       border-left-color: #10B981;
    }
    .custom-alert.success .alert-icon {
        color: #10B981;
    }

    .custom-alert.error {
        border-left-color: #f44336; /* Vermelho para erro */
    }
    .custom-alert.error .alert-icon {
        color: #f44336;
    }

    .custom-alert.warning {
        border-left-color: #F59E0B; /* Laranja para aviso */
    }
    .custom-alert.warning .alert-icon {
        color: #F59E0B;
    }

    .message {
        font-weight: 500;
        flex: 1;
        font-size: 0.95rem;
    }

    .close-btn {
        background: transparent;
        border: none;
        color: var(--text-secondary);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .close-btn:hover {
        color: var(--text-primary);
    }

    /* Animação de entrada/saída */
    .slide-fade-enter-active, .slide-fade-leave-active { transition: all 0.3s ease; }
    .slide-fade-enter-from { transform: translateX(100%); opacity: 0; }
    .slide-fade-leave-to { transform: translateX(100%); opacity: 0; }

    @media (max-width: 640px) {
        .custom-alert {
            top: 1rem; left: 1rem; right: 1rem; min-width: auto;
        }
    }

</style>