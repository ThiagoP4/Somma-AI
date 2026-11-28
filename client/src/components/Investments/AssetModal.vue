<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
    useAssetsStore,
    type AssetClass,
    type VariableAsset
} from '../../stores/useAssetsStore';
import { useAlertStore } from '../../stores/useAlertStore';
import { PhX, PhTrendUp, PhMagnifyingGlass, PhCoins } from '@phosphor-icons/vue';

const props = defineProps<{
    assetToEdit?: VariableAsset | null;
}>();

const emit = defineEmits(['close']);

const assetsStore = useAssetsStore();
const { showAlert } = useAlertStore();

const isEditing = computed(() => Boolean(props.assetToEdit));

const assetClass = ref<AssetClass>('ACAO');
const ticker = ref('');
const name = ref('');
const broker = ref('Banco Inter');
const quantity = ref<number>(0);
const averagePrice = ref<number>(0);
const currentPrice = ref<number>(0);
const stakingApy = ref<number | null>(null);
const lastDividendPerShare = ref<number | null>(null);
const lastDividendDate = ref<string | null>(null);
const isSearchingQuote = ref(false);
const isSaving = ref(false);

const ASSET_CLASSES: { value: AssetClass; label: string; hint: string }[] = [
    { value: 'ACAO', label: 'Ação (B3)', hint: 'Ex: PETR4, VALE3, ITUB4' },
    { value: 'FII', label: 'FII', hint: 'Ex: MXRF11, HGLG11, XPML11' },
    { value: 'ETF', label: 'ETF', hint: 'Ex: IVVB11, BOVA11, WRLD11' },
    { value: 'CRIPTO', label: 'Cripto', hint: 'Ex: BTC, ETH, SOL, USDT' },
    { value: 'BDR', label: 'BDR / Ext.', hint: 'Ex: AAPL34, NVDC34, MSFT34' }
];

const BROKERS = [
    'Banco Inter',
    'XP Investimentos',
    'BTG Pactual',
    'Nubank / NuInvest',
    'Rico',
    'Clear',
    'Binance',
    'Mercado Bitcoin',
    'Coinbase',
    'Cold Wallet / Hardware',
    'Outra Corretora'
];

const currentHint = computed(() => {
    return ASSET_CLASSES.find(c => c.value === assetClass.value)?.hint || 'Ex: PETR4';
});

onMounted(() => {
    if (props.assetToEdit) {
        assetClass.value = props.assetToEdit.asset_class || 'ACAO';
        ticker.value = props.assetToEdit.ticker || '';
        name.value = props.assetToEdit.name || '';
        broker.value = props.assetToEdit.broker || 'Banco Inter';
        quantity.value = Number(props.assetToEdit.quantity) || 0;
        averagePrice.value = Number(props.assetToEdit.average_price) || 0;
        currentPrice.value = Number(props.assetToEdit.current_price) || 0;
        stakingApy.value = props.assetToEdit.staking_apy ?? null;
        lastDividendPerShare.value = props.assetToEdit.last_dividend_per_share ?? null;
        lastDividendDate.value = props.assetToEdit.last_dividend_date ?? null;
    }
});

const handleLookupQuote = async () => {
    if (!ticker.value.trim()) {
        showAlert('Digite o ticker primeiro (ex: PETR4, MXRF11 ou BTC).', 'warning');
        return;
    }
    isSearchingQuote.value = true;
    try {
        const quote = await assetsStore.fetchLiveQuote(ticker.value, assetClass.value);
        if (quote && quote.price > 0) {
            currentPrice.value = quote.price;
            if (!averagePrice.value || averagePrice.value <= 0) {
                averagePrice.value = quote.price;
            }
            if (quote.name && !name.value.trim()) {
                name.value = quote.name;
            }
            if (quote.last_dividend_per_share) {
                lastDividendPerShare.value = quote.last_dividend_per_share;
                lastDividendDate.value = quote.last_dividend_date || null;
            }
            const divMsg = quote.last_dividend_per_share
                ? ` • Último provento: R$ ${quote.last_dividend_per_share.toFixed(2).replace('.', ',')}/cota`
                : '';
            showAlert(`Cotação encontrada para ${ticker.value.toUpperCase()}: R$ ${quote.price.toFixed(2).replace('.', ',')}${divMsg}`, 'success');
        } else {
            showAlert('Não foi possível buscar a cotação automática agora. Você pode informar o preço manualmente.', 'warning');
        }
    } finally {
        isSearchingQuote.value = false;
    }
};

