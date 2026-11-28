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
    const toDate = (d: string) => {
        if (!d) return '-';
        const isoDate = d.split('T')[0] || '';
        const parts = isoDate.split('-');
        const formatted = parts.length === 3
            ? `${parts[2]}/${parts[1]}/${parts[0]}`
            : new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' });

        const now = new Date();
        const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const yest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        const yestIso = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, '0')}-${String(yest.getDate()).padStart(2, '0')}`;

        if (isoDate === todayIso) return `Hoje • ${formatted}`;
        if (isoDate === yestIso) return `Ontem • ${formatted}`;
        return formatted;
    };

    // Garante alto contraste em Dark Mode mesmo quando a cor salva no banco é muito escura, preta ou fora do padrão #RRGGBB
    const parseHexToRgb = (raw?: string): { r: number; g: number; b: number } | null => {
        if (!raw) return null;
        const clean = raw.trim().replace(/^#/, '');
        if (/^[0-9a-fA-F]{3}$/.test(clean)) {
            const r = parseInt(clean[0]! + clean[0]!, 16);
            const g = parseInt(clean[1]! + clean[1]!, 16);
            const b = parseInt(clean[2]! + clean[2]!, 16);
            return { r, g, b };
        }
        if (/^[0-9a-fA-F]{6,8}$/.test(clean)) {
            const r = parseInt(clean.slice(0, 2), 16);
            const g = parseInt(clean.slice(2, 4), 16);
            const b = parseInt(clean.slice(4, 6), 16);
            return { r, g, b };
        }
        return null;
    };

    const rgbToHsl = (r: number, g: number, b: number): { h: number; s: number; l: number } => {
        const rn = r / 255;
        const gn = g / 255;
        const bn = b / 255;
        const max = Math.max(rn, gn, bn);
        const min = Math.min(rn, gn, bn);
        let h = 0;
        let s = 0;
        const l = (max + min) / 2;

        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case rn:
                    h = (gn - bn) / d + (gn < bn ? 6 : 0);
                    break;
                case gn:
                    h = (bn - rn) / d + 2;
                    break;
                case bn:
                    h = (rn - gn) / d + 4;
                    break;
            }
            h /= 6;
        }
        return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
    };

    const getCategoryBadgeStyle = (rawColor?: string) => {
        const rgb = parseHexToRgb(rawColor);
        if (!rgb) {
            return {
                backgroundColor: 'rgba(148, 163, 184, 0.14)',
                color: '#CBD5E1',
                border: '1px solid rgba(148, 163, 184, 0.28)',
            };
        }

        const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);

        // Se a cor for muito acinzentada/preta (ex: #000000 ou #1f2937 em "Aplicativos"), usa tom ardósia claro legível
        if (s < 14 && l < 55) {
            return {
                backgroundColor: 'rgba(148, 163, 184, 0.15)',
                color: '#E2E8F0',
                border: '1px solid rgba(148, 163, 184, 0.32)',
            };
        }

        // Clampa a luminosidade do texto entre 68% e 82% para leitura perfeita no fundo escuro,
        // mantendo o fundo translúcido suave (14% opacidade) e borda sutil (30% opacidade)
        const safeTextL = Math.max(68, Math.min(82, l));
        const safeTextS = Math.max(65, Math.min(92, s));
        const safeBgL = Math.max(48, Math.min(62, l));

        return {
            backgroundColor: `hsla(${h}, ${safeTextS}%, ${safeBgL}%, 0.15)`,
            color: `hsl(${h}, ${safeTextS}%, ${safeTextL}%)`,
            border: `1px solid hsla(${h}, ${safeTextS}%, ${safeTextL}%, 0.32)`,
        };
    };

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
                    :style="getCategoryBadgeStyle(item.fin_category?.color)"
                >
                    <PhReceipt size="18" weight="duotone" />
                </div>
                
                <div class="record-info">
                    <span class="title">{{ item.rawTitle || item.title }}</span>
                    <div class="meta-row">
                        <span
                            class="cat-badge"
                            :style="getCategoryBadgeStyle(item.fin_category?.color)"
                        >
                            {{ item.fin_category?.description || 'Sem categoria' }}
                        </span>
                        <span v-if="item.installmentBadge" class="installment-pill">
                            {{ item.installmentBadge }}
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

    .installment-pill {
        display: inline-flex;
        align-items: center;
        font-size: 0.71rem;
        font-weight: 700;
        padding: 2px 7px;
        border-radius: 6px;
        background: rgba(99, 102, 241, 0.14);
        color: #A5B4FC;
        border: 1px solid rgba(99, 102, 241, 0.3);
        font-feature-settings: "tnum";
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
