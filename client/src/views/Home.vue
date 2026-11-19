<script setup lang="ts">
    import { ref, onMounted, computed } from 'vue';
    import { storeToRefs } from "pinia";
    import { PhArrowDownLeft, PhArrowUpRight, PhChartBar, PhCreditCard, PhListDashes, PhReceipt, PhWifiHigh } from '@phosphor-icons/vue';
    import VueApexCharts from 'vue3-apexcharts';
    import type { ApexOptions } from 'apexcharts';
    import { useProfileStore } from "../stores/useProfileStore";
    import { usePiggybankStore } from "../stores/usePiggybankStore";
    import { supabase } from '../services/supabase';

    const profileStore = useProfileStore();
    const piggybankStore = usePiggybankStore();
    const { userName, myCards } = storeToRefs(profileStore);

    const totalIncome = ref(0);
    const totalExpense = ref(0);
    const currentBalance = ref(0);
    const recentTransactions = ref<any[]>([]);

    interface CategoryStat {
        label: string;
        value: number;
        color: string;
        percent: number;
    }

    const categoryStats = ref<CategoryStat[]>([]);
    const donutSeries = computed(() => categoryStats.value.map(c => c.value));

    const donutOptions = computed<ApexOptions>(() => ({
        labels: categoryStats.value.map(c => c.label),
        colors: categoryStats.value.map(c => c.color),
        chart: {
            type: 'donut',
            fontFamily: 'Inter, sans-serif',
            background: 'transparent',
            sparkline: { enabled: true }
        },
        legend: { show: false },
        dataLabels: { enabled: false },
        stroke: { show: true, width: 3, colors: ['var(--bg-card)'] },
        tooltip: {
            theme: 'dark',
            y: {
                formatter: (val: number) => formatCurrency(val)
            }
        },
        plotOptions: {
            pie: {
                donut: {
                    size: '74%',
                    labels: {
                        show: true,
                        name: {
                            show: true,
                            fontSize: '11px',
                            fontWeight: 500,
                            color: 'var(--text-secondary)',
                            offsetY: -4
                        },
                        value: {
                            show: true,
                            fontSize: '15px',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            offsetY: 4,
                            formatter: (val: string) => formatCurrency(Number(val))
                        },
                        total: {
                            show: true,
                            label: 'Saídas',
                            fontSize: '11px',
                            fontWeight: 600,
                            color: 'var(--text-secondary)',
                            formatter: () => formatCurrency(totalExpense.value)
                        }
                    }
                }
            }
        }
    }));

    const getBankGradient = (bankName: string = '') => {
        const name = bankName.toLowerCase();
        if (name.includes('nu')) return 'linear-gradient(135deg, #4C1D95 0%, #7C3AED 100%)';
        if (name.includes('ita')) return 'linear-gradient(135deg, #1E3A8A 0%, #EA580C 100%)';
        if (name.includes('inter')) return 'linear-gradient(135deg, #9A3412 0%, #F97316 100%)';
        if (name.includes('bradesco') || name.includes('santander')) return 'linear-gradient(135deg, #7F1D1D 0%, #DC2626 100%)';
        if (name.includes('c6') || name.includes('xp') || name.includes('black')) return 'linear-gradient(135deg, #18181B 0%, #3F3F46 100%)';
        return 'linear-gradient(135deg, #312E81 0%, #6366F1 100%)';
    };

    const fetchFinancialSummary = async () => {
        try {
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
            const today = now.toISOString().split('T')[0];

            const { data: incomes } = await supabase
                .from('fin_income')
                .select('value')
                .gte('date', startOfMonth)
                .lte('date', endOfMonth)
                .eq('user_id', profileStore.userId);

            totalIncome.value = (incomes || []).reduce((acc: number, curr: any) => acc + Number(curr.value), 0);

            const { data: expenses } = await supabase
                .from('fin_installment')
                .select('value, dueDate, fin_purchase!inner(title, fin_category(description, color))')
                .gte('dueDate', startOfMonth)
                .lte('dueDate', endOfMonth);

            const expenseList = expenses || [];
            totalExpense.value = expenseList.reduce((acc: number, curr: any) => acc + Number(curr.value), 0);

            // Agrupa gastos por categoria para o gráfico de Estatísticas
            const groupedMap = new Map<string, { value: number; color: string }>();
            const fallbackPalette = ['#6366F1', '#8B5CF6', '#38BDF8', '#EC4899', '#10B981', '#F59E0B'];
            let colorIdx = 0;

            expenseList.forEach((item: any) => {
                const cat = item.fin_purchase?.fin_category;
                const label = cat?.description || 'Outros';
                const color = cat?.color || fallbackPalette[colorIdx++ % fallbackPalette.length];
                const prev = groupedMap.get(label);
                groupedMap.set(label, {
                    value: (prev?.value || 0) + Number(item.value),
                    color: prev?.color || color
                });
            });

            const totalExp = totalExpense.value || 1;
            categoryStats.value = Array.from(groupedMap.entries())
                .map(([label, info]) => ({
                    label,
                    value: Number(info.value.toFixed(2)),
                    color: info.color,
                    percent: Math.round((info.value / totalExp) * 100)
                }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 4);

            await piggybankStore.fetchPiggybanks();
            const totalGuardado = piggybankStore.piggybanks
                .filter(p => p.composes_balance === true)
                .reduce((acc, curr) => acc + Number(curr.current_amount), 0);

            totalIncome.value = totalIncome.value + totalGuardado;
            currentBalance.value = totalIncome.value - totalExpense.value;
        
            const { data: latestIncomes } = await supabase
                .from('fin_income')
                .select('title, value, date')
                .gte('date', startOfMonth)
                .lte('date', today)
                .order('date', { ascending: false })
                .limit(5);

            const { data: latestExpenses } = await supabase
                .from('fin_installment')
                .select('value, dueDate, fin_purchase!inner(title)')
                .gte('dueDate', startOfMonth)
                .lte('dueDate', today)
                .order('dueDate', { ascending: false })
                .limit(5);
            
            const mappedIncomes = (latestIncomes || []).map((i: any) => ({
                title: i.title,
                value: Number(i.value),
                date: i.date,
                type: 'income'
            }));
            const mappedExpenses = (latestExpenses || []).map((e: any) => ({
                title: e.fin_purchase?.title || 'Despesa',
                value: Number(e.value),
                date: e.dueDate,
                type: 'expense'
            }));

            recentTransactions.value = [...mappedIncomes, ...mappedExpenses]
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 5);
        } catch (error) {
            console.error("Erro ao buscar dados financeiros", error);
        }
    };

    onMounted(async () => {
        if (myCards.value.length === 0) {
            await profileStore.fetchProfileData();
        }
        await fetchFinancialSummary();
    });

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "";
        const onlyDate = dateStr.split('T')[0] || "";
        const parts = onlyDate.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return new Date(dateStr).toLocaleDateString('pt-BR');
    };
