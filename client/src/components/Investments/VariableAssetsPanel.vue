<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import VueApexCharts from 'vue3-apexcharts';
import {
    useAssetsStore,
    type AssetClass,
    type VariableAsset
} from '../../stores/useAssetsStore';
import { useAlertStore } from '../../stores/useAlertStore';
import { getBankLogoUrl } from '../../utils/banks';
import AssetModal from './AssetModal.vue';
import ConfirmModal from '../ConfirmModal.vue';
import {
    PhPlus,
    PhArrowsClockwise,
    PhPencilSimple,
    PhTrash,
    PhTrendUp,
    PhTrendDown,
    PhCoins,
    PhCurrencyCircleDollar,
    PhChartPieSlice
} from '@phosphor-icons/vue';

const assetsStore = useAssetsStore();
const { showAlert } = useAlertStore();

const selectedClass = ref<'ALL' | AssetClass>('ALL');
const isModalOpen = ref(false);
const editingAsset = ref<VariableAsset | null>(null);
const isConfirmingDeleteAsset = ref(false);
const assetToDelete = ref<VariableAsset | null>(null);

// Estado inline para lançar dividendo / rendimento de FII em 1 clique nos Proventos do mês
const dividendAssetId = ref<string | null>(null);
const dividendAmount = ref<number>(0);

onMounted(async () => {
    await assetsStore.fetchAssets();
});

const CLASS_META: Record<AssetClass, { label: string; color: string }> = {
    ACAO: { label: 'Ações B3', color: '#6366F1' },
    FII: { label: 'FIIs', color: '#10B981' },
    ETF: { label: 'ETFs', color: '#0EA5E9' },
    CRIPTO: { label: 'Cripto', color: '#F59E0B' },
    BDR: { label: 'BDRs', color: '#A855F7' }
};

const filteredAssets = computed(() => {
    if (selectedClass.value === 'ALL') return assetsStore.assets;
    return assetsStore.assets.filter(a => a.asset_class === selectedClass.value);
});

const getPositionValue = (a: VariableAsset) => Number(a.quantity || 0) * Number(a.current_price || 0);
const getCostValue = (a: VariableAsset) => Number(a.quantity || 0) * Number(a.average_price || 0);
const getProfitBrl = (a: VariableAsset) => getPositionValue(a) - getCostValue(a);
const getProfitPct = (a: VariableAsset) => {
    const cost = getCostValue(a);
    if (cost <= 0) return 0;
    return ((getPositionValue(a) - cost) / cost) * 100;
};

const totalMarketValue = computed(() =>
    assetsStore.assets.reduce((acc, a) => acc + getPositionValue(a), 0)
);

const totalInvestedCost = computed(() =>
    assetsStore.assets.reduce((acc, a) => acc + getCostValue(a), 0)
);

const totalProfitBrl = computed(() => totalMarketValue.value - totalInvestedCost.value);

const totalProfitPct = computed(() => {
    if (totalInvestedCost.value <= 0) return 0;
    return (totalProfitBrl.value / totalInvestedCost.value) * 100;
});

const getWeightPct = (a: VariableAsset) => {
    if (totalMarketValue.value <= 0) return 0;
    return Math.round((getPositionValue(a) / totalMarketValue.value) * 1000) / 10;
};

// Dados para o gráfico Donut de alocação por classe
const allocationByClass = computed(() => {
    const totals: Record<AssetClass, number> = {
        ACAO: 0,
        FII: 0,
        ETF: 0,
        CRIPTO: 0,
        BDR: 0
    };
    for (const a of assetsStore.assets) {
        const cls = a.asset_class || 'ACAO';
        totals[cls] = (totals[cls] || 0) + getPositionValue(a);
    }
    return (Object.keys(totals) as AssetClass[])
        .filter(k => totals[k] > 0)
        .map(k => ({
            key: k,
            label: CLASS_META[k].label,
            color: CLASS_META[k].color,
            value: Math.round(totals[k] * 100) / 100,
            pct: totalMarketValue.value > 0 ? Math.round((totals[k] / totalMarketValue.value) * 100) : 0
        }))
        .sort((a, b) => b.value - a.value);
});

