<script setup lang="ts">
    import { PhPlus, PhSpinner, PhSmileySad } from '@phosphor-icons/vue';

    const props = defineProps({
        title: { type: String, required: true },
        totalValue: { type: Number, default: 0 },
        buttonText: { type: String, default: 'Novo' },
        loading: { type: Boolean, default: false },
        items: { type: Array, default: () => [] } 
    });

    defineEmits(['addNew']);

</script>


<template>
    <div class="page-container">
    <header class="page-header">
        <div>
            <h1> {{ title }}</h1>
        </div>
        <div class="button-wrapper">
            <button 
                class="btn-primary-header" 
                @click="$emit('addNew')" 
                :disabled="loading" 
                :class="{ 'btn-disabled': loading }"
            >
                <PhSpinner v-if="loading" size="20" class="spin" />
                <PhPlus v-else size="20" weight="bold" />
                
                <span>{{ buttonText }}</span>
            </button>
            <slot name="actions"></slot>
        </div>
    </header>
    <main class="content-area">
        <div v-if="$slots.filters" class="filters-wrapper">
            <slot name="filters" />
        </div>
        <div v-if="loading" class="loading">
            <PhSpinner size="40" class="spin" />
            Carregando dados...
        </div>
        <div v-else-if="items.length === 0" class="state-container">
            <PhSmileySad size="40" color="var(--text-secondary)"/>
            <p>Nenhum item cadastrado ainda.</p>
            <small>Clique no botão acima para adicionar.</small>
        </div>
        <div  v-else class="records-container">
           <slot name="header" />
           <div class="records-list">
                <slot name="body" />
           </div>
        </div>
    </main>
    </div>
</template>

<style>

    .page-container {
        padding: 1rem;
        max-width: 1200px;
        margin: 0 auto;
    }

    .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
    }

    .page-header h1 {
        font-size: 1.5rem;
        color: var(--text-primary);
        margin: 0;
    }

    .btn-primary-header {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        justify-content: center;
        background-color: var(--bg-card);
        color: var(--text-secondary);
        border: 1px solid var(--border-color);
        padding: 0.8rem 1rem;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 500;
        transition: all 0.2s;
        height: 42px;
        width: auto !important;
        white-space: nowrap;
        flex-shrink: 0;
    }

    .btn-primary-header:hover:not(:disabled) {
        background-color: var(--bg-page);
        color: var(--text-primary);
        border-color: var(--text-secondary);
    }

    .button-wrapper {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .btn-disabled {
        opacity: 0.7;
        cursor: not-allowed;
        background-color: var(--bg-page); /* Ou mantenha a cor primária mais clara */
    }

    .filters-wrapper {
        margin-bottom: 1rem;
        animation: slideDown 0.2s ease-out;
    }

    .state-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 4rem 2rem;
        background-color: var(--bg-card);
        border: 1px dashed var(--border-color);
        border-radius: 12px;
        color: var(--text-secondary);
        text-align: center;
        margin-top: 1rem;
    }

    .state-container p {
        margin: 1rem 0 0.25rem 0;
        font-weight: 500;
        color: var(--text-primary);
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    @keyframes slideDown {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
    }

    .spin {
        animation: spin 1s linear infinite;
    }

</style>