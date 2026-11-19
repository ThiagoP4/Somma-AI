<script setup lang="ts">
    import { ref, onMounted, computed } from 'vue';
    import { usePiggybankStore, type Piggybank } from '../stores/usePiggybankStore';
    import { PhPiggyBank, PhTrendUp, PhPlus, PhTrash, PhArrowDownLeft, PhArrowUpRight, PhVault, PhLockKey } from '@phosphor-icons/vue'
    import PiggybankModal from '../components/Piggybank/PiggybankModal.vue'
    import PiggybankTransaction from '../components/Piggybank/PiggybankTransaction.vue'

    const piggybankStore = usePiggybankStore();
    const activeTab = ref<'cofrinhos' | 'ativos'>('cofrinhos');

    const isCreateModalOpen = ref(false);
    const isTransactionModalOpen = ref(false);
    const transactionData = ref({
        piggybank: null as Piggybank | null,
        type: 'deposit' as 'deposit' | 'withdraw'
    });

    const openTransactionModal = (piggy: Piggybank, type: 'deposit' | 'withdraw') => {
        transactionData.value = { piggybank: piggy, type };
        isTransactionModalOpen.value = true;
    };

    const handleDelete = async (id: string) => {
        if (confirm('Tem certeza que deseja excluir este cofrinho?')) {
            await piggybankStore.deletePiggybank(id);
        }
    };

    const calculateProgress = (current: number, target: number) => {
        if (!target || target === 0) return 100;
        const calc = (current / target) * 100;
        return calc > 100 ? 100 : Math.round(calc);
    };

    onMounted(async () => {
        await piggybankStore.fetchPiggybanks();
    });

    const totalGuardado = computed(() => {
        return piggybankStore.piggybanks
            .filter(p => p.composes_balance === true)
            .reduce((acc, curr) => acc + Number(curr.current_amount), 0);
    });

    const totalReservado = computed(() => {
        return piggybankStore.piggybanks
            .filter(p => p.composes_balance === false)
            .reduce((acc, curr) => acc + Number(curr.current_amount), 0);
    });

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    };
</script>