const chartSeries = computed(() => allocationByClass.value.map(item => item.value));

const chartOptions = computed(() => ({
    chart: {
        type: 'donut' as const,
        background: 'transparent',
        fontFamily: 'Inter, sans-serif'
    },
    labels: allocationByClass.value.map(item => item.label),
    colors: allocationByClass.value.map(item => item.color),
    stroke: { show: false },
    dataLabels: { enabled: false },
    legend: { show: false },
    plotOptions: {
        pie: {
            donut: {
                size: '72%',
                labels: {
                    show: true,
                    name: { show: true, color: '#94A3B8', fontSize: '12px' },
                    value: {
                        show: true,
                        color: '#F8FAFC',
                        fontSize: '16px',
                        fontWeight: 700,
                        formatter: (val: string) => formatCurrency(Number(val))
                    },
                    total: {
                        show: true,
                        label: 'Alocação',
                        color: '#94A3B8',
                        formatter: () => `${assetsStore.assets.length} ativos`
                    }
                }
            }
        }
    },
    tooltip: {
        theme: 'dark',
        y: {
            formatter: (val: number) => formatCurrency(val)
        }
    }
}));

const openCreate = () => {
    editingAsset.value = null;
    isModalOpen.value = true;
};

const openEdit = (asset: VariableAsset) => {
    editingAsset.value = asset;
    isModalOpen.value = true;
};

const handleDelete = (asset: VariableAsset) => {
    assetToDelete.value = asset;
    isConfirmingDeleteAsset.value = true;
};

const executeDeleteAsset = async () => {
    if (assetToDelete.value) {
        const ticker = assetToDelete.value.ticker;
        await assetsStore.deleteAsset(assetToDelete.value.id_asset);
        showAlert(`${ticker} removido da carteira.`, 'success');
    }
    isConfirmingDeleteAsset.value = false;
    assetToDelete.value = null;
};

const handleSyncQuotes = async () => {
    const { updatedCount, failedCount } = await assetsStore.syncAllLivePrices();
    if (updatedCount > 0) {
        showAlert(
            `${updatedCount} cotação(ões) atualizada(s) ao vivo!${failedCount > 0 ? ` (${failedCount} sem retorno automático)` : ''}`,
            'success'
        );
    } else {
        showAlert('Não foi possível sincronizar cotações agora. Tente novamente em instantes.', 'warning');
    }
};

const openDividendInput = (asset: VariableAsset) => {
    dividendAssetId.value = asset.id_asset;
    // Pré-preenche automaticamente com o cálculo (Qtd x Dividendo/Cota da B3 ou Staking APY/12 de Cripto)!
    const autoEstimate = assetsStore.getEstimatedProventoBrl(asset);
    dividendAmount.value = autoEstimate > 0 ? autoEstimate : 0;
};

const quickLaunchEstimatedDividend = async (asset: VariableAsset) => {
    const autoEstimate = assetsStore.getEstimatedProventoBrl(asset);
    if (autoEstimate <= 0) {
        openDividendInput(asset);
        return;
    }
    try {
        const res = await assetsStore.registerDividendToProventos(asset, autoEstimate);
        if (res) {
            showAlert(
                `Provento calculado automaticamente lançado! "${res.title}" agora soma ${formatCurrency(res.totalMonthValue)} nos Proventos do mês.`,
                'success'
            );
        }
    } catch {
        showAlert('Erro ao lançar provento.', 'error');
    }
};

