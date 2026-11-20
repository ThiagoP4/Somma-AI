<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { PhX, PhBank, PhLockKey, PhLightning, PhPencilSimple } from '@phosphor-icons/vue';
import { usePiggybankStore, type Piggybank, type YieldIndexer, type LiquidityType } from '../../stores/usePiggybankStore';
import { POPULAR_BANKS, getBankLogoUrl, findBankFromText } from '../../utils/banks';

const props = defineProps<{
    piggybankToEdit?: Piggybank | null;
}>();

const emit = defineEmits(['close']);
const piggybankStore = usePiggybankStore();

const isEditing = computed(() => Boolean(props.piggybankToEdit));

const selectedBank = ref('Nubank');
const productType = ref('Caixinha RDB');
const customAlias = ref('');
const indexer = ref<YieldIndexer>('CDI');
const rateValue = ref<number>(100);
const liquidity = ref<LiquidityType>('daily');
const maturityDate = ref<string>('');
const initialAmount = ref<number>(0);
const targetAmount = ref<number>(0);
const composesBalance = ref(true);

const productOptions = [
    'Caixinha RDB',
    'CDB Liquidez Diária',
    'CDB Vencimento Fixo',
    'Conta Remunerada',
    'LCI / LCA Isenta',
    'Tesouro Selic / Direto',
    'Saldo em Conta Corrente'
];

onMounted(() => {
    if (props.piggybankToEdit) {
        const p = props.piggybankToEdit;
        const detectedBank = p.bank_name || findBankFromText(p.title)?.name || 'Outro Banco';
        selectedBank.value = detectedBank;
        productType.value = p.product_type || 'Caixinha RDB';

        if (p.title.includes('•')) {
            customAlias.value = p.title.split('•').slice(1).join(' • ').trim();
        } else {
            customAlias.value = p.title;
        }

        indexer.value = (p.indexer as YieldIndexer) || 'CDI';
        rateValue.value = p.rate_value !== undefined && p.rate_value !== null ? Number(p.rate_value) : 100;
        liquidity.value = (p.liquidity as LiquidityType) || 'daily';
        maturityDate.value = p.maturity_date ? String(p.maturity_date).split('T')[0] || '' : '';
        initialAmount.value = Number(p.current_amount) || 0;
        targetAmount.value = Number(p.target_amount) || 0;
        composesBalance.value = Boolean(p.composes_balance);
    }
});

const rateLabel = computed(() => {
    if (indexer.value === 'CDI') return 'Percentual do CDI (%)';
    if (indexer.value === 'PREFIXADO') return 'Taxa Anual Prefixada (% a.a.)';
    if (indexer.value === 'IPCA') return 'Spread Acima do IPCA (% a.a.)';
    if (indexer.value === 'SELIC') return 'Percentual da Selic (%)';
    return 'Taxa (%)';
});

const onIndexerChange = () => {
    if (indexer.value === 'CDI' || indexer.value === 'SELIC') rateValue.value = 100;
    else if (indexer.value === 'PREFIXADO') rateValue.value = 12.5;
    else if (indexer.value === 'IPCA') rateValue.value = 6.2;
    else rateValue.value = 0;
};

const onLiquidityChange = (type: LiquidityType) => {
    liquidity.value = type;
    if (type === 'maturity') {
        composesBalance.value = false;
    }
};