<template>
    <div class="investments-container">
        <header class="page-header">
            <div>
                <h1>Investimentos & Reservas</h1>
                <p class="subtitle">Organize seus objetivos financeiros e acompanhe a evolução do seu patrimônio</p>
            </div>
            <div class="header-actions" v-if="activeTab === 'cofrinhos'">
                <button class="btn-primary" @click="isCreateModalOpen = true">
                    <PhPlus size="16" weight="bold" />
                    Novo Cofrinho
                </button>
            </div>
        </header>

        <div class="tabs-bar">
            <button
                class="tab-btn"
                :class="{ active: activeTab === 'cofrinhos' }"
                @click="activeTab = 'cofrinhos'"
            >
                <PhPiggyBank size="18" :weight="activeTab === 'cofrinhos' ? 'fill' : 'regular'" />
                <span>Cofrinhos</span>
            </button>
            <button
                class="tab-btn"
                :class="{ active: activeTab === 'ativos' }"
                @click="activeTab = 'ativos'"
            >
                <PhTrendUp size="18" :weight="activeTab === 'ativos' ? 'bold' : 'regular'" />
                <span>Carteira de Ativos</span>
            </button>
        </div>

        <div v-if="activeTab === 'cofrinhos'" class="tab-content">
            <div class="summary-cards">
                <div class="card summary-card">
                    <div class="summary-top">
                        <span class="card-title">Total guardado (Compõe saldo)</span>
                        <div class="summary-icon icon-primary">
                            <PhVault size="20" weight="duotone" />
                        </div>
                    </div>
                    <h2 class="card-value">{{ formatCurrency(totalGuardado) }}</h2>
                    <span class="card-helper">Liquidez imediata somada ao saldo mensal</span>
                </div>

                <div class="card summary-card">
                    <div class="summary-top">
                        <span class="card-title">Total reservado (Metas isoladas)</span>
                        <div class="summary-icon icon-purple">
                            <PhLockKey size="20" weight="duotone" />
                        </div>
                    </div>
                    <h2 class="card-value">{{ formatCurrency(totalReservado) }}</h2>
                    <span class="card-helper">Patrimônio protegido fora do saldo do mês</span>
                </div>
            </div>

            <div v-if="piggybankStore.isLoading" class="loading-box">
                Carregando seus cofrinhos...
            </div>

            <div v-else class="piggybanks-grid">
                <div v-for="piggy in piggybankStore.piggybanks" :key="piggy.id_piggybank" class="piggy-card">
                    <div class="piggy-header">
                        <div class="piggy-title-area">
                            <div class="piggy-icon">
                                <PhPiggyBank weight="duotone" size="22" />
                            </div>
                            <div class="piggy-title-stack">
                                <span class="piggy-title">{{ piggy.title }}</span>
                                <span class="piggy-tag" :class="piggy.composes_balance ? 'tag-liquid' : 'tag-locked'">
                                    {{ piggy.composes_balance ? 'Compõe saldo' : 'Reserva isolada' }}
                                </span>
                            </div>
                        </div>
                        <button class="icon-btn delete-btn" @click="handleDelete(piggy.id_piggybank)" title="Excluir cofrinho">
                            <PhTrash size="17" />
                        </button>
                    </div>

                    <div class="piggy-balance-area">
                        <h3 class="piggy-amount">{{ formatCurrency(piggy.current_amount) }}</h3>
                        <div class="piggy-meta">
                            <span>Meta: <strong>{{ formatCurrency(piggy.target_amount) }}</strong></span>
                            <span class="pct-badge">{{ calculateProgress(piggy.current_amount, piggy.target_amount) }}%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" :style="{ width: calculateProgress(piggy.current_amount, piggy.target_amount) + '%' }"></div>
                        </div>
                    </div>

                    <div class="piggy-buttons">
                        <button class="btn-outline btn-deposit" @click="openTransactionModal(piggy, 'deposit')">
                            <PhArrowDownLeft size="16" weight="bold" /> Guardar
                        </button>
                        <button class="btn-outline" @click="openTransactionModal(piggy, 'withdraw')">
                            <PhArrowUpRight size="16" weight="bold" /> Resgatar
                        </button>
                    </div>
                </div>

                <div v-if="piggybankStore.piggybanks.length === 0" class="empty-state">
                    Nenhum cofrinho criado ainda. Clique em "Novo Cofrinho" para começar!
                </div>
            </div>
        </div>

        <div v-if="activeTab === 'ativos'" class="tab-content">
            <div class="empty-assets-card">
                <div class="summary-icon icon-primary" style="width: 48px; height: 48px;">
                    <PhTrendUp size="24" weight="duotone" />
                </div>
                <h3>Carteira de Ativos em Breve</h3>
                <p>Em breve você poderá acompanhar Renda Fixa, FIIs, Ações e Cripto integrados ao Somma AI.</p>
            </div>
        </div>  
    </div>

    <PiggybankModal 
        v-if="isCreateModalOpen" 
        @close="isCreateModalOpen = false" 
    />
    
    <PiggybankTransaction 
        v-if="isTransactionModalOpen && transactionData.piggybank" 
        :piggybank="transactionData.piggybank" 
        :type="transactionData.type" 
        @close="isTransactionModalOpen = false" 
    />
</template>