const confirmDividend = async (asset: VariableAsset) => {
    if (!dividendAmount.value || dividendAmount.value <= 0) return;
    try {
        const res = await assetsStore.registerDividendToProventos(asset, dividendAmount.value);
        dividendAssetId.value = null;
        if (res) {
            showAlert(
                `Provento lançado! "${res.title}" agora soma ${formatCurrency(res.totalMonthValue)} nos Proventos deste mês.`,
                'success'
            );
        }
    } catch {
        showAlert('Erro ao lançar dividendo nos Proventos.', 'error');
    }
};

const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

const formatQty = (qty: number, cls: AssetClass) => {
    if (cls === 'CRIPTO') {
        return Number(qty).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 8 });
    }
    return Number(qty).toLocaleString('pt-BR', { maximumFractionDigits: 4 });
};
</script>

<template>
    <div class="variable-assets-wrapper">
        <!-- 1. HERO + ALOCAÇÃO POR CLASSE -->
        <section class="var-overview-grid">
            <div class="var-hero-card">
                <div class="hero-ambient"></div>
                <div class="var-hero-top">
                    <div>
                        <span class="hero-eyebrow">Patrimônio em Renda Variável & Cripto</span>
                        <h2 class="hero-total-val">{{ formatCurrency(totalMarketValue) }}</h2>
                    </div>

                    <div class="hero-actions-row">
                        <button
                            v-if="assetsStore.assets.length > 0"
                            class="btn-outline btn-sm"
                            :disabled="assetsStore.isSyncingQuotes"
                            @click="handleSyncQuotes"
                        >
                            <PhArrowsClockwise size="15" weight="bold" :class="{ spinning: assetsStore.isSyncingQuotes }" />
                            {{ assetsStore.isSyncingQuotes ? 'Atualizando...' : 'Atualizar Cotações' }}
                        </button>
                        <button class="btn-primary btn-sm" @click="openCreate">
                            <PhPlus size="15" weight="bold" />
                            Novo Ativo
                        </button>
                    </div>
                </div>

                <div class="var-kpi-strip">
                    <div class="vk-item">
                        <span>Custo Investido (PM)</span>
                        <strong>{{ formatCurrency(totalInvestedCost) }}</strong>
                    </div>
                    <div class="vk-item">
                        <span>Resultado (Lucro / Prejuízo)</span>
                        <strong :class="totalProfitBrl >= 0 ? 'text-success' : 'text-danger'">
                            {{ totalProfitBrl >= 0 ? '+' : '' }}{{ formatCurrency(totalProfitBrl) }}
                        </strong>
                    </div>
                    <div class="vk-item">
                        <span>Rentabilidade Geral</span>
                        <span class="pnl-badge" :class="totalProfitPct >= 0 ? 'positive' : 'negative'">
                            <PhTrendUp v-if="totalProfitPct >= 0" size="13" weight="bold" />
                            <PhTrendDown v-else size="13" weight="bold" />
                            {{ totalProfitPct >= 0 ? '+' : '' }}{{ totalProfitPct.toFixed(2).replace('.', ',') }}%
                        </span>
                    </div>
                </div>
            </div>

            <!-- Card Direito: Gráfico Donut de Alocação -->
            <div class="allocation-card">
                <div class="alloc-header">
                    <PhChartPieSlice size="18" weight="duotone" class="text-primary" />
                    <h3>Alocação por Classe</h3>
                </div>

                <div v-if="allocationByClass.length > 0" class="alloc-body">
                    <div class="donut-box">
                        <VueApexCharts
                            type="donut"
                            width="155"
                            height="155"
                            :options="chartOptions"
                            :series="chartSeries"
                        />
                    </div>
                    <div class="alloc-legend">
                        <div v-for="item in allocationByClass" :key="item.key" class="legend-row">
                            <div class="legend-left">
                                <span class="legend-dot" :style="{ backgroundColor: item.color }"></span>
                                <span class="legend-name">{{ item.label }}</span>
                            </div>
                            <div class="legend-right">
                                <strong>{{ item.pct }}%</strong>
                                <small>{{ formatCurrency(item.value) }}</small>
                            </div>
                        </div>
                    </div>
                </div>
                <div v-else class="alloc-empty">
                    Cadastre Ações, FIIs, ETFs ou Cripto para ver sua distribuição por classe.
                </div>
            </div>
        </section>

        <!-- 2. FILTROS POR CLASSE -->
        <div v-if="assetsStore.assets.length > 0" class="class-filter-bar">
            <button
                class="filter-chip"
                :class="{ active: selectedClass === 'ALL' }"
                @click="selectedClass = 'ALL'"
            >
                Todos ({{ assetsStore.assets.length }})
            </button>
            <button
                v-for="(meta, key) in CLASS_META"
                :key="key"
                class="filter-chip"
                :class="{ active: selectedClass === key }"
                @click="selectedClass = key as AssetClass"
            >
                {{ meta.label }} ({{ assetsStore.assets.filter(a => a.asset_class === key).length }})
            </button>
        </div>

        <!-- 3. GRID DE ATIVOS -->
        <div v-if="assetsStore.isLoading" class="loading-box">
            Carregando ativos de renda variável e cripto...
        </div>

        <div v-else-if="filteredAssets.length > 0" class="assets-grid">
            <div
                v-for="asset in filteredAssets"
                :key="asset.id_asset"
                class="asset-card"
                :style="{ borderTop: `3px solid ${CLASS_META[asset.asset_class]?.color || '#6366F1'}` }"
            >
                <div class="asset-header">
                    <div class="asset-id-block">
                        <div
                            class="ticker-badge"
                            :style="{
                                backgroundColor: `${CLASS_META[asset.asset_class]?.color || '#6366F1'}1F`,
                                color: CLASS_META[asset.asset_class]?.color || '#6366F1'
                            }"
                        >
                            {{ asset.ticker }}
                        </div>
                        <div class="asset-title-stack">
                            <strong>{{ asset.name || asset.ticker }}</strong>
                            <div class="broker-row">
                                <img
                                    v-if="asset.broker && getBankLogoUrl(asset.broker)"
                                    :src="getBankLogoUrl(asset.broker) ?? undefined"
                                    class="mini-broker-logo"
                                    :alt="asset.broker"
                                />
                                <span>{{ CLASS_META[asset.asset_class]?.label }} • {{ asset.broker || 'Custódia Própria' }}</span>
                            </div>
                        </div>
                    </div>

                    <div class="asset-header-actions">
                        <button class="icon-btn edit-btn" @click="openEdit(asset)" title="Editar ativo">
                            <PhPencilSimple size="16" />
                        </button>
                        <button class="icon-btn delete-btn" @click="handleDelete(asset)" title="Remover ativo">
                            <PhTrash size="16" />
                        </button>
                    </div>
                </div>

                <!-- Valor da Posição & Rentabilidade -->
                <div class="position-row">
                    <div>
                        <span class="pos-lbl">Posição Atual</span>
                        <h3 class="pos-val">{{ formatCurrency(getPositionValue(asset)) }}</h3>
                    </div>
                    <div class="pnl-col">
                        <span class="pnl-badge" :class="getProfitBrl(asset) >= 0 ? 'positive' : 'negative'">
                            {{ getProfitPct(asset) >= 0 ? '+' : '' }}{{ getProfitPct(asset).toFixed(2).replace('.', ',') }}%
                        </span>
                        <small :class="getProfitBrl(asset) >= 0 ? 'text-success' : 'text-danger'">
                            {{ getProfitBrl(asset) >= 0 ? '+' : '' }}{{ formatCurrency(getProfitBrl(asset)) }}
                        </small>
                    </div>
                </div>

                <!-- Barra de Peso na Carteira -->
                <div class="weight-bar-wrap">
                    <div class="weight-labels">
                        <span>Peso na Carteira Variável</span>
                        <strong>{{ getWeightPct(asset) }}%</strong>
                    </div>
                    <div class="progress-bar">
                        <div
                            class="progress-fill"
                            :style="{
                                width: Math.min(100, getWeightPct(asset)) + '%',
                                backgroundColor: CLASS_META[asset.asset_class]?.color || '#6366F1'
                            }"
                        ></div>
                    </div>
                </div>

                <!-- Quadro Técnico: Quantidade | Preço Médio | Cotação Atual -->
                <div class="asset-metrics-box">
                    <div class="am-col">
                        <span>Qtd</span>
                        <strong>{{ formatQty(asset.quantity, asset.asset_class) }}</strong>
                    </div>
                    <div class="am-col">
                        <span>Preço Médio</span>
                        <strong>{{ formatCurrency(asset.average_price) }}</strong>
                    </div>
                    <div class="am-col align-right">
                        <span>Cotação Atual</span>
                        <strong>{{ formatCurrency(asset.current_price) }}</strong>
                    </div>
                </div>

                <!-- Lançamento Automático / Rápido de Dividendos (B3) ou Staking (Cripto) -->
                <div v-if="dividendAssetId === asset.id_asset" class="dividend-inline-box">
                    <label>
                        {{
                            asset.asset_class === 'FII'
                                ? 'Rendimento FII recebido (R$):'
                                : (asset.asset_class === 'CRIPTO' ? 'Staking / Earn mensal (R$):' : 'Dividendo / JCP líquido recebido (R$):')
                        }}
                    </label>
                    <div class="div-input-row">
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            v-model.number="dividendAmount"
                            placeholder="Ex: 14.50"
                            @keyup.enter="confirmDividend(asset)"
                        />
                        <button class="btn-div-save" @click="confirmDividend(asset)">Lançar</button>
                        <button class="btn-div-cancel" @click="dividendAssetId = null">✕</button>
                    </div>
                </div>
                <div v-else class="asset-footer-stack">
                    <!-- Banner de Provento Calculado Automaticamente (B3 Dividendos ou Cripto Staking APY) -->
                    <div v-if="assetsStore.getEstimatedProventoBrl(asset) > 0" class="auto-provento-banner">
                        <div class="ap-text">
                            <span v-if="asset.asset_class === 'CRIPTO'">
                                Staking ({{ asset.staking_apy }}% APY): <strong>~{{ formatCurrency(assetsStore.getEstimatedProventoBrl(asset)) }}/mês</strong>
                            </span>
                            <span v-else>
                                Último provento ({{ formatCurrency(Number(asset.last_dividend_per_share || 0)) }}/cota):
                                <strong>{{ formatCurrency(assetsStore.getEstimatedProventoBrl(asset)) }}</strong>
                            </span>
                        </div>
                        <div class="ap-btns">
                            <button
                                type="button"
                                class="btn-ap-launch"
                                @click="quickLaunchEstimatedDividend(asset)"
                                title="Lança este valor calculado direto em Registros -> Entradas (Proventos)"
                            >
                                + Lançar
                            </button>
                            <button
                                type="button"
                                class="btn-ap-edit"
                                @click="openDividendInput(asset)"
                                title="Ajustar valor antes de lançar (ex: descontar IR de JCP)"
                            >
                                Ajustar
                            </button>
                        </div>
                    </div>

                    <div v-else class="asset-footer-actions">
                        <button
                            v-if="asset.asset_class !== 'CRIPTO'"
                            type="button"
                            class="btn-dividend"
                            @click="openDividendInput(asset)"
                        >
                            <PhCurrencyCircleDollar size="15" weight="bold" />
                            Lançar Dividendo / Provento
                        </button>
                        <button
                            v-else
                            type="button"
                            class="btn-dividend"
                            @click="openEdit(asset)"
                        >
                            <PhCoins size="15" weight="bold" />
                            Configurar Staking (APY) / Editar
                        </button>
                    </div>
                </div>
            </div>

            <!-- Card Fantasma "+ Novo Ativo" -->
            <button type="button" class="add-asset-ghost" @click="openCreate">
                <div class="ghost-circle">
                    <PhPlus size="22" weight="bold" />
                </div>
                <strong>Adicionar Ação, FII, ETF ou Cripto</strong>
                <span>Acompanhe preço médio, lucro/prejuízo, cotação ao vivo e lance dividendos direto nos Proventos</span>
            </button>
        </div>

        <div v-else class="empty-assets-card">
            <div class="ghost-circle">
                <PhTrendUp size="26" weight="duotone" />
            </div>
            <h3>Sua Carteira de Renda Variável & Cripto está pronta</h3>
            <p>Cadastre suas Ações da B3, FIIs, ETFs, BDRs ou Criptomoedas (Bitcoin, Ethereum, Solana, USDT) com acompanhamento de preço médio e proventos.</p>
            <button class="btn-primary" @click="openCreate" style="margin-top: 0.5rem;">
                <PhPlus size="16" weight="bold" /> Cadastrar Primeiro Ativo
            </button>
        </div>
    </div>

    <AssetModal
        v-if="isModalOpen"
        :assetToEdit="editingAsset"
        @close="isModalOpen = false"
    />

    <ConfirmModal
        :isOpen="isConfirmingDeleteAsset"
        title="Remover Ativo da Carteira?"
        :message="`Tem certeza que deseja remover ${assetToDelete?.ticker || 'este ativo'} da sua carteira de renda variável?`"
        @confirm="executeDeleteAsset"
        @cancel="isConfirmingDeleteAsset = false"
    />
