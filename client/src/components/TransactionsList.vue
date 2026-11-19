<script setup lang="ts">
    import { computed, ref } from 'vue';
    import { PhArrowUpRight, PhPencilSimple, PhTrash, PhCheckCircle, PhClock, PhCreditCard, PhReceipt } from '@phosphor-icons/vue';
    import ConfirmModal from './ConfirmModal.vue';

    const props = defineProps<{
        items: any[];
        currentTab: string;
    }>();

    const emit = defineEmits(['edit', 'delete', 'toggle-paid']);

    const totalValue = computed(() => {
        if (props.currentTab === 'entradas') {
            return props.items.reduce((acc, item) => acc + (item.value || 0), 0);
        }
        return props.items.reduce((acc, item) => item.paid ? acc + (item.value || 0) : acc, 0);
    });

    const pendingValue = computed(() => {
        if (props.currentTab === 'entradas') return 0;
        return props.items.reduce((acc, item) => !item.paid ? acc + (item.value || 0) : acc, 0);
    });

    const toBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
    const toDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-';

    const isConfirmingDelete = ref(false);
    const itemToDelete = ref<number | string | null>(null);

    const confirmDelete = (id: number | string) => {
        itemToDelete.value = id;
        isConfirmingDelete.value = true;
    };

    const executeDelete = () => {
        if (itemToDelete.value) {
            emit('delete', itemToDelete.value);
        }
        isConfirmingDelete.value = false;
        itemToDelete.value = null;
    };
</script>

<template>
    <div class="records-wrapper">
        <div class="summary-bar">
            <div class="summary-left">
                <span class="count-badge">{{ items.length }}</span>
                <span class="count-label">lançamento<span v-if="items.length !== 1">s</span></span>
            </div>
            <div class="summary-right">
                <div v-if="currentTab === 'compras' && pendingValue > 0" class="summary-metric">
                    <span class="metric-label">Pendente:</span>
                    <span class="metric-val muted">{{ toBRL(pendingValue) }}</span>
                </div>
                <div class="summary-metric">
                    <span class="metric-label">{{ currentTab === 'entradas' ? 'Total recebido:' : 'Total efetivado:' }}</span>
                    <span class="metric-val" :class="currentTab === 'entradas' ? 'text-success' : 'text-primary'">
                        {{ toBRL(totalValue) }}
                    </span>
                </div>
            </div>
        </div>

        <div class="record-row" v-for="item in items" :key="item.idPurchase || item.idIncome">
            <div class="record-main">
                <div v-if="currentTab === 'entradas'" class="tx-avatar avatar-income">
                    <PhArrowUpRight size="18" weight="bold" />
                </div>
                <div
                    v-else
                    class="tx-avatar"
                    :style="{
                        backgroundColor: (item.fin_category?.color || '#6366F1') + '1A',
                        color: item.fin_category?.color || '#6366F1',
                        borderColor: (item.fin_category?.color || '#6366F1') + '33'
                    }"
                >
                    <PhReceipt size="18" weight="duotone" />
                </div>
                
                <div class="record-info">
                    <span class="title">{{ item.title }}</span>
                    <div class="meta-row">
                        <span
                            v-if="item.fin_category?.description"
                            class="cat-badge"
                            :style="{
                                backgroundColor: (item.fin_category?.color || '#6366F1') + '14',
                                color: item.fin_category?.color || '#6366F1'
                            }"
                        >
                            {{ item.fin_category.description }}
                        </span>
                        <span v-if="item.payment?.nickname" class="payment-tag">
                            <PhCreditCard size="12" weight="fill" />
                            {{ item.payment.nickname }}
                        </span>
                        <span class="date-text">{{ toDate(item.date) }}</span>
                    </div>
                </div>
            </div>
            
            <div class="record-actions">
                <button
                    v-if="currentTab === 'compras'"
                    class="status-pill"
                    :class="item.paid ? 'is-paid' : 'is-pending'"
                    @click="emit('toggle-paid', item)"
                    :title="item.paid ? 'Clique para marcar como pendente' : 'Clique para efetivar gasto'"
                >
                    <PhCheckCircle v-if="item.paid" size="14" weight="fill" />
                    <PhClock v-else size="14" weight="bold" />
                    <span>{{ item.paid ? 'Pago' : 'Pendente' }}</span>
                </button>

                <div class="record-value" :class="currentTab === 'entradas' ? 'text-success' : 'text-primary'">
                    {{ currentTab === 'entradas' ? '+ ' : '' }}{{ toBRL(item.value) }}
                </div>

                <div class="action-buttons">
                    <button class="icon-btn edit-btn" @click="emit('edit', item)" title="Editar">
                        <PhPencilSimple size="16" />
                    </button>
                    <button class="icon-btn delete-btn" @click="confirmDelete(item.idPurchase || item.idIncome)" title="Excluir">
                        <PhTrash size="16" />
                    </button>
                </div>
            </div>
        </div>

        <div v-if="items.length === 0" class="empty-state">
            Nenhum registro encontrado neste mês.
        </div>

        <ConfirmModal 
            :isOpen="isConfirmingDelete"
            title="Excluir Registro?"
            message="Esta ação apagará este registro financeiro permanentemente. Tem certeza que deseja continuar?"
            @confirm="executeDelete"
            @cancel="isConfirmingDelete = false"
        />
    </div>