const handleSave = async () => {
    if (!ticker.value.trim()) {
        showAlert('Informe o Ticker do ativo.', 'warning');
        return;
    }
    if (quantity.value <= 0) {
        showAlert('Informe uma quantidade maior que zero.', 'warning');
        return;
    }

    isSaving.value = true;
    try {
        const payload = {
            ticker: ticker.value.trim().toUpperCase(),
            name: name.value.trim() || null,
            asset_class: assetClass.value,
            broker: broker.value,
            quantity: Number(quantity.value),
            average_price: Number(averagePrice.value) || 0,
            current_price: Number(currentPrice.value) || Number(averagePrice.value) || 0,
            staking_apy: assetClass.value === 'CRIPTO' && stakingApy.value ? Number(stakingApy.value) : null,
            last_dividend_per_share: lastDividendPerShare.value,
            last_dividend_date: lastDividendDate.value,
            currency: 'BRL'
        };

        if (isEditing.value && props.assetToEdit) {
            await assetsStore.updateAsset(props.assetToEdit.id_asset, payload);
            showAlert(`${payload.ticker} atualizado na carteira!`, 'success');
        } else {
            await assetsStore.createAsset(payload);
            showAlert(`${payload.ticker} adicionado à carteira!`, 'success');
        }
        emit('close');
    } catch (err: any) {
        showAlert(err?.message || 'Erro ao salvar ativo na carteira.', 'error');
    } finally {
        isSaving.value = false;
    }
};
</script>

<template>
    <div class="modal-overlay" @click.self="$emit('close')">
        <div class="modal-content">
            <div class="modal-header">
                <div class="header-with-icon">
                    <div class="header-icon">
                        <PhCoins v-if="assetClass === 'CRIPTO'" size="22" weight="duotone" />
                        <PhTrendUp v-else size="22" weight="bold" />
                    </div>
                    <div>
                        <h3>{{ isEditing ? `Editar ${props.assetToEdit?.ticker}` : 'Novo Ativo (B3 / Cripto)' }}</h3>
                        <p class="modal-sub">Cadastre uma Ação, FII, ETF, BDR ou Criptomoeda na sua Carteira Digital</p>
                    </div>
                </div>
                <button class="close-btn" @click="$emit('close')"><PhX size="20" /></button>
            </div>

            <!-- Classe do Ativo -->
            <div class="input-group">
                <label>Classe do Ativo</label>
                <div class="class-pills">
                    <button
                        v-for="item in ASSET_CLASSES"
                        :key="item.value"
                        type="button"
                        class="class-pill"
                        :class="{ active: assetClass === item.value }"
                        @click="assetClass = item.value"
                    >
                        {{ item.label }}
                    </button>
                </div>
            </div>

            <!-- Ticker + Busca de Cotação -->
            <div class="input-group">
                <label>Ticker / Código do Ativo</label>
                <div class="ticker-row">
                    <input
                        v-model="ticker"
                        type="text"
                        :placeholder="currentHint"
                        style="text-transform: uppercase; font-weight: 700;"
                        @keyup.enter="handleLookupQuote"
                    />
                    <button
                        type="button"
                        class="btn-quote-lookup"
                        :disabled="isSearchingQuote"
                        @click="handleLookupQuote"
                    >
                        <PhMagnifyingGlass size="15" weight="bold" />
                        {{ isSearchingQuote ? 'Buscando...' : 'Cotação Ao Vivo' }}
                    </button>
                </div>
            </div>

            <div class="form-grid-2">
                <div class="input-group">
                    <label>Nome do Ativo <small>(opcional)</small></label>
                    <input v-model="name" type="text" placeholder="Ex: Maxi Renda FII / Bitcoin" />
                </div>

                <div class="input-group">
                    <label>Corretora / Exchange / Wallet</label>
                    <select v-model="broker">
                        <option v-for="b in BROKERS" :key="b" :value="b">{{ b }}</option>
                    </select>
                </div>
            </div>

            <div class="form-grid-3">
                <div class="input-group">
                    <label>Quantidade {{ assetClass === 'CRIPTO' ? '(aceita frações)' : '(cotas/ações)' }}</label>
                    <input
                        v-model.number="quantity"
                        type="number"
                        min="0"
                        :step="assetClass === 'CRIPTO' ? '0.00000001' : '1'"
                        placeholder="0"
                    />
                </div>

                <div class="input-group">
                    <label>Preço Médio (R$)</label>
                    <input v-model.number="averagePrice" type="number" min="0" step="0.01" placeholder="0.00" />
                </div>

                <div class="input-group">
                    <label>Cotação Atual (R$)</label>
                    <input v-model.number="currentPrice" type="number" min="0" step="0.01" placeholder="0.00" />
                </div>
            </div>

            <!-- Campo opcional de Staking / Earn para Cripto -->
            <div v-if="assetClass === 'CRIPTO'" class="input-group">
                <label>Staking / Earn (% APY ao ano) <small>(deixe 0 ou vazio se for apenas Hold)</small></label>
                <input
                    v-model.number="stakingApy"
                    type="number"
                    min="0"
                    max="200"
                    step="0.1"
                    placeholder="Ex: 7.5 (SOL Staking) ou 0 (Hold sem rendimento)"
                />
            </div>

            <div class="modal-actions">
                <button class="btn-outline" @click="$emit('close')">Cancelar</button>
                <button class="btn-primary" :disabled="isSaving" @click="handleSave">
                    {{ isSaving ? 'Salvando...' : (isEditing ? 'Salvar Alterações' : 'Adicionar à Carteira') }}
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.68);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
}