</template>

<style scoped>
.text-success { color: var(--success-text); }
.text-danger { color: var(--danger-color); }
.text-primary { color: var(--primary-color); }

.variable-assets-wrapper {
    display: flex;
    flex-direction: column;
    gap: 1.4rem;
}

.var-overview-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr);
    gap: 1.25rem;
}

.var-hero-card {
    position: relative;
    overflow: hidden;
    background: var(--card-highlight-bg);
    border: 1px solid var(--card-highlight-border);
    border-radius: 18px;
    padding: 1.75rem;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 1.5rem;
    box-shadow: var(--shadow-sm);
}

.hero-ambient {
    position: absolute;
    top: -90px;
    right: -60px;
    width: 260px;
    height: 260px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(245, 158, 11, 0.14) 0%, transparent 70%);
    pointer-events: none;
}

.var-hero-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 1rem;
    position: relative;
    z-index: 1;
}

.hero-eyebrow {
    display: block;
    font-size: 0.78rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--card-highlight-title);
    margin-bottom: 0.35rem;
}

.hero-total-val {
    margin: 0;
    font-size: 2.35rem;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: var(--card-highlight-text);
    font-feature-settings: "tnum";
}

.hero-actions-row {
    display: flex;
    gap: 0.55rem;
    flex-wrap: wrap;
}