const handleImageError = (e: Event, fallbackName: string) => {
    const target = e.target as HTMLImageElement;
    if (target && !target.src.includes('ui-avatars')) {
        target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName)}&background=6366F1&color=fff`;
    }
};

const handleSave = async () => {
    const bankPart = selectedBank.value === 'Outro Banco' ? '' : selectedBank.value;
    const aliasPart = customAlias.value.trim() || productType.value;
    const finalTitle = bankPart ? `${bankPart} • ${aliasPart}` : aliasPart;

    if (!finalTitle) return;

    const metaPayload = {
        bank_name: selectedBank.value,
        product_type: productType.value,
        indexer: indexer.value,
        rate_value: indexer.value === 'NONE' ? 0 : Number(rateValue.value) || 0,
        liquidity: liquidity.value,
        maturity_date: liquidity.value === 'maturity' && maturityDate.value ? maturityDate.value : null
    };

    if (isEditing.value && props.piggybankToEdit) {
        await piggybankStore.updatePiggybank(props.piggybankToEdit.id_piggybank, {
            title: finalTitle,
            target_amount: Number(targetAmount.value) || 0,
            current_amount: Number(initialAmount.value) || 0,
            composes_balance: composesBalance.value,
            ...metaPayload
        });
    } else {
        await piggybankStore.createPiggybank(
            finalTitle,
            Number(targetAmount.value) || 0,
            composesBalance.value,
            metaPayload,
            Number(initialAmount.value) || 0
        );
    }

    emit('close');
};
</script>

<template>
    <div class="modal-overlay" @click.self="$emit('close')">
        <div class="modal-content">
            <div class="modal-header">
                <div class="header-with-icon">
                    <div class="header-icon">
                        <PhPencilSimple v-if="isEditing" size="20" weight="duotone" />
                        <PhBank v-else size="20" weight="duotone" />
                    </div>
                    <div>
                        <h3>{{ isEditing ? 'Editar Conta / Aplicação' : 'Adicionar Conta / Aplicação' }}</h3>
                        <p class="modal-sub">
                            {{ isEditing ? 'Atualize o banco, indexador de rendimento, prazo ou saldo' : 'Cadastre uma caixinha, CDB, RDB ou saldo bancário na Carteira Digital' }}
                        </p>
                    </div>
                </div>
                <button class="close-btn" @click="$emit('close')"><PhX size="20" /></button>
            </div>
            
            <div class="form-grid-2">
                <div class="input-group">
                    <label>Instituição Financeira</label>
                    <div class="bank-selector-row">
                        <img
                            v-if="selectedBank && getBankLogoUrl(selectedBank)"
                            :src="getBankLogoUrl(selectedBank) ?? undefined"
                            :alt="selectedBank"
                            class="bank-preview-logo"
                            @error="(e) => handleImageError(e, selectedBank)"
                        />
                        <select v-model="selectedBank" class="bank-select">
                            <option v-for="bank in POPULAR_BANKS" :key="bank.id" :value="bank.name">
                                {{ bank.name }}
                            </option>
                        </select>
                    </div>
                </div>

                <div class="input-group">
                    <label>Modalidade / Produto</label>
                    <select v-model="productType">
                        <option v-for="prod in productOptions" :key="prod" :value="prod">
                            {{ prod }}
                        </option>
                    </select>
                </div>
            </div>

            <div class="input-group">
                <label>Nome Personalizado <small>(Opcional — Ex: Reserva de Emergência, Giro Mensal)</small></label>
                <input
                    v-model="customAlias"
                    type="text"
                    :placeholder="`Ex: ${productType}`"
                />
            </div>

            <!-- Indexador e Taxa de Rendimento -->
            <div class="form-grid-2">
                <div class="input-group">
                    <label>Tipo de Rendimento (Indexador)</label>
                    <select v-model="indexer" @change="onIndexerChange">
                        <option value="CDI">Pós-fixado (% do CDI)</option>
                        <option value="PREFIXADO">Prefixado (% ao ano)</option>
                        <option value="IPCA">Inflação (IPCA + % a.a.)</option>
                        <option value="SELIC">Tesouro / % da Selic</option>
                        <option value="NONE">Sem Rendimento (0%)</option>
                    </select>
                </div>

                <div class="input-group" v-if="indexer !== 'NONE'">
                    <label>{{ rateLabel }}</label>
                    <input
                        v-model.number="rateValue"
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="Ex: 100"
                    />
                </div>
            </div>

            <!-- Liquidez vs Travado até Vencimento -->
            <div class="input-group">
                <label>Disponibilidade de Resgate (Liquidez)</label>
                <div class="liquidity-pills">
                    <button
                        type="button"
                        class="liq-btn"
                        :class="{ active: liquidity === 'daily' }"
                        @click="onLiquidityChange('daily')"
                    >
                        <PhLightning size="15" weight="fill" />
                        <span>Liquidez Diária (Livre)</span>
                    </button>
                    <button
                        type="button"
                        class="liq-btn locked"
                        :class="{ active: liquidity === 'maturity' }"
                        @click="onLiquidityChange('maturity')"
                    >
                        <PhLockKey size="15" weight="fill" />
                        <span>Travado até Vencimento</span>
                    </button>
                </div>
            </div>

            <div class="input-group" v-if="liquidity === 'maturity'">
                <label>Data de Vencimento / Liberação do Resgate</label>
                <input type="date" v-model="maturityDate" required />
            </div>

            <!-- Saldo Atual e Meta Opcional -->
            <div class="form-grid-2">
                <div class="input-group">
                    <label>Saldo Atual Guardado (R$)</label>
                    <input v-model.number="initialAmount" type="number" min="0" step="0.01" placeholder="0.00" />
                </div>
                <div class="input-group">
                    <label>Meta Opcional (R$) <small>(0 = Sem meta)</small></label>
                    <input v-model.number="targetAmount" type="number" min="0" step="100" placeholder="0 (Apenas saldo)" />
                </div>
            </div>
            
            <div class="toggle-box" @click="composesBalance = !composesBalance">
                <div class="toggle-text">
                    <strong>Compõe o Saldo Disponível do Mês na Home?</strong>
                    <span>Ative para contas correntes/liquidez de giro. Desative para investimentos isolados.</span>
                </div>
                <input type="checkbox" v-model="composesBalance" @click.stop />
            </div>
            
            <div class="modal-actions">
                <button class="btn-outline" @click="$emit('close')">Cancelar</button>
                <button class="btn-primary" @click="handleSave">
                    {{ isEditing ? 'Salvar Alterações' : 'Salvar na Carteira' }}
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
    max-width: 540px;
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

.close-btn:hover {
    color: var(--text-primary);
}

.form-grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.85rem;
}

.input-group {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    margin-bottom: 0.95rem;
    min-width: 0;
}

.input-group label {
    font-size: 0.8rem;
    color: var(--text-secondary);
    font-weight: 600;
}

.input-group label small {
    font-weight: 400;
    color: var(--text-muted);
}

.bank-selector-row {
    display: flex;
    align-items: center;
    gap: 0.55rem;
}

.bank-preview-logo {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    object-fit: contain;
    background: white;
    padding: 3px;
    border: 1px solid var(--border-color);
    flex-shrink: 0;
}

.bank-select {
    flex: 1;
    min-width: 0;
    padding: 0.65rem 0.75rem;
}

.input-group input,
.input-group select {
    padding: 0.65rem 0.8rem;
}

.liquidity-pills {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.6rem;
}

.liq-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 0.6rem 0.8rem;
    border-radius: 10px;
    border: 1px solid var(--border-color);
    background: var(--bg-elevated);
    color: var(--text-secondary);
    font-family: inherit;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
}

.liq-btn.active {
    background: var(--success-bg);
    color: var(--success-text);
    border-color: rgba(16, 185, 129, 0.35);
}

.liq-btn.locked.active {
    background: rgba(245, 158, 11, 0.14);
    color: #F59E0B;
    border-color: rgba(245, 158, 11, 0.35);
}

.toggle-box {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.85rem 1rem;
    border-radius: 12px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-color);
    margin-bottom: 1.25rem;
    cursor: pointer;
}

.toggle-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.toggle-text strong {
    font-size: 0.825rem;
    color: var(--text-primary);
}

.toggle-text span {
    font-size: 0.74rem;
    color: var(--text-secondary);
}

.toggle-box input[type="checkbox"] {
    width: 18px;
    height: 18px;
    accent-color: var(--primary-color);
    cursor: pointer;
}

.modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
}

@media (max-width: 560px) {
    .form-grid-2,
    .liquidity-pills {
        grid-template-columns: 1fr;
    }
}
</style>
