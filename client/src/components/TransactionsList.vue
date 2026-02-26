<script setup lang="ts">
    import { computed } from 'vue';
    import { PhArrowUpRight, PhPencilSimple, PhTrash } from '@phosphor-icons/vue';

    const props = defineProps<{
        items: any[];
        currentTab: string;
    }>();

    const emit = defineEmits(['edit', 'delete']);

    const totalValue = computed(() => {
        return props.items.reduce((acc, item) => acc + (item.value || 0), 0);
    });

    const toBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL'}).format(v);
    const toDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-';
</script>

<template>
    <div class="records-wrapper">
        <div class="summary-bar">
            <span class="count">{{ items.length }} registro<span v-if="items.length !== 1">s</span></span>
            <span class="total" :class="currentTab === 'entradas' ? 'text-success' : 'text-danger'">
                {{ toBRL(totalValue) }}
            </span>
        </div>

        <div class="record-row hover-lift" v-for="item in items" :key="item.idPurchase">
            <div class="record-main">
                <div v-if="currentTab === 'entradas'" class="icon-entrada">
                    <PhArrowUpRight size="16" weight="bold" />
                </div>
                <span v-else class="category-dot" :style="{ backgroundColor: item.Category?.color || 'var(--text-secondary)' }"></span>
                
                <div class="record-info">
                    <span class="title">{{ item.title }}</span>
                    <span class="subtitle">
                        <template v-if="item.Category?.description">{{ item.Category.description }} &bull; </template>
                        {{ toDate(item.date) }}
                    </span>
                </div>
            </div>
            
            <div class="record-actions">
                <div class="record-value" :class="currentTab === 'entradas' ? 'text-success' : 'text-danger'">
                    {{ toBRL(item.value) }}
                </div>
                <div class="action-buttons">
                    <button class="icon-btn edit-btn" @click="emit('edit', item)" title="Editar">
                        <PhPencilSimple size="18" />
                    </button>
                    <button class="icon-btn delete-btn" @click="emit('delete', item.idPurchase)" title="Excluir">
                        <PhTrash size="18" />
                    </button>
                </div>
            </div>
        </div>

        <div v-if="items.length === 0" class="empty-state">
            Nenhum registro encontrado neste mês.
        </div>
    </div>
</template>

<style scoped>
    .text-danger { color: var(--danger-color); }
    .text-success { color: var(--success-color); }

    .records-wrapper {
        background-color: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        overflow: hidden;
    }

    .summary-bar {
        display: flex;
        justify-content: space-between;
        padding: 1.2rem 1.5rem;
        background-color: rgba(255, 255, 255, 0.02);
        border-bottom: 1px solid var(--border-color);
    }
    .summary-bar .count { 
        font-weight: 600; 
        font-size: 0.95rem; 
        color: var(--text-primary); 
    }

    .summary-bar .total { 
        font-weight: 700; 
        font-size: 1.05rem; 
        font-feature-settings: "tnum"; }

    .record-row {
        display: flex; justify-content: space-between; align-items: center;
        padding: 1.2rem 1.5rem; border-bottom: 1px solid var(--border-color);
        transition: background-color 0.2s;
    }
    .record-row:last-child { border-bottom: none; }
    .record-row:hover { background-color: rgba(255,255,255, 0.02); }

    .record-main { 
        display: flex; 
        align-items: center; gap: 1.2rem; 
    }
    .category-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }

    .icon-entrada {
        background-color: rgba(52, 211, 153, 0.1); color: var(--success-color);
        width: 32px; height: 32px; border-radius: 8px;
        display: flex; align-items: center; justify-content: center;
    }

    .record-info { 
        display: flex; 
        flex-direction: column; 
        gap: 0.2rem; 
    }
    
    .record-info .title { 
        font-weight: 600; 
        color: var(--text-primary); 
        font-size: 0.95rem; 
    }

    .record-info .subtitle { 
        font-size: 0.8rem; 
        color: var(--text-secondary); 
    }

    .record-actions { 
        display: flex; 
        align-items: center; 
        gap: 1.5rem; 
    }

    .record-value { font-weight: 600; font-size: 1rem; }
    
    .action-buttons { display: flex; gap: 4px; }
    .icon-btn { background: transparent; border: none; padding: 6px; cursor: pointer; transition: 0.2s; border-radius: 6px; display: flex; align-items: center;}
    .icon-btn.edit-btn { color: var(--text-secondary); }
    .icon-btn.edit-btn:hover { color: var(--text-primary); background: rgba(255,255,255, 0.05); }
    .icon-btn.delete-btn { color: var(--danger-color); }
    .icon-btn.delete-btn:hover { background: rgba(239, 68, 68, 0.1); }

    .empty-state { padding: 3rem; text-align: center; color: var(--text-secondary); }

    @media (max-width: 640px) {
        .record-row { flex-direction: column; align-items: flex-start; gap: 1rem; }
        .record-actions { width: 100%; justify-content: space-between; flex-direction: row-reverse; }
    }
</style>