.btn-sm {
    padding: 0.5rem 0.9rem;
    font-size: 0.8rem;
}

.spinning {
    animation: spin 1s linear infinite;
}

@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

.var-kpi-strip {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1rem;
    padding-top: 1.1rem;
    border-top: 1px solid var(--border-color);
    position: relative;
    z-index: 1;
}

.vk-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.vk-item span {
    font-size: 0.72rem;
    color: var(--text-secondary);
}

.vk-item strong {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-primary);
    font-feature-settings: "tnum";
}

.pnl-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    width: fit-content;
    padding: 3px 9px;
    border-radius: 99px;
    font-size: 0.76rem;
    font-weight: 700;
    font-feature-settings: "tnum";
}

.pnl-badge.positive {
    background: var(--success-bg);
    color: var(--success-text);
}

.pnl-badge.negative {
    background: var(--danger-bg);
    color: var(--danger-color);
}

.allocation-card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 18px;
    padding: 1.35rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    box-shadow: var(--shadow-sm);
}

.alloc-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.alloc-header h3 {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--text-primary);
}

.alloc-body {
    display: flex;
    align-items: center;
    gap: 1.15rem;
    flex: 1;
}

.donut-box {
    flex-shrink: 0;
}

.alloc-legend {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 0;
}

.legend-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
}

