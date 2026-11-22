<script setup lang="ts">
    import { ref, onMounted, computed, watch } from 'vue';
    import { useRouter } from 'vue-router';
    import { storeToRefs } from "pinia";
    import {
        PhArrowDownLeft, PhArrowUpRight, PhChartBar, PhCreditCard,
        PhListDashes, PhReceipt, PhWifiHigh, PhShieldCheck, PhLockKey,
        PhArrowsClockwise, PhX, PhCalendarCheck, PhWhatsappLogo
    } from '@phosphor-icons/vue';
    import VueApexCharts from 'vue3-apexcharts';
    import type { ApexOptions } from 'apexcharts';
    import { useProfileStore } from "../stores/useProfileStore";
    import { usePiggybankStore } from "../stores/usePiggybankStore";
    import { useVaultStore } from "../stores/useVaultStore";
    import { useFilterStore } from "../stores/useFilterStore";
    import { supabase } from '../services/supabase';

    const router = useRouter();
    const profileStore = useProfileStore();
    const piggybankStore = usePiggybankStore();
    const vaultStore = useVaultStore();
    const filterStore = useFilterStore();
    const { userName, myCards } = storeToRefs(profileStore);
    const { isVaultUnlocked } = storeToRefs(vaultStore);
    const { selectedMonth, selectedYear, filterMode, selectedCardIds } = storeToRefs(filterStore);

    const totalIncome = ref(0);
    const totalExpense = ref(0);
    const currentBalance = ref(0);
    const recentTransactions = ref<any[]>([]);
    const allMonthInstallments = ref<any[]>([]);

    // Estado do Cartão 3D em Destaque (Showcase Modal)
    const activeCard3D = ref<any | null>(null);
    const isCardFlipped = ref(false);

    const openCardShowcase = (card: any) => {
        activeCard3D.value = card;
        isCardFlipped.value = false;
    };

    const closeCardShowcase = () => {
        activeCard3D.value = null;
        isCardFlipped.value = false;
    };

    const activeCardStats = computed(() => {
        if (!activeCard3D.value) return { total: 0, count: 0, paid: 0, pending: 0 };
        const cardId = activeCard3D.value.id_payment || activeCard3D.value.idPayment;
        const items = allMonthInstallments.value.filter(
            (i: any) => i.fin_purchase?.payment_id === cardId
        );
        const total = items.reduce((acc, curr) => acc + Number(curr.value || 0), 0);
        const paid = items.filter(i => i.paid).reduce((acc, curr) => acc + Number(curr.value || 0), 0);
        return {
            total,
            count: items.length,
            paid,
            pending: total - paid
        };
    });

    const viewCardInvoiceInRecords = (card: any) => {
        const cardId = card.id_payment || card.idPayment;
        filterStore.setFilterMode('invoice');
        selectedCardIds.value = [cardId];
        closeCardShowcase();
        router.push('/records');
    };

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
            const startOfMonth = new Date(selectedYear.value, selectedMonth.value, 1).toISOString().split('T')[0];
            const endOfMonth = new Date(selectedYear.value, selectedMonth.value + 1, 0).toISOString().split('T')[0];

            const { data: incomes } = await supabase
                .from('fin_income')
                .select('title, value, date')
                .gte('date', startOfMonth)
                .lte('date', endOfMonth)
                .order('date', { ascending: false })
                .eq('user_id', profileStore.userId);

            totalIncome.value = (incomes || []).reduce((acc: number, curr: any) => acc + Number(curr.value), 0);

            let expQuery = supabase
                .from('fin_installment')
                .select('value, dueDate, fin_purchase!inner(title, payment_id, fin_category(description, color))')
                .gte('dueDate', startOfMonth)
                .lte('dueDate', endOfMonth)
                .order('dueDate', { ascending: false });

            if (filterMode.value === 'invoice' && selectedCardIds.value.length > 0) {
                expQuery = expQuery.in('fin_purchase.payment_id', selectedCardIds.value);
            }

            const { data: expenses } = await expQuery;

            const expenseList = expenses || [];
            allMonthInstallments.value = expenseList;
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
            
            const mappedIncomes = (incomes || []).slice(0, 5).map((i: any) => ({
                title: i.title,
                value: Number(i.value),
                date: i.date,
                type: 'income'
            }));
            const mappedExpenses = expenseList.slice(0, 5).map((e: any) => ({
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

    watch([isVaultUnlocked, selectedMonth, selectedYear, filterMode, selectedCardIds], async () => {
        await fetchFinancialSummary();
    }, { deep: true });

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
                <div class="balance-top-row">
                    <span class="balance-badge">Saldo disponível no mês</span>
                    <span class="vault-mini-tag" :class="isVaultUnlocked ? 'tag-unlocked' : 'tag-locked'">
                        <PhShieldCheck v-if="isVaultUnlocked" size="13" weight="fill" />
                        <PhLockKey v-else size="13" weight="fill" />
                        {{ isVaultUnlocked ? 'Inclui Cofre Tailscale' : 'Cofre Isolado (Apenas Fluxo Mensal)' }}
                    </span>
                </div>
                <h2 class="balance-amount">{{ formatCurrency(currentBalance) }}</h2>
                <div class="balance-details">
                    <div class="financial-item">
                        <div class="icon-circle icon-income">
                            <PhArrowDownLeft size="18" weight="bold" />
                        </div>
                        <div class="financial-text">
                            <span>{{ isVaultUnlocked ? 'Entradas + Reserva' : 'Entradas do mês' }}</span>
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
                        @click="openCardShowcase(card)"
                        title="Clique para inspecionar e girar o cartão em 3D"
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

        <!-- OVERLAY 3D INTERATIVO DO CARTÃO (SHOWCASE & FLIP 180º) -->
        <Teleport to="body">
            <Transition name="card-stage">
                <div v-if="activeCard3D" class="card-3d-backdrop" @click.self="closeCardShowcase">
                    <div class="card-3d-stage">
                        <div class="stage-top-hint">
                            <span>Clique no cartão para girar 180° (Frente / Verso)</span>
                            <button class="stage-close-btn" @click="closeCardShowcase" title="Fechar">
                                <PhX size="18" weight="bold" />
                            </button>
                        </div>

                        <!-- Cena 3D com Perspective -->
                        <div class="scene-3d" @click="isCardFlipped = !isCardFlipped">
                            <div class="card-3d-object" :class="{ 'is-flipped': isCardFlipped }">
                                <!-- FACE FRONTAL DO CARTÃO -->
                                <div
                                    class="card-3d-face card-3d-front"
                                    :style="{ background: getBankGradient(activeCard3D.bank_name || activeCard3D.nickname) }"
                                >
                                    <div class="shine-effect"></div>
                                    <div class="front-top">
                                        <span class="front-bank">{{ activeCard3D.bank_name || 'Instituição' }}</span>
                                        <PhWifiHigh size="24" weight="bold" class="front-contactless" />
                                    </div>

                                    <div class="front-chip-row">
                                        <div class="emv-chip">
                                            <div class="chip-line"></div>
                                            <div class="chip-line"></div>
                                        </div>
                                        <span class="front-modality">{{ activeCard3D.method_type || 'Crédito' }}</span>
                                    </div>

                                    <div class="front-bottom">
                                        <div class="front-number">••••  ••••  ••••  {{ String(activeCard3D.id_payment || 4829).slice(-4).padStart(4, '8') }}</div>
                                        <div class="front-holder-row">
                                            <div class="holder-col">
                                                <span class="holder-lbl">CARTÃO / TITULAR</span>
                                                <strong class="holder-val">{{ activeCard3D.nickname }} • {{ userName || 'THIAGO SILVA' }}</strong>
                                            </div>
                                            <div class="brand-circles">
                                                <span class="b-circle c1"></span>
                                                <span class="b-circle c2"></span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- FACE TRASEIRA DO CARTÃO (VERSO COM TARJA MAGNÉTICA & RESUMO DA FATURA) -->
                                <div
                                    class="card-3d-face card-3d-back"
                                    :style="{ background: getBankGradient(activeCard3D.bank_name || activeCard3D.nickname) }"
                                >
                                    <div class="magnetic-strip"></div>

                                    <div class="back-body">
                                        <div class="cvv-signature-bar">
                                            <span class="sig-text">{{ userName || 'Thiago Silva' }}</span>
                                            <span class="cvv-box">CVV •••</span>
                                        </div>

                                        <div class="back-stats-grid">
                                            <div class="b-stat">
                                                <span>Fatura no Mês</span>
                                                <strong>{{ formatCurrency(activeCardStats.total) }}</strong>
                                            </div>
                                            <div class="b-stat">
                                                <span>Lançamentos</span>
                                                <strong>{{ activeCardStats.count }} {{ activeCardStats.count === 1 ? 'compra' : 'compras' }}</strong>
                                            </div>
                                            <div class="b-stat">
                                                <span>Fechamento</span>
                                                <strong>Todo dia {{ activeCard3D.closing_day || '--' }}</strong>
                                            </div>
                                            <div class="b-stat">
                                                <span>Vencimento</span>
                                                <strong>Todo dia {{ activeCard3D.due_day || '--' }}</strong>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Ações Abaixo do Cartão 3D -->
                        <div class="stage-actions">
                            <button type="button" class="btn-secondary stage-btn" @click="isCardFlipped = !isCardFlipped">
                                <PhArrowsClockwise size="17" weight="bold" />
                                {{ isCardFlipped ? 'Ver Frente do Cartão' : 'Virar Cartão (Ver Fatura)' }}
                            </button>
                            <button type="button" class="btn-primary stage-btn" @click="viewCardInvoiceInRecords(activeCard3D)">
                                <PhCalendarCheck size="17" weight="bold" />
                                Abrir Fatura Completa
                            </button>
                        </div>
                    </div>
                </div>
            </Transition>
        </Teleport>

        <!-- Botão Flutuante Premium do Bot Somma no WhatsApp -->
        <a
            href="https://wa.me/5527997816701"
            target="_blank"
            rel="noopener noreferrer"
            class="whatsapp-fab"
            title="Falar com o Bot Somma no WhatsApp"
            aria-label="Abrir conversa com o Bot Somma no WhatsApp"
        >
            <span class="wa-icon-wrap">
                <PhWhatsappLogo :size="24" weight="fill" />
                <span class="wa-online-dot" aria-hidden="true"></span>
            </span>
            <span class="wa-label">
                <strong>Somma Bot</strong>
                <small>Lançar via WhatsApp</small>
            </span>
        </a>
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
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
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
    min-width: 0;
    overflow: hidden;
}

/* === SALDO === */
.balance-card {
    background: var(--card-highlight-bg);
    border: 1px solid var(--card-highlight-border);
    justify-content: space-between;
}

.balance-top-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
}

.balance-badge {
    display: inline-block;
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--card-highlight-title);
    background: var(--primary-subtle);
    padding: 4px 10px;
    border-radius: 99px;
}

