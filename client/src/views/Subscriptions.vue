<script setup lang="ts">
    import { ref, computed, onMounted } from 'vue';
    import {
        PhArrowsClockwise, PhPlus, PhCalendarCheck, PhCreditCard,
        PhPause, PhPlay, PhTrash, PhPencilSimple, PhX, PhTrendUp, PhSparkle
    } from '@phosphor-icons/vue';
    import { storeToRefs } from 'pinia';
    import { useProfileStore } from '../stores/useProfileStore';
    import { useAlertStore } from '../stores/useAlertStore';
    import ConfirmModal from '../components/ConfirmModal.vue';

    export interface SubscriptionItem {
        id: string;
        name: string;
        category: string;
        amount: number;
        cycle: 'monthly' | 'yearly';
        billingDay: number;
        cardNickname: string;
        color: string;
        active: boolean;
    }

    const profileStore = useProfileStore();
    const { myCards } = storeToRefs(profileStore);
    const { showAlert } = useAlertStore();

    const STORAGE_KEY = 'somma_subscriptions_v1';

    const defaultSubscriptions: SubscriptionItem[] = [
        {
            id: 'sub-1',
            name: 'Claude Pro (Anthropic)',
            category: 'Produtividade & IA',
            amount: 115.00,
            cycle: 'monthly',
            billingDay: 15,
            cardNickname: 'Inter Black',
            color: '#6366F1',
            active: true
        },
        {
            id: 'sub-2',
            name: 'Spotify Duo',
            category: 'Streaming & Música',
            amount: 27.90,
            cycle: 'monthly',
            billingDay: 10,
            cardNickname: 'Nubank Ultravioleta',
            color: '#10B981',
            active: true
        },
        {
            id: 'sub-3',
            name: 'Vercel Pro',
            category: 'Cloud & DevTools',
            amount: 102.10,
            cycle: 'monthly',
            billingDay: 15,
            cardNickname: 'Inter Black',
            color: '#38BDF8',
            active: true
        },
        {
            id: 'sub-4',
            name: 'Netflix 4K',
            category: 'Streaming & Vídeo',
            amount: 59.90,
            cycle: 'monthly',
            billingDay: 22,
            cardNickname: 'Itaú Personalité',
            color: '#F43F5E',
            active: true
        },
        {
            id: 'sub-5',
            name: 'Amazon Prime',
            category: 'Benefícios & Compras',
            amount: 166.80,
            cycle: 'yearly',
            billingDay: 5,
            cardNickname: 'Nubank Ultravioleta',
            color: '#F59E0B',
            active: true
        }
    ];

    const subscriptions = ref<SubscriptionItem[]>([]);
    const filterStatus = ref<'all' | 'active' | 'paused'>('all');
    const isModalOpen = ref(false);
    const editingId = ref<string | null>(null);
    const isConfirmingDelete = ref(false);
    const subToDelete = ref<string | null>(null);

    const form = ref({
        name: '',
        category: 'Streaming & Música',
        amount: 0,
        cycle: 'monthly' as 'monthly' | 'yearly',
        billingDay: 10,
        cardNickname: 'Nubank Ultravioleta',
        color: '#6366F1'
    });

    const presetColors = ['#6366F1', '#8B5CF6', '#10B981', '#38BDF8', '#F43F5E', '#F59E0B', '#EC4899'];

    const saveToStorage = () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(subscriptions.value));
    };

    const isMockMode = import.meta.env.VITE_USE_MOCK === 'true' || import.meta.env.MODE === 'mock';

    onMounted(async () => {
        if (myCards.value.length === 0) {
            await profileStore.fetchProfileData();
        }
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                subscriptions.value = JSON.parse(saved);
            } catch {
                subscriptions.value = isMockMode ? [...defaultSubscriptions] : [];
            }
        } else {
            subscriptions.value = isMockMode ? [...defaultSubscriptions] : [];
            if (isMockMode) saveToStorage();
        }
    });

    const activeSubscriptions = computed(() => subscriptions.value.filter(s => s.active));

    const monthlyTotal = computed(() => {
        return activeSubscriptions.value.reduce((acc, sub) => {
            const monthlyVal = sub.cycle === 'yearly' ? sub.amount / 12 : sub.amount;
            return acc + monthlyVal;
        }, 0);
    });

    const yearlyProjection = computed(() => monthlyTotal.value * 12);

    const nextRenewal = computed(() => {
        if (activeSubscriptions.value.length === 0) return null;
        const todayDay = new Date().getDate();
        const sorted = [...activeSubscriptions.value].sort((a, b) => {
            const diffA = a.billingDay >= todayDay ? a.billingDay - todayDay : (31 - todayDay) + a.billingDay;
            const diffB = b.billingDay >= todayDay ? b.billingDay - todayDay : (31 - todayDay) + b.billingDay;
            return diffA - diffB;
        });
        return sorted[0] || null;
    });

    const filteredSubscriptions = computed(() => {
        if (filterStatus.value === 'active') return subscriptions.value.filter(s => s.active);
        if (filterStatus.value === 'paused') return subscriptions.value.filter(s => !s.active);
        return subscriptions.value;
    });

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
    };

    const getInitials = (name: string) => {
        const clean = name.trim();
        return clean ? clean.substring(0, 2).toUpperCase() : 'AS';
    };

    const openCreateModal = () => {
        editingId.value = null;
        form.value = {
            name: '',
            category: 'Streaming & Música',
            amount: 0,
            cycle: 'monthly',
            billingDay: 10,
            cardNickname: myCards.value[0]?.nickname || 'Nubank Ultravioleta',
            color: '#6366F1'
        };
        isModalOpen.value = true;
    };

    const openEditModal = (sub: SubscriptionItem) => {
        editingId.value = sub.id;
        form.value = {
            name: sub.name,
            category: sub.category,
            amount: sub.amount,
            cycle: sub.cycle,
            billingDay: sub.billingDay,
            cardNickname: sub.cardNickname,
            color: sub.color
        };
        isModalOpen.value = true;
    };

    const handleSave = () => {
        if (!form.value.name.trim() || form.value.amount <= 0) {
            showAlert('Preencha o nome do serviço e um valor válido.', 'warning');
            return;
        }

        if (editingId.value) {
            const idx = subscriptions.value.findIndex(s => s.id === editingId.value);
            const current = subscriptions.value[idx];
            if (idx !== -1 && current) {
                subscriptions.value[idx] = {
                    ...current,
                    ...form.value
                };
            }
            showAlert('Assinatura atualizada com sucesso!', 'success');
        } else {
            subscriptions.value.unshift({
                id: `sub-${Date.now()}`,
                name: form.value.name.trim(),
                category: form.value.category,
                amount: Number(form.value.amount),
                cycle: form.value.cycle,
                billingDay: Number(form.value.billingDay) || 1,
                cardNickname: form.value.cardNickname,
                color: form.value.color,
                active: true
            });
            showAlert('Nova assinatura adicionada!', 'success');
        }

        saveToStorage();
        isModalOpen.value = false;
    };

    const toggleActive = (sub: SubscriptionItem) => {
        sub.active = !sub.active;
        saveToStorage();
        showAlert(sub.active ? `${sub.name} reativada.` : `${sub.name} pausada.`, 'success');
    };

    const confirmDelete = (id: string) => {
        subToDelete.value = id;
        isConfirmingDelete.value = true;
    };

    const executeDelete = () => {
        if (subToDelete.value) {
            subscriptions.value = subscriptions.value.filter(s => s.id !== subToDelete.value);
            saveToStorage();
            showAlert('Assinatura removida.', 'success');
        }
        isConfirmingDelete.value = false;
        subToDelete.value = null;
    };