.legend-left {
    display: flex;
    align-items: center;
    gap: 6px;
}

.legend-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    flex-shrink: 0;
}

.legend-name {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--text-primary);
}

.legend-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    font-feature-settings: "tnum";
}

.legend-right strong {
    font-size: 0.78rem;
    color: var(--text-primary);
}

.legend-right small {
    font-size: 0.68rem;
    color: var(--text-muted);
}

.alloc-empty {
    font-size: 0.82rem;
    color: var(--text-muted);
    margin: auto 0;
    text-align: center;
    padding: 1.5rem 0.5rem;
}

.class-filter-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
}

.filter-chip {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
    font-family: inherit;
    font-size: 0.78rem;
    font-weight: 600;
    padding: 0.4rem 0.85rem;
    border-radius: 99px;
    cursor: pointer;
    transition: all 0.15s ease;
}

.filter-chip.active {
    background: var(--primary-color);
    border-color: var(--primary-color);
    color: white;
}

.assets-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 330px), 1fr));
    gap: 1.2rem;
}

.asset-card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 16px;
    padding: 1.3rem 1.4rem;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 1rem;
    box-shadow: var(--shadow-sm);
    transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.asset-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
}

.asset-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.5rem;
}

.asset-id-block {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
}

.ticker-badge {
    padding: 0.5rem 0.7rem;
    border-radius: 11px;
    font-size: 0.9rem;
    font-weight: 800;
    letter-spacing: 0.02em;
    flex-shrink: 0;
}