</script>

<template>
    <div class="home-container">
        <header class="home-header">
            <div>
                <h1>Olá, {{ userName || 'Visitante' }}</h1>
                <p>Resumo inteligente do seu patrimônio e fluxo de caixa</p>
            </div>
            <div class="header-actions">
                <button class="btn-secondary" @click="$router.push('/dashboard')">
                    <PhChartBar size="18" /> Dashboard Completo
                </button>
                <button class="btn-primary" @click="$router.push('/records')">
                    <PhListDashes size="18" /> Gerenciar Registros
                </button>
            </div>
        </header>

        <div class="dashboard-grid">
            <!-- CARTÃO DE SALDO -->
            <div class="card balance-card">
                <span class="balance-badge">Saldo disponível no mês</span>
                <h2 class="balance-amount">{{ formatCurrency(currentBalance) }}</h2>
                <div class="balance-details">
                    <div class="financial-item">
                        <div class="icon-circle icon-income">
                            <PhArrowDownLeft size="18" weight="bold" />
                        </div>
                        <div class="financial-text">
                            <span>Entradas + Reserva</span>
                            <p class="val-income">{{ formatCurrency(totalIncome) }}</p>
                        </div>
                    </div>
                    
                    <div class="financial-item">
                        <div class="icon-circle icon-expense">
                            <PhArrowUpRight size="18" weight="bold" />
                        </div>
                        <div class="financial-text">
                            <span>Saídas do mês</span>
                            <p class="val-expense">{{ formatCurrency(totalExpense) }}</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- CARTÃO DE FORMAS DE PAGAMENTO -->
            <div class="card mycards-card">
                <div class="card-header">
                    <h3>Meus Cartões</h3>
                    <button class="btn-details" @click="$router.push('/profile')">
                        <PhCreditCard size="15" /> Gerenciar
                    </button>
                </div>
                <div class="cards-scroll-container" v-if="myCards.length > 0">
                    <div
                        class="credit-card-mockup"
                        v-for="card in myCards"
                        :key="card.id_payment"
                        :style="{ background: getBankGradient(card.bank_name || card.nickname) }"
                    >
                        <div class="cc-header">
                            <span class="cc-bank">{{ card.bank_name || 'Cartão' }}</span>
                            <PhWifiHigh size="18" weight="bold" class="contactless" />
                        </div>
                        <div class="cc-body">
                            <p class="cc-name">{{ card.nickname || 'Meu Cartão' }}</p>
                            <div class="cc-footer-row">
                                <span class="cc-dates">Fecha dia {{ card.closing_day || '--' }} • Vence dia {{ card.due_day || '--' }}</span>
                                <span class="cc-dots">••••</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div v-else class="empty-box">
                    <p>Nenhum cartão cadastrado</p>
                    <button class="btn-outline" @click="$router.push('/profile')">
                        <PhCreditCard size="16" /> Adicionar cartão
                    </button>              
                </div>
            </div>

            <!-- CARTÃO DE ÚLTIMAS TRANSAÇÕES -->
            <div class="card transactions-card">
                <div class="card-header">
                    <h3>Últimas Movimentações</h3>
                    <button class="btn-details" @click="$router.push('/records')">
                        <PhListDashes size="15" /> Ver todas
                    </button>
                </div>
                <div class="transactions-list">
                    <div class="transaction-item" v-for="(tx, index) in recentTransactions" :key="index">
                        <div class="tx-icon" :class="tx.type === 'income' ? 'icon-income' : 'icon-neutral'">
                            <PhArrowDownLeft v-if="tx.type === 'income'" size="16" weight="bold" />
                            <PhReceipt v-else size="16" weight="duotone" />
                        </div>
                        <div class="tx-info">
                            <h4>{{ tx.title }}</h4>
                            <p>{{ formatDate(tx.date) }}</p>
                        </div>
                        <div class="tx-value" :class="{ 'positive': tx.type === 'income' }">
                            {{ tx.type === 'expense' ? '- ' : '+ ' }}{{ formatCurrency(tx.value) }}
                        </div>
                    </div>
                    
                    <div v-if="recentTransactions.length === 0" class="empty-box">
                        Sem movimentações neste mês.
                    </div>
                </div>
            </div>

            <!-- CARTÃO DE ESTATÍSTICAS (GRÁFICO) -->
            <div class="card statistics-card">
                <div class="card-header">
                    <h3>Estatísticas</h3>
                    <button class="btn-details" @click="$router.push('/dashboard')">
                        <PhChartBar size="15" /> Detalhes
                    </button>
                </div>

                <div class="stats-chart-layout" v-if="categoryStats.length > 0">
                    <div class="donut-box">
                        <VueApexCharts
                            type="donut"
                            width="180"
                            height="180"
                            :options="donutOptions"
                            :series="donutSeries"
                        />
                    </div>

                    <div class="stats-legend-list">
                        <div class="legend-item" v-for="cat in categoryStats" :key="cat.label">
                            <div class="legend-top">
                                <div class="legend-name">
                                    <span class="legend-dot" :style="{ backgroundColor: cat.color }"></span>
                                    <span class="legend-label">{{ cat.label }}</span>
                                </div>
                                <div class="legend-numbers">
                                    <span class="legend-val">{{ formatCurrency(cat.value) }}</span>
                                    <span class="legend-pct">{{ cat.percent }}%</span>
                                </div>
                            </div>
                            <div class="legend-bar-track">
                                <div class="legend-bar-fill" :style="{ width: cat.percent + '%', backgroundColor: cat.color }"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div v-else class="empty-box">
                    Sem despesas categorizadas neste mês.
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.home-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.home-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
}