</script>

<template>
    <div class="subscriptions-page">
        <header class="page-header">
            <div>
                <h1>Assinaturas & Recorrências</h1>
                <p class="subtitle">Controle seus serviços mensais e anuais para evitar cobranças invisíveis na fatura</p>
            </div>
            <button class="btn-primary" @click="openCreateModal">
                <PhPlus size="17" weight="bold" />
                Nova Assinatura
            </button>
        </header>

        <!-- KPIs de Assinaturas -->
        <section class="subs-kpis">
            <div class="kpi-card highlight">
                <div class="kpi-top">
                    <span class="kpi-label">Custo Mensal Recorrente</span>
                    <div class="kpi-icon icon-primary">
                        <PhArrowsClockwise size="20" weight="bold" />
                    </div>
                </div>
                <div class="kpi-value">{{ formatCurrency(monthlyTotal) }}<small>/mês</small></div>
                <span class="kpi-helper">{{ activeSubscriptions.length }} serviços ativos no momento</span>
            </div>

            <div class="kpi-card">
                <div class="kpi-top">
                    <span class="kpi-label">Impacto Anual Projetado</span>
                    <div class="kpi-icon icon-purple">
                        <PhTrendUp size="20" weight="bold" />
                    </div>
                </div>
                <div class="kpi-value">{{ formatCurrency(yearlyProjection) }}<small>/ano</small></div>
                <span class="kpi-helper">Custo acumulado em 12 meses</span>
            </div>

            <div class="kpi-card">
                <div class="kpi-top">
                    <span class="kpi-label">Próxima Renovação</span>
                    <div class="kpi-icon icon-green">
                        <PhCalendarCheck size="20" weight="bold" />
                    </div>
                </div>
                <template v-if="nextRenewal">
                    <div class="kpi-value next-name">{{ nextRenewal.name }}</div>
                    <span class="kpi-helper">
                        Dia {{ nextRenewal.billingDay }} • <strong>{{ formatCurrency(nextRenewal.amount) }}</strong> ({{ nextRenewal.cardNickname }})
                    </span>
                </template>
                <template v-else>
                    <div class="kpi-value muted">—</div>
                    <span class="kpi-helper">Nenhuma assinatura ativa</span>
                </template>
            </div>
        </section>

        <!-- Barra de Filtro -->
        <div class="toolbar-row">
            <div class="filter-pills">
                <button
                    class="pill-btn"
                    :class="{ active: filterStatus === 'all' }"
                    @click="filterStatus = 'all'"
                >
                    Todas ({{ subscriptions.length }})
                </button>
                <button
                    class="pill-btn"
                    :class="{ active: filterStatus === 'active' }"
                    @click="filterStatus = 'active'"
                >
                    Ativas ({{ activeSubscriptions.length }})
                </button>
                <button
                    class="pill-btn"
                    :class="{ active: filterStatus === 'paused' }"
                    @click="filterStatus = 'paused'"
                >
                    Pausadas ({{ subscriptions.length - activeSubscriptions.length }})
                </button>
            </div>

            <div class="ai-tip">
                <PhSparkle size="15" weight="fill" />
                <span>Pausar serviços pouco usados economiza imediatamente no seu orçamento anual.</span>
            </div>
        </div>

        <!-- Grid de Cards de Assinatura -->
        <div class="subs-grid" v-if="filteredSubscriptions.length > 0">
            <div
                v-for="sub in filteredSubscriptions"
                :key="sub.id"
                class="sub-card"
                :class="{ 'is-paused': !sub.active }"
            >
                <div class="sub-card-top">
                    <div class="service-brand">
                        <div
                            class="service-logo"
                            :style="{
                                backgroundColor: sub.color + '1F',
                                color: sub.color,
                                borderColor: sub.color + '40'
                            }"
                        >
                            {{ getInitials(sub.name) }}
                        </div>
                        <div class="service-info">
                            <h3 class="service-name">{{ sub.name }}</h3>
                            <span class="service-cat">{{ sub.category }}</span>
                        </div>
                    </div>

                    <span class="status-badge" :class="sub.active ? 'badge-active' : 'badge-paused'">
                        {{ sub.active ? 'Ativa' : 'Pausada' }}
                    </span>
                </div>

                <div class="sub-card-price">
                    <div class="price-main">
                        <span class="price-val">{{ formatCurrency(sub.amount) }}</span>
                        <span class="price-cycle">/{{ sub.cycle === 'monthly' ? 'mês' : 'ano' }}</span>
                    </div>
                    <span v-if="sub.cycle === 'yearly'" class="yearly-equiv">
                        Equivale a {{ formatCurrency(sub.amount / 12) }}/mês
                    </span>
                </div>

                <div class="sub-card-footer">
                    <div class="billing-meta">
                        <span class="meta-chip">
                            <PhCalendarCheck size="14" />Todo dia {{ sub.billingDay }}
                        </span>
                        <span class="meta-chip">
                            <PhCreditCard size="14" />{{ sub.cardNickname }}
                        </span>
                    </div>

                    <div class="sub-actions">
                        <button
                            class="act-btn"
                            @click="toggleActive(sub)"
                            :title="sub.active ? 'Pausar assinatura' : 'Reativar assinatura'"
                        >
                            <PhPause v-if="sub.active" size="15" weight="bold" />
                            <PhPlay v-else size="15" weight="fill" />
                        </button>
                        <button class="act-btn" @click="openEditModal(sub)" title="Editar">
                            <PhPencilSimple size="15" />
                        </button>
                        <button class="act-btn danger" @click="confirmDelete(sub.id)" title="Excluir">
                            <PhTrash size="15" />
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div v-else class="empty-state">
            Nenhuma assinatura encontrada neste filtro.
        </div>

        <!-- Modal de Criar / Editar Assinatura -->
        <Teleport to="body">
            <div v-if="isModalOpen" class="modal-overlay" @click.self="isModalOpen = false">
                <div class="modal-content">
                    <div class="modal-header">
                        <div>
                            <h3>{{ editingId ? 'Editar Assinatura' : 'Nova Assinatura' }}</h3>
                            <p class="modal-sub">Cadastre seu serviço recorrente</p>
                        </div>
                        <button class="close-btn" @click="isModalOpen = false">
                            <PhX size="20" />
                        </button>
                    </div>

                    <form @submit.prevent="handleSave" class="modal-form">
                        <div class="input-group">
                            <label>Nome do Serviço</label>
                            <input type="text" v-model="form.name" placeholder="Ex: Spotify, Netflix, ChatGPT Plus..." required />
                        </div>

                        <div class="form-row-2">
                            <div class="input-group">
                                <label>Valor (R$)</label>
                                <input type="number" step="0.01" min="0.01" v-model.number="form.amount" placeholder="0.00" required />
                            </div>
                            <div class="input-group">
                                <label>Ciclo de Cobrança</label>
                                <select v-model="form.cycle">
                                    <option value="monthly">Mensal</option>
                                    <option value="yearly">Anual</option>
                                </select>
                            </div>
                        </div>

                        <div class="form-row-2">
                            <div class="input-group">
                                <label>Dia da Cobrança</label>
                                <input type="number" min="1" max="31" v-model.number="form.billingDay" required />
                            </div>
                            <div class="input-group">
                                <label>Cartão Vinculado</label>
                                <select v-model="form.cardNickname">
                                    <option v-for="card in myCards" :key="card.id_payment" :value="card.nickname">
                                        {{ card.nickname }}
                                    </option>
                                    <option v-if="myCards.length === 0" value="Cartão Principal">Cartão Principal</option>
                                </select>
                            </div>
                        </div>

                        <div class="input-group">
                            <label>Categoria</label>
                            <select v-model="form.category">
                                <option value="Streaming & Música">Streaming & Música</option>
                                <option value="Streaming & Vídeo">Streaming & Vídeo</option>
                                <option value="Produtividade & IA">Produtividade & IA</option>
                                <option value="Cloud & DevTools">Cloud & DevTools</option>
                                <option value="Benefícios & Compras">Benefícios & Compras</option>
                                <option value="Saúde & Academia">Saúde & Academia</option>
                                <option value="Educação">Educação</option>
                            </select>
                        </div>

                        <div class="input-group">
                            <label>Cor de Identificação</label>
                            <div class="color-swatches">
                                <button
                                    type="button"
                                    v-for="c in presetColors"
                                    :key="c"
                                    class="swatch"
                                    :class="{ active: form.color === c }"
                                    :style="{ backgroundColor: c }"
                                    @click="form.color = c"
                                ></button>
                            </div>
                        </div>

                        <div class="modal-actions">
                            <button type="button" class="btn-outline" @click="isModalOpen = false">Cancelar</button>
                            <button type="submit" class="btn-primary">
                                {{ editingId ? 'Salvar Alterações' : 'Adicionar Assinatura' }}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </Teleport>

        <ConfirmModal
            :isOpen="isConfirmingDelete"
            title="Remover Assinatura?"
            message="Tem certeza que deseja excluir esta assinatura da sua lista de recorrências?"
            @confirm="executeDelete"
            @cancel="isConfirmingDelete = false"
        />
    </div>
