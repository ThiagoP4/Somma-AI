<script setup lang="ts">
    import { PhPlus, PhSpinner, PhSmileySad } from '@phosphor-icons/vue';

    const props = defineProps({
        title: { type: String, required: true },
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
        <button @click="$emit('addNew')" class="btn-primary">
            <PhPlus size="20" weight="bold" /> {{ buttonText }}
        </button>
    </header>
    <main class="content-area">
        <div v-if="loading" class="loading">
            <PhSpinner size="40" class="spin" />
            Carregando dados...
        </div>
        <div v-else-if="items.length === 0" class="state-container">
            <PhSmileySad size="40" color="var(--text-secondary)"/>
            <p>Nenhum item cadastrado ainda.</p>
            <small>Clique no botão acima para adicionar.</small>
        </div>
        <div v-else class="table-wrapper">
            <table class="standard-table">
                <thead>
                    <slot name="header" />
                </thead>
                <tbody>
                    <slot name="body" />
                </tbody>
            </table>
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

    .btn-primary {
        display: flex;
        align-items: center;
        gap: 8px;
        background-color: var(--primary-color);
        color: white;
        border: none;
        padding: 0.8rem 1.2rem;
        width: auto;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 600;
        transition: opacity 0.2s;
    }

    .table-wrapper {
        background: var(--bg-card);
        border-radius: 8px;
        box-shadow: 0 1px 3px var(--shadow-color);
        overflow: hidden;
        border: 1px solid var(--border-color);
        margin-top: 1rem;
    }

    .standard-table {
        width: 100%;
        border-collapse: collapse;
        min-width: 600px;
    }

    .standard-table th {
        background-color: var(--bg-page); 
        text-align: left;
        padding: 1rem;
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--text-secondary);
        border-bottom: 1px solid var(--border-color); 
        text-transform: uppercase; 
        letter-spacing: 0.05em;
    }

    .standard-table td {
        padding: 1rem;
        border-bottom: 1px solid var(--border-color);
        color: var(--text-primary);
        vertical-align: middle;
    }

    .standard-table tr:last-child td {
        border-bottom: none;
    }

    .standard-table tr:hover td {
        background-color: var(--bg-page);
        transition: background-color 0.2s;
    }

    

</style>