</template>

<style scoped>
    .text-primary { color: var(--text-primary); }
    .text-success { color: var(--success-text); }

    .records-wrapper {
        background-color: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 16px;
        overflow: hidden;
        box-shadow: var(--shadow-sm);
    }

    .summary-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 1.35rem;
        background-color: var(--bg-elevated);
        border-bottom: 1px solid var(--border-color);
    }

    .summary-left {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .count-badge {
        background: var(--primary-subtle);
        color: var(--primary-color);
        font-weight: 700;
        font-size: 0.78rem;
        padding: 2px 8px;
        border-radius: 99px;
    }

    .count-label {
        font-weight: 500;
        font-size: 0.85rem;
        color: var(--text-secondary);
    }

    .summary-right {
        display: flex;
        align-items: center;
        gap: 1.25rem;
    }

    .summary-metric {
        display: flex;
        align-items: center;
        gap: 0.4rem;
    }

    .metric-label {
        font-size: 0.8rem;
        color: var(--text-secondary);
        font-weight: 500;
    }

    .metric-val {
        font-weight: 700;
        font-size: 0.95rem;
        font-feature-settings: "tnum";
    }

    .metric-val.muted {
        color: var(--text-secondary);
        font-weight: 600;
    }

    .record-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 1.35rem;
        border-bottom: 1px solid var(--border-color);
        transition: background-color 0.15s ease;
    }

    .record-row:last-child { border-bottom: none; }
    .record-row:hover { background-color: var(--bg-hover); }

    .record-main { 
        display: flex; 
        align-items: center;
        gap: 1rem; 
    }

    .tx-avatar {
        width: 38px;
        height: 38px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        border: 1px solid transparent;
    }

    .avatar-income {
        background-color: var(--success-bg);
        color: var(--success-text);
    }

    .record-info { 
        display: flex; 
        flex-direction: column; 
        gap: 0.3rem; 
    }
    
    .record-info .title { 
        font-weight: 600; 
        color: var(--text-primary); 
        font-size: 0.925rem; 
    }

    .meta-row { 
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.45rem;
    }

    .cat-badge {
        font-size: 0.72rem;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 6px;
    }

    .payment-tag {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background-color: var(--bg-elevated);
        border: 1px solid var(--border-color);
        padding: 2px 7px;
        border-radius: 6px;
        color: var(--text-secondary);
        font-weight: 500;
        font-size: 0.72rem;
    }

    .date-text {
        font-size: 0.75rem;
        color: var(--text-muted);
        font-feature-settings: "tnum";
    }

    .record-actions { 
        display: flex; 
        align-items: center; 
        gap: 1.25rem; 
    }

    /* Status Pill */
    .status-pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 4px 10px;
        border-radius: 99px;
        font-size: 0.75rem;
        font-weight: 600;
        font-family: inherit;
        cursor: pointer;
        border: 1px solid transparent;
        transition: all 0.15s ease;
    }

    .status-pill.is-paid {
        background-color: var(--success-bg);
        color: var(--success-text);
        border-color: rgba(16, 185, 129, 0.2);
    }

    .status-pill.is-paid:hover {
        background-color: rgba(16, 185, 129, 0.2);
    }

    .status-pill.is-pending {
        background-color: var(--bg-elevated);
        color: var(--text-secondary);
        border-color: var(--border-color);
    }

    .status-pill.is-pending:hover {
        border-color: var(--primary-color);
        color: var(--primary-color);
    }

    .record-value {
        font-weight: 700;
        font-size: 0.975rem;
        font-feature-settings: "tnum";
        min-width: 95px;
        text-align: right;
    }
    
    .action-buttons {
        display: flex;
        gap: 4px;
    }

    .icon-btn {
        background: transparent;
        border: 1px solid transparent;
        width: 30px;
        height: 30px;
        cursor: pointer;
        transition: all 0.15s;
        border-radius: 7px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-secondary);
    }

    .icon-btn.edit-btn:hover {
        color: var(--text-primary);
        background: var(--bg-elevated);
        border-color: var(--border-color);
    }

    .icon-btn.delete-btn:hover {
        color: var(--danger-color);
        background: var(--danger-bg);
    }

    .empty-state {
        padding: 3rem;
        text-align: center;
        color: var(--text-secondary);
    }

    @media (max-width: 640px) {
        .summary-bar {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
        }
        .record-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.85rem;
            padding: 1rem;
        }
        .record-main {
            width: 100%;
        }
        .record-actions {
            width: 100%;
            justify-content: space-between;
            gap: 0.5rem;
        }
        .record-value {
            min-width: auto;
            text-align: left;
        }
    }
</style>