</template>

<style scoped>
    .subscriptions-page {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 1rem;
    }

    .page-header h1 {
        font-size: 1.75rem;
        font-weight: 700;
        letter-spacing: -0.02em;
        margin: 0 0 0.25rem 0;
        color: var(--text-primary);
    }

    .subtitle {
        margin: 0;
        color: var(--text-secondary);
        font-size: 0.925rem;
    }

    /* === KPIs === */
    .subs-kpis {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1.25rem;
    }

    .kpi-card {
        background-color: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 16px;
        padding: 1.4rem 1.5rem;
        box-shadow: var(--shadow-sm);
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
    }

    .kpi-card.highlight {
        background: var(--card-highlight-bg);
        border-color: var(--card-highlight-border);
    }

    .kpi-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .kpi-label {
        font-size: 0.825rem;
        font-weight: 600;
        color: var(--text-secondary);
    }

    .kpi-icon {
        width: 38px;
        height: 38px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .icon-primary { background: var(--primary-subtle); color: var(--primary-color); }
    .icon-purple { background: var(--purple-bg); color: var(--purple-color); }
    .icon-green { background: var(--success-bg); color: var(--success-text); }

    .kpi-value {
        font-size: 1.9rem;
        font-weight: 800;
        color: var(--text-primary);
        letter-spacing: -0.03em;
        font-feature-settings: "tnum";
    }

    .kpi-value small {
        font-size: 0.9rem;
        font-weight: 500;
        color: var(--text-secondary);
        margin-left: 2px;
    }

    .kpi-value.next-name {
        font-size: 1.35rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .kpi-helper {
        font-size: 0.78rem;
        color: var(--text-secondary);
    }

    .kpi-helper strong {
        color: var(--text-primary);
    }

    /* === TOOLBAR === */
    .toolbar-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 1rem;
    }

    .filter-pills {
        display: inline-flex;
        background-color: var(--bg-card);
        border: 1px solid var(--border-color);
        padding: 4px;
        border-radius: 12px;
        gap: 4px;
    }

    .pill-btn {
        background: transparent;
        border: none;
        color: var(--text-secondary);
        font-family: inherit;
        font-size: 0.825rem;
        font-weight: 600;
        padding: 0.45rem 0.9rem;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .pill-btn:hover {
        color: var(--text-primary);
    }

    .pill-btn.active {
        background-color: var(--primary-subtle);
        color: var(--primary-color);
    }

    .ai-tip {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        font-size: 0.8rem;
        color: var(--text-secondary);
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        padding: 0.45rem 0.9rem;
        border-radius: 99px;
    }

    .ai-tip svg {
        color: var(--primary-color);
        flex-shrink: 0;
    }

    /* === GRID DE ASSINATURAS === */
    .subs-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
        gap: 1.25rem;
    }

    .sub-card {
        background-color: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 16px;
        padding: 1.4rem;
        box-shadow: var(--shadow-sm);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 1.25rem;
        transition: transform 0.15s ease, border-color 0.15s ease, opacity 0.2s ease;
    }

    .sub-card:hover {
        transform: translateY(-2px);
        border-color: rgba(99, 102, 241, 0.35);
    }

    .sub-card.is-paused {
        opacity: 0.6;
    }

    .sub-card-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 0.75rem;
    }

    .service-brand {
        display: flex;
        align-items: center;
        gap: 0.85rem;
    }

    .service-logo {
        width: 44px;
        height: 44px;
        border-radius: 12px;
        border: 1px solid transparent;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        font-size: 0.95rem;
        flex-shrink: 0;
    }

    .service-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .service-name {
        margin: 0;
        font-size: 1rem;
        font-weight: 700;
        color: var(--text-primary);
    }

    .service-cat {
        font-size: 0.75rem;
        color: var(--text-secondary);
    }

    .status-badge {
        font-size: 0.7rem;
        font-weight: 700;
        padding: 3px 8px;
        border-radius: 99px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    .badge-active {
        background: var(--success-bg);
        color: var(--success-text);
    }

    .badge-paused {
        background: var(--bg-elevated);
        color: var(--text-muted);
    }

    .sub-card-price {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
    }

    .price-main {
        display: flex;
        align-items: baseline;
        gap: 3px;
    }

    .price-val {
        font-size: 1.65rem;
        font-weight: 800;
        color: var(--text-primary);
        letter-spacing: -0.02em;
        font-feature-settings: "tnum";
    }

    .price-cycle {
        font-size: 0.825rem;
        color: var(--text-secondary);
        font-weight: 500;
    }

    .yearly-equiv {
        font-size: 0.75rem;
        color: var(--primary-color);
        font-weight: 600;
    }

    .sub-card-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-top: 1rem;
        border-top: 1px solid var(--border-subtle);
        gap: 0.5rem;
    }

    .billing-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
    }

    .meta-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.72rem;
        font-weight: 500;
        color: var(--text-secondary);
        background: var(--bg-elevated);
        border: 1px solid var(--border-color);
        padding: 3px 8px;
        border-radius: 7px;
    }

    .sub-actions {
        display: flex;
        align-items: center;
        gap: 3px;
    }

    .act-btn {
        background: transparent;
        border: none;
        width: 30px;
        height: 30px;
        border-radius: 7px;
        color: var(--text-muted);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .act-btn:hover {
        background: var(--bg-elevated);
        color: var(--text-primary);
    }

    .act-btn.danger:hover {
        background: var(--danger-bg);
        color: var(--danger-color);
    }

    /* === MODAL === */
    .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.65);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        padding: 1rem;
    }

    .modal-content {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 16px;
        padding: 1.75rem;
        width: 100%;
        max-width: 460px;
        box-shadow: var(--shadow-md);
    }

    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 1.35rem;
    }

    .modal-header h3 {
        margin: 0;
        font-size: 1.25rem;
        color: var(--text-primary);
    }

    .modal-sub {
        margin: 3px 0 0 0;
        font-size: 0.825rem;
        color: var(--text-secondary);
    }

    .close-btn {
        background: transparent;
        border: none;
        color: var(--text-secondary);
        cursor: pointer;
        padding: 4px;
        border-radius: 7px;
    }

    .close-btn:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
    }

    .modal-form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .form-row-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.85rem;
    }

    .color-swatches {
        display: flex;
        gap: 0.5rem;
        padding-top: 0.25rem;
    }

    .swatch {
        width: 28px;
        height: 28px;
        border-radius: 8px;
        border: 2px solid transparent;
        cursor: pointer;
        transition: transform 0.15s ease;
    }

    .swatch:hover {
        transform: scale(1.08);
    }

    .swatch.active {
        border-color: var(--text-primary);
        transform: scale(1.1);
    }

    .modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
        margin-top: 0.75rem;
        padding-top: 1rem;
        border-top: 1px solid var(--border-color);
    }

    @media (max-width: 960px) {
        .subs-kpis {
            grid-template-columns: 1fr;
        }
    }

    @media (max-width: 640px) {
        .form-row-2 {
            grid-template-columns: 1fr;
        }
    }
</style>