.modal-content {
    background: var(--bg-card);
    padding: 1.75rem;
    border-radius: 18px;
    width: 100%;
    max-width: 560px;
    max-height: 92vh;
    overflow-y: auto;
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-md);
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.35rem;
}

.header-with-icon {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.header-icon {
    width: 42px;
    height: 42px;
    border-radius: 11px;
    background: var(--primary-subtle);
    color: var(--primary-color);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.modal-header h3 {
    margin: 0;
    font-size: 1.15rem;
    color: var(--text-primary);
}

.modal-sub {
    margin: 2px 0 0 0;
    font-size: 0.78rem;
    color: var(--text-secondary);
}

.close-btn {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 4px;
}

.input-group {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    margin-bottom: 0.95rem;
    min-width: 0;
}

.input-group label {
    font-size: 0.78rem;
    color: var(--text-secondary);
    font-weight: 600;
}

.input-group label small {
    font-weight: 400;
    color: var(--text-muted);
}

.input-group input,
.input-group select {
    padding: 0.65rem 0.8rem;
}

.class-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
}

.class-pill {
    background: var(--bg-elevated);
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
    font-family: inherit;
    font-size: 0.76rem;
    font-weight: 600;
    padding: 0.42rem 0.8rem;
    border-radius: 9px;
    cursor: pointer;
    transition: all 0.15s ease;
}

.class-pill.active {
    background: var(--primary-color);
    border-color: var(--primary-color);
    color: white;
}

.ticker-row {
    display: flex;
    gap: 0.55rem;
}

.ticker-row input {
    flex: 1;
    min-width: 0;
}

.btn-quote-lookup {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--primary-subtle);
    color: var(--primary-color);
    border: 1px solid rgba(99, 102, 241, 0.3);
    border-radius: 10px;
    padding: 0 0.9rem;
    font-family: inherit;
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
}

.btn-quote-lookup:hover:not(:disabled) {
    background: var(--primary-color);
    color: white;
}

.btn-quote-lookup:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.form-grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.85rem;
}

.form-grid-3 {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 0.75rem;
}

.modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 0.5rem;
}

@media (max-width: 560px) {
    .form-grid-2,
    .form-grid-3 {
        grid-template-columns: 1fr;
    }
}
</style>