<style scoped>
    .investments-container {
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

    .tabs-bar {
        display: inline-flex;
        align-self: flex-start;
        background-color: var(--bg-card);
        border: 1px solid var(--border-color);
        padding: 4px;
        border-radius: 12px;
        gap: 4px;
    }

    .tab-btn { 
        background: transparent;
        border: none;
        color: var(--text-secondary);
        font-size: 0.875rem;
        font-weight: 500;
        font-family: inherit;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        cursor: pointer;
        padding: 0.5rem 1rem;
        border-radius: 8px;
        transition: all 0.15s ease;
    }

    .tab-btn:hover {
        color: var(--text-primary);
        background-color: var(--bg-hover);
    }

    .tab-btn.active {
        background-color: var(--primary-subtle);
        color: var(--primary-color);
        font-weight: 600;
    }

    .tab-content {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .summary-cards {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1.25rem;
    }

    .summary-card {
        background-color: var(--bg-card);
        border-radius: 16px;
        padding: 1.5rem;
        border: 1px solid var(--border-color);
        box-shadow: var(--shadow-sm);
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .summary-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    .card-title {
        font-size: 0.85rem;
        color: var(--text-secondary);
        font-weight: 600;
    }

    .summary-icon {
        width: 38px;
        height: 38px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .icon-primary {
        background: var(--primary-subtle);
        color: var(--primary-color);
    }

    .icon-purple {
        background: var(--purple-bg);
        color: var(--purple-color);
    }

    .card-value {
        font-size: 2rem;
        font-weight: 800;
        color: var(--text-primary);
        margin: 0;
        letter-spacing: -0.02em;
        font-feature-settings: "tnum";
    }

    .card-helper {
        font-size: 0.78rem;
        color: var(--text-muted);
    }

    /* GRID DE COFRINHOS */
    .piggybanks-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        gap: 1.25rem;
    }

    .piggy-card {
        background-color: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 16px;
        padding: 1.5rem;
        box-shadow: var(--shadow-sm);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 1.35rem;
        transition: transform 0.15s ease, border-color 0.15s ease;
    }

    .piggy-card:hover {
        transform: translateY(-2px);
        border-color: rgba(99, 102, 241, 0.35);
    }

    .piggy-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
    }

    .piggy-title-area {
        display: flex;
        align-items: center;
        gap: 0.85rem;
    }

    .piggy-icon {
        background-color: var(--primary-subtle);
        color: var(--primary-color);
        width: 42px;
        height: 42px;
        border-radius: 11px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .piggy-title-stack {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
    }

    .piggy-title {
        font-weight: 600;
        color: var(--text-primary);
        font-size: 1rem;
    }

    .piggy-tag {
        font-size: 0.7rem;
        font-weight: 600;
        padding: 2px 7px;
        border-radius: 6px;
        align-self: flex-start;
    }

    .tag-liquid {
        background: var(--success-bg);
        color: var(--success-text);
    }

    .tag-locked {
        background: var(--bg-elevated);
        color: var(--text-secondary);
    }

    .icon-btn {
        background: transparent;
        border: none;
        color: var(--text-muted);
        width: 30px;
        height: 30px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.15s;
    }

    .icon-btn.delete-btn:hover {
        color: var(--danger-color);
        background: var(--danger-bg);
    }

    .piggy-amount {
        font-size: 1.65rem;
        font-weight: 800;
        color: var(--text-primary);
        margin: 0 0 0.5rem 0;
        letter-spacing: -0.02em;
        font-feature-settings: "tnum";
    }

    .piggy-meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.8rem;
        color: var(--text-secondary);
        margin-bottom: 0.6rem;
    }

    .piggy-meta strong {
        color: var(--text-primary);
        font-feature-settings: "tnum";
    }

    .pct-badge {
        background: var(--primary-subtle);
        color: var(--primary-color);
        font-weight: 700;
        font-size: 0.75rem;
        padding: 2px 8px;
        border-radius: 99px;
    }

    .progress-bar {
        width: 100%;
        height: 8px;
        background-color: var(--bg-elevated);
        border-radius: 99px;
        overflow: hidden;
    }

    .progress-fill {
        height: 100%;
        background: var(--primary-gradient);
        border-radius: 99px;
        transition: width 0.3s ease;
    }

    .piggy-buttons {
        display: flex;
        gap: 0.65rem;
    }

    .piggy-buttons .btn-outline {
        flex: 1;
    }

    .btn-deposit:hover {
        border-color: var(--primary-color);
        color: var(--primary-color);
        background: var(--primary-subtle);
    }

    .empty-assets-card {
        background: var(--bg-card);
        border: 1px dashed var(--border-color);
        border-radius: 16px;
        padding: 4rem 2rem;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 0.75rem;
    }

    .empty-assets-card h3 {
        margin: 0.5rem 0 0 0;
        font-size: 1.15rem;
        color: var(--text-primary);
    }

    .empty-assets-card p {
        margin: 0;
        color: var(--text-secondary);
        max-width: 420px;
        font-size: 0.9rem;
    }

    @media (max-width: 640px) {
        .summary-cards {
            grid-template-columns: 1fr;
        }
    }
</style>