.home-header h1 {
    font-size: 1.75rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin: 0 0 0.25rem 0;
    color: var(--text-primary);
}

.home-header p {
    color: var(--text-secondary);
    font-size: 0.925rem;
    margin: 0;
}

.header-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.dashboard-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.25rem;
}

.card {
    background-color: var(--bg-card);
    border-radius: 16px;
    padding: 1.5rem;
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-sm);
    display: flex;
    flex-direction: column;
}

/* === SALDO === */
.balance-card {
    background: var(--card-highlight-bg);
    border: 1px solid var(--card-highlight-border);
    justify-content: space-between;
}

.balance-badge {
    display: inline-block;
    align-self: flex-start;
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--card-highlight-title);
    background: var(--primary-subtle);
    padding: 4px 10px;
    border-radius: 99px;
    margin-bottom: 0.75rem;
}

.balance-amount {
    font-size: 2.5rem;
    font-weight: 800;
    color: var(--card-highlight-text);
    margin: 0 0 1.75rem 0;
    letter-spacing: -0.03em;
    font-feature-settings: "tnum";
}

.balance-details {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    padding-top: 1.25rem;
    border-top: 1px solid var(--border-color);
}

.financial-item {
    display: flex;
    align-items: center;
    gap: 0.85rem;
}

.icon-circle {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.icon-income {
    background-color: var(--success-bg);
    color: var(--success-text);
}

.icon-expense {
    background-color: var(--danger-bg);
    color: var(--danger-text);
}

.icon-neutral {
    background-color: var(--bg-elevated);
    color: var(--text-secondary);
    border: 1px solid var(--border-color);
}

.financial-text span {
    font-size: 0.75rem;
    color: var(--text-secondary);
    font-weight: 500;
}

.financial-text p {
    font-size: 1.15rem;
    color: var(--text-primary);
    font-weight: 700;
    margin: 2px 0 0 0;
    font-feature-settings: "tnum";
}

/* === FORMAS DE PAGAMENTO === */
.cards-scroll-container {
    display: flex;
    align-items: center;
    overflow-x: auto;
    gap: 1rem;
    padding-bottom: 0.5rem;
    scrollbar-width: thin;
    scrollbar-color: var(--border-color) transparent;
}

.credit-card-mockup {
    min-width: 245px;
    height: 148px;
    flex-shrink: 0;
    padding: 1.25rem;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    color: #FFFFFF;
    box-shadow: 0 8px 20px -6px rgba(0, 0, 0, 0.35);
    position: relative;
    overflow: hidden;
}

.cc-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.cc-bank {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    opacity: 0.9;
}

.contactless {
    opacity: 0.75;
    transform: rotate(90deg);
}

.cc-body {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
}

.cc-name {
    font-size: 1.05rem;
    font-weight: 700;
    margin: 0;
    letter-spacing: -0.01em;
}

.cc-footer-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.cc-dates {
    font-size: 0.72rem;
    opacity: 0.8;
}

.cc-dots {
    font-size: 0.85rem;
    letter-spacing: 2px;
    opacity: 0.8;
}

/* === TRANSAÇÕES === */
.card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.25rem;
}