.vault-mini-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.72rem;
    font-weight: 600;
    padding: 3px 9px;
    border-radius: 99px;
}

.vault-mini-tag.tag-unlocked {
    background: var(--success-bg);
    color: var(--success-text);
    border: 1px solid rgba(16, 185, 129, 0.25);
}

.vault-mini-tag.tag-locked {
    background: var(--bg-elevated);
    color: var(--text-secondary);
    border: 1px solid var(--border-color);
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
    cursor: pointer;
    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease;
}

.credit-card-mockup:hover {
    transform: translateY(-4px) scale(1.02);
    box-shadow: 0 14px 28px -6px rgba(0, 0, 0, 0.5);
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

@media (max-width: 1320px) {
    .stats-chart-layout {
        flex-direction: column;
    }
    .stats-legend-list {
        width: 100%;
    }
}

@media (max-width: 960px) {
    .dashboard-grid {
        grid-template-columns: minmax(0, 1fr);
    }
}

@media (max-width: 768px) {
    .balance-amount {
        font-size: 2rem;
    }
    .balance-details {
        grid-template-columns: 1fr;
    }
    .card {
        padding: 1.25rem;
    }
    .stage-actions {
        flex-direction: column;
    }
}

/* =========================================
   ANIMAÇÃO 3D DO CARTÃO (SHOWCASE & FLIP)
   ========================================= */
.card-stage-enter-active,
.card-stage-leave-active {
    transition: opacity 0.3s ease;
}

.card-stage-enter-from,
.card-stage-leave-to {
    opacity: 0;
}

.card-stage-enter-active .card-3d-stage {
    animation: cardZoomIn 0.42s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

.card-stage-leave-active .card-3d-stage {
    animation: cardZoomOut 0.25s ease forwards;
}

@keyframes cardZoomIn {
    0% {
        opacity: 0;
        transform: scale(0.65) translateY(40px) rotateX(18deg);
    }
    100% {
        opacity: 1;
        transform: scale(1) translateY(0) rotateX(0deg);
    }
}

@keyframes cardZoomOut {
    0% {
        opacity: 1;
        transform: scale(1);
    }
    100% {
        opacity: 0;
        transform: scale(0.8) translateY(20px);
    }
}

.card-3d-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(5, 6, 10, 0.78);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
}

.card-3d-stage {
    width: 100%;
    max-width: 440px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.35rem;
}

.stage-top-hint {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: rgba(255, 255, 255, 0.75);
    font-size: 0.825rem;
    font-weight: 500;
}

.stage-close-btn {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s ease;
}

.stage-close-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: scale(1.06);
}

