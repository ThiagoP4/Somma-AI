<script setup lang="ts">
    import { PhPlus, PhSpinner, PhSmileySad } from '@phosphor-icons/vue';

    defineProps({
        title: { type: String, required: true },
        totalValue: { type: Number, default: 0 },
        buttonText: { type: String, default: 'Novo' },
        loading: { type: Boolean, default: false },
        items: { type: Array, default: () => [] } 
    });

    defineEmits(['addNew']);
</script>

<template>
    <div class="list-layout">
        <header class="page-header">
            <div class="title-area">
                <h1>{{ title }}</h1>
            </div>
            <div class="button-wrapper">
                <button 
                    class="btn-primary" 
                    @click="$emit('addNew')" 
                    :disabled="loading"
                >
                    <PhSpinner v-if="loading" size="18" class="spin" />
                    <PhPlus v-else size="18" weight="bold" />
                    <span>{{ buttonText }}</span>
                </button>
                <slot name="actions"></slot>
            </div>
        </header>

        <div class="list-body">
            <div v-if="$slots.filters" class="filters-wrapper">
                <slot name="filters" />
            </div>

            <div v-if="loading" class="loading-state">
                <PhSpinner size="36" class="spin" />
                <span>Carregando dados...</span>
            </div>

            <div v-else-if="items.length === 0" class="state-container">
                <PhSmileySad size="42" color="var(--text-secondary)" />
                <p>Nenhum item cadastrado ainda.</p>
                <small>Clique em "{{ buttonText }}" acima para adicionar o primeiro registro.</small>
            </div>

            <div v-else class="records-container">
                <slot name="header" />
                <div class="records-list">
                    <slot name="body" />
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
    .list-layout {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
    }

    .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
    }

    .page-header h1 {
        font-size: 1.75rem;
        font-weight: 700;
        letter-spacing: -0.02em;
        color: var(--text-primary);
        margin: 0;
    }

    .button-wrapper {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    .filters-wrapper {
        margin-bottom: 1rem;
        animation: slideDown 0.2s ease-out;
    }

    .loading-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        padding: 4rem 2rem;
        color: var(--text-secondary);
        font-weight: 500;
    }

    .state-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 4rem 2rem;
        background-color: var(--bg-card);
        border: 1px dashed var(--border-color);
        border-radius: 16px;
        color: var(--text-secondary);
        text-align: center;
    }

    .state-container p {
        margin: 0.85rem 0 0.25rem 0;
        font-weight: 600;
        font-size: 1rem;
        color: var(--text-primary);
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    @keyframes slideDown {
        from { opacity: 0; transform: translateY(-8px); }
        to { opacity: 1; transform: translateY(0); }
    }

    .spin {
        animation: spin 1s linear infinite;
    }

    @media (max-width: 640px) {
        .page-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.85rem;
        }

        .page-header h1 {
            font-size: 1.4rem;
        }

        .button-wrapper {
            width: 100%;
            gap: 0.5rem;
            flex-wrap: wrap;
        }

        .button-wrapper :deep(button) {
            flex: 1 1 auto;
            min-width: 0;
            padding: 0.55rem 0.7rem;
            font-size: 0.82rem;
            height: 38px;
        }
    }
</style>