.card-header h3 {
    font-size: 1rem;
    color: var(--text-primary);
    font-weight: 600;
    margin: 0;
}

.transactions-list {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
}

.transaction-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--border-subtle);
}

.transaction-item:last-child {
    border-bottom: none;
    padding-bottom: 0;
}

.tx-icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 0.85rem;
    flex-shrink: 0;
}

.tx-info {
    flex: 1;
}

.tx-info h4 {
    margin: 0;
    font-size: 0.875rem;
    color: var(--text-primary);
    font-weight: 600;
}

.tx-info p {
    margin: 2px 0 0 0;
    font-size: 0.75rem;
    color: var(--text-muted);
}

.tx-value {
    font-weight: 600;
    font-size: 0.9rem;
    color: var(--text-primary);
    font-feature-settings: "tnum";
}

.tx-value.positive {
    color: var(--success-text);
}

/* === ESTATÍSTICAS (DONUT + RANKING DE CATEGORIAS) === */
.stats-chart-layout {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    flex: 1;
}

.donut-box {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.stats-legend-list {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.95rem;
    min-width: 0;
}

.legend-item {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
}

.legend-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
}

.legend-name {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
}

.legend-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
}

.legend-label {
    font-size: 0.825rem;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.legend-numbers {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    flex-shrink: 0;
}

.legend-val {
    font-size: 0.825rem;
    font-weight: 700;
    color: var(--text-primary);
    font-feature-settings: "tnum";
}

.legend-pct {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--text-secondary);
    background: var(--bg-elevated);
    padding: 1px 6px;
    border-radius: 6px;
    font-feature-settings: "tnum";
}

.legend-bar-track {
    width: 100%;
    height: 5px;
    background-color: var(--bg-elevated);
    border-radius: 99px;
    overflow: hidden;
}

.legend-bar-fill {
    height: 100%;
    border-radius: 99px;
    transition: width 0.3s ease;
}

.btn-details {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: var(--bg-elevated);
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
    padding: 0.35rem 0.7rem;
    border-radius: 8px;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
}

.btn-details:hover {
    color: var(--text-primary);
    border-color: var(--text-muted);
}

.empty-box {
    color: var(--text-secondary);
    font-size: 0.875rem;
    text-align: center;
    padding: 2rem 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
}

@media (max-width: 960px) {
    .stats-chart-layout {
        flex-direction: column;
    }
    .stats-legend-list {
        width: 100%;
    }
}

@media (max-width: 768px) {
    .dashboard-grid {
        grid-template-columns: 1fr;
    }
    .balance-amount {
        font-size: 2rem;
    }
}
</style>