.scene-3d {
    width: 100%;
    height: 265px;
    perspective: 1200px;
    cursor: pointer;
    user-select: none;
}

.card-3d-object {
    width: 100%;
    height: 100%;
    position: relative;
    transform-style: preserve-3d;
    transition: transform 0.75s cubic-bezier(0.34, 1.45, 0.64, 1);
}

.card-3d-object.is-flipped {
    transform: rotateY(180deg);
}

.card-3d-face {
    position: absolute;
    inset: 0;
    border-radius: 22px;
    border: 1px solid rgba(255, 255, 255, 0.22);
    box-shadow: 0 28px 60px -12px rgba(0, 0, 0, 0.75), inset 0 1px 1px rgba(255, 255, 255, 0.25);
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    color: #FFFFFF;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
}

.card-3d-front {
    padding: 1.75rem 1.85rem;
}

.shine-effect {
    position: absolute;
    top: -60%;
    left: -60%;
    width: 220%;
    height: 220%;
    background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.18) 0%, transparent 50%);
    pointer-events: none;
}

.front-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: relative;
    z-index: 1;
}

.front-bank {
    font-size: 0.9rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.1em;
}

.front-contactless {
    opacity: 0.85;
    transform: rotate(90deg);
}

.front-chip-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: relative;
    z-index: 1;
}