.asset-title-stack {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
}

.asset-title-stack strong {
    font-size: 0.95rem;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.broker-row {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 0.74rem;
    color: var(--text-secondary);
}

.mini-broker-logo {
    width: 15px;
    height: 15px;
    border-radius: 4px;
    background: white;
    padding: 1px;
    object-fit: contain;
}

.asset-header-actions {
    display: flex;
    gap: 4px;
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

.icon-btn.edit-btn:hover {
    color: var(--primary-color);
    background: var(--primary-subtle);
}

.icon-btn.delete-btn:hover {
    color: var(--danger-color);
    background: var(--danger-bg);
}

.position-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 0.5rem;
}

.pos-lbl {
    font-size: 0.7rem;
    color: var(--text-muted);
    display: block;
}

.pos-val {
    margin: 2px 0 0 0;
    font-size: 1.55rem;
    font-weight: 800;
    color: var(--text-primary);
    letter-spacing: -0.02em;
    font-feature-settings: "tnum";
}

.pnl-col {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 3px;
}

.pnl-col small {
    font-size: 0.76rem;
    font-weight: 700;
    font-feature-settings: "tnum";
}

.weight-bar-wrap {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.weight-labels {
    display: flex;
    justify-content: space-between;
    font-size: 0.7rem;
    color: var(--text-muted);
}

.weight-labels strong {
    color: var(--text-primary);
}

.progress-bar {
    width: 100%;
    height: 6px;
    background: var(--bg-elevated);
    border-radius: 99px;
    overflow: hidden;
}

.progress-fill {
    height: 100%;
    border-radius: 99px;
}

.asset-metrics-box {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 0.5rem;
    background: var(--bg-elevated);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    padding: 0.6rem 0.75rem;
}

.am-col {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.am-col.align-right {
    text-align: right;
}

.am-col span {
    font-size: 0.67rem;
    color: var(--text-muted);
}

.am-col strong {
    font-size: 0.78rem;
    color: var(--text-primary);
    font-feature-settings: "tnum";
}

.asset-footer-stack {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
}

.auto-provento-banner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.45rem;
    background: var(--success-bg);
    border: 1px solid rgba(16, 185, 129, 0.3);
    color: var(--success-text);
    padding: 0.5rem 0.7rem;
    border-radius: 10px;
    font-size: 0.72rem;
}

.ap-btns {
    display: flex;
    gap: 4px;
}

.btn-ap-launch,
.btn-ap-edit {
    border: none;
    border-radius: 6px;
    padding: 4px 8px;
    font-size: 0.69rem;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
}

.btn-ap-launch {
    background: #10B981;
    color: #052E16;
}

.btn-ap-edit {
    background: rgba(255, 255, 255, 0.12);
    color: var(--text-primary);
}

.asset-footer-actions {
    display: flex;
}

.btn-dividend {
    width: 100%;
    height: 36px;
    border-radius: 10px;
    border: 1px solid rgba(16, 185, 129, 0.28);
    background: var(--success-bg);
    color: var(--success-text);
    font-family: inherit;
    font-size: 0.78rem;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
}

.btn-dividend:hover {
    background: #10B981;
    color: #052E16;
}

.dividend-inline-box {
    background: var(--bg-elevated);
    border: 1px solid #10B981;
    border-radius: 10px;
    padding: 0.55rem 0.7rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
}

.dividend-inline-box label {
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--text-primary);
}

.div-input-row {
    display: flex;
    gap: 0.4rem;
}

.div-input-row input {
    flex: 1;
    min-width: 0;
    padding: 0.35rem 0.55rem;
    font-size: 0.82rem;
}

.btn-div-save {
    background: #10B981;
    color: #052E16;
    border: none;
    border-radius: 7px;
    padding: 0 0.75rem;
    font-size: 0.74rem;
    font-weight: 700;
    cursor: pointer;
}

.btn-div-cancel {
    background: transparent;
    color: var(--text-muted);
    border: 1px solid var(--border-color);
    border-radius: 7px;
    padding: 0 0.5rem;
    cursor: pointer;
}

.add-asset-ghost {
    background: transparent;
    border: 1.5px dashed var(--border-color);
    border-radius: 16px;
    padding: 2rem 1.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 0.5rem;
    cursor: pointer;
    color: var(--text-secondary);
    font-family: inherit;
    min-height: 230px;
    transition: all 0.18s ease;
}

.add-asset-ghost:hover {
    border-color: var(--primary-color);
    background: var(--primary-subtle);
    color: var(--text-primary);
}

.ghost-circle {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--bg-elevated);
    border: 1px solid var(--border-color);
    color: var(--primary-color);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 0.25rem;
}