.emv-chip {
    width: 48px;
    height: 36px;
    border-radius: 7px;
    background: linear-gradient(135deg, #FDE68A 0%, #D97706 100%);
    border: 1px solid rgba(255, 255, 255, 0.4);
    display: flex;
    flex-direction: column;
    justify-content: space-evenly;
    padding: 0 6px;
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.25);
}

.chip-line {
    height: 1px;
    background: rgba(120, 53, 15, 0.45);
}

.front-modality {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 3px 10px;
    border-radius: 99px;
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.15);
}

.front-bottom {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    position: relative;
    z-index: 1;
}

.front-number {
    font-family: 'Courier New', Courier, monospace;
    font-size: 1.25rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.35);
}

.front-holder-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
}

.holder-col {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.holder-lbl {
    font-size: 0.62rem;
    letter-spacing: 0.08em;
    opacity: 0.75;
}

.holder-val {
    font-size: 0.88rem;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
}

.brand-circles {
    display: flex;
    align-items: center;
}

.b-circle {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    display: inline-block;
}

.b-circle.c1 {
    background: rgba(239, 68, 68, 0.85);
}

.b-circle.c2 {
    background: rgba(245, 158, 11, 0.85);
    margin-left: -10px;
}

/* FACE TRASEIRA (VERSO DO CARTÃO) */
.card-3d-back {
    transform: rotateY(180deg);
    padding: 1.35rem 0 1.5rem;
}

.magnetic-strip {
    width: 100%;
    height: 44px;
    background: #111318;
    box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.6);
}

.back-body {
    padding: 0 1.65rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    flex: 1;
    justify-content: space-between;
}

.cvv-signature-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(255, 255, 255, 0.16);
    border-radius: 8px;
    padding: 0.45rem 0.85rem;
    margin-top: 0.35rem;
}

.sig-text {
    font-family: Georgia, serif;
    font-style: italic;
    font-size: 0.9rem;
    opacity: 0.85;
}

.cvv-box {
    font-family: monospace;
    font-size: 0.8rem;
    font-weight: 700;
    background: rgba(0, 0, 0, 0.35);
    padding: 2px 8px;
    border-radius: 5px;
}

.back-stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.65rem 1rem;
    background: rgba(0, 0, 0, 0.28);
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 12px;
    padding: 0.85rem 1rem;
}

.b-stat {
    display: flex;
    flex-direction: column;
    gap: 1px;
}

.b-stat span {
    font-size: 0.68rem;
    opacity: 0.75;
}

.b-stat strong {
    font-size: 0.9rem;
    font-weight: 700;
    font-feature-settings: "tnum";
}

.stage-actions {
    display: flex;
    gap: 0.75rem;
    width: 100%;
}

.stage-btn {
    flex: 1;
}

/* === BOTÃO FLUTUANTE WHATSAPP BOT (OBSIDIAN + EMERALD) === */
.whatsapp-fab {
    position: fixed;
    bottom: calc(24px + env(safe-area-inset-bottom, 0px));
    right: 24px;
    z-index: 950;
    display: inline-flex;
    align-items: center;
    gap: 0.65rem;
    padding: 7px 14px 7px 7px;
    border-radius: 999px;
    background: linear-gradient(135deg, rgba(18, 20, 28, 0.94) 0%, rgba(22, 34, 30, 0.96) 100%);
    border: 1px solid rgba(37, 211, 102, 0.35);
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45), 0 0 18px rgba(37, 211, 102, 0.18);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    text-decoration: none;
    color: #F8FAFC;
    transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.2s ease, border-color 0.2s ease;
}

.whatsapp-fab:hover {
    transform: translateY(-3px) scale(1.02);
    border-color: rgba(37, 211, 102, 0.7);
    box-shadow: 0 14px 32px rgba(0, 0, 0, 0.55), 0 0 24px rgba(37, 211, 102, 0.32);
}

.wa-icon-wrap {
    position: relative;
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
    color: #FFFFFF;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 4px 12px rgba(37, 211, 102, 0.4);
}

.wa-online-dot {
    position: absolute;
    top: 1px;
    right: 1px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #4ADE80;
    border: 2px solid #12141C;
    box-shadow: 0 0 8px #4ADE80;
}

.wa-label {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
}

.wa-label strong {
    font-size: 0.82rem;
    font-weight: 700;
    color: #F8FAFC;
}

.wa-label small {
    font-size: 0.68rem;
    color: #86EFAC;
    font-weight: 500;
}

@media (max-width: 640px) {
    .whatsapp-fab {
        bottom: calc(18px + env(safe-area-inset-bottom, 0px));
        right: 16px;
        padding: 6px;
    }

    .wa-label {
        display: none;
    }

    .wa-icon-wrap {
        width: 46px;
        height: 46px;
    }
}
</style>