.add-asset-ghost strong {
    font-size: 0.92rem;
    color: var(--text-primary);
}

.add-asset-ghost span {
    font-size: 0.76rem;
    color: var(--text-secondary);
    max-width: 240px;
    line-height: 1.45;
}

.empty-assets-card {
    background: var(--bg-card);
    border: 1px dashed var(--border-color);
    border-radius: 18px;
    padding: 3.5rem 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.5rem;
}

.empty-assets-card h3 {
    margin: 0;
    font-size: 1.2rem;
    color: var(--text-primary);
}

.empty-assets-card p {
    margin: 0;
    color: var(--text-secondary);
    max-width: 480px;
    font-size: 0.88rem;
}

@media (max-width: 960px) {
    .var-overview-grid {
        grid-template-columns: 1fr;
    }
    .alloc-body {
        flex-direction: column;
    }
}

@media (max-width: 640px) {
    .var-hero-card {
        padding: 1.2rem;
    }
    .hero-total-val {
        font-size: 1.8rem;
    }
    .var-kpi-strip {
        grid-template-columns: 1fr;
        gap: 0.75rem;
    }
    .asset-card {
        padding: 1.1rem;
    }
    .pos-val {
        font-size: 1.35rem;
    }
    .asset-metrics-box {
        grid-template-columns: 1fr;
        gap: 0.5rem;
    }
    .am-col {
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
    }
    .am-col.align-right {
        text-align: left;
    }
    .icon-btn {
        width: 36px;
        height: 36px;
    }
}
</style>
