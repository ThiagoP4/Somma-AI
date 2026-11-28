<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { PhX } from '@phosphor-icons/vue';
import { usePiggybankStore, type Piggybank } from '../../stores/usePiggybankStore';
import { useAlertStore } from '../../stores/useAlertStore';

const props = defineProps<{
    piggybank: Piggybank;
    type: 'deposit' | 'withdraw';
}>();

const emit = defineEmits(['close']);
const piggybankStore = usePiggybankStore();
const { showAlert } = useAlertStore();

const amount = ref<number | null>(null);
const maxAvailableToDeposit = ref<number>(0);

const referenceLimit = computed(() => {
    if (props.type === 'withdraw') {
        return Math.max(0, Number(props.piggybank.current_amount || 0));
    }
    return Math.max(0, Number(maxAvailableToDeposit.value || 0));
});

onMounted(async () => {
    if (props.type === 'deposit') {
        maxAvailableToDeposit.value = await piggybankStore.getAvailableToDeposit();
    }
});

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
};

const fillPercentage = (pct: number) => {
    const base = referenceLimit.value;
    if (base <= 0) return;
    amount.value = Math.round(base * (pct / 100) * 100) / 100;
};

const handleTransaction = async () => {
    if (!amount.value || amount.value <= 0) {
        showAlert('Informe um valor válido maior que zero.', 'warning');
        return;
    }

    try {
        await piggybankStore.addTransaction(props.piggybank.id_piggybank, props.type, amount.value);
        showAlert(
            props.type === 'deposit'
                ? `Aporte de ${formatCurrency(amount.value)} registrado!`
                : `Resgate de ${formatCurrency(amount.value)} realizado!`,
            'success'
        );
        amount.value = null;
        emit('close');
    } catch (error: any) {
        showAlert(error?.message || 'Não foi possível concluir a operação.', 'error');
    }
};
</script>

<template>
    <div class="modal-overlay" @click.self="$emit('close')">
        <div class="modal-content">
            <div class="modal-header">
                <h3>{{ type === 'deposit' ? 'Aportar' : 'Resgatar' }} — {{ piggybank.title }}</h3>
                <button class="close-btn" @click="$emit('close')"><PhX size="20" /></button>
            </div>

            <div class="input-group">
                <div class="label-row">
                    <label>Valor (R$)</label>
                    <span class="max-available">
                        {{ type === 'deposit' ? 'Disponível:' : 'Saldo na conta:' }}
                        {{ formatCurrency(referenceLimit) }}
                    </span>
                </div>
                <input
                    v-model.number="amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0,00"
                    @keyup.enter="handleTransaction"
                />

                <div v-if="referenceLimit > 0" class="quick-pct-row">
                    <button type="button" class="pct-chip" @click="fillPercentage(25)">25%</button>
                    <button type="button" class="pct-chip" @click="fillPercentage(50)">50%</button>
                    <button type="button" class="pct-chip" @click="fillPercentage(75)">75%</button>
                    <button type="button" class="pct-chip" @click="fillPercentage(100)">100% (Tudo)</button>
                </div>
            </div>

            <div class="modal-actions">
                <button type="button" class="btn-outline" @click="$emit('close')">Cancelar</button>
                <button type="button" class="btn-primary" @click="handleTransaction">Confirmar</button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
}
.modal-content {
    background: var(--bg-card);
    padding: 1.65rem;
    border-radius: 14px;
    width: 100%;
    max-width: 410px;
    border: 1px solid var(--border-color);
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
}
.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.25rem;
}
.modal-header h3 {
    margin: 0;
    font-size: 1.05rem;
    color: var(--text-primary);
}
.close-btn {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
}
.close-btn:hover { color: var(--text-primary); }
.input-group {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    margin-bottom: 1.35rem;
}
.label-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.input-group label {
    font-size: 0.85rem;
    color: var(--text-secondary);
}
.max-available {
    font-size: 0.76rem;
    color: var(--success-text, #10b981);
    font-weight: 600;
}
.input-group input {
    padding: 0.75rem 0.85rem;
    border-radius: 9px;
    border: 1px solid var(--border-color);
    background: var(--bg-page);
    color: var(--text-primary);
    font-size: 1rem;
    font-weight: 600;
}
.quick-pct-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.4rem;
    margin-top: 0.2rem;
}
.pct-chip {
    padding: 0.35rem 0.4rem;
    border-radius: 7px;
    border: 1px solid var(--border-color);
    background: var(--bg-page);
    color: var(--text-secondary);
    font-size: 0.74rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
}
.pct-chip:hover {
    border-color: var(--primary-color);
    color: var(--primary-color);
}
.modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
}
.btn-outline {
    background: transparent;
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    padding: 0.6rem 1.1rem;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 500;
}
.btn-outline:hover {
    background: var(--bg-page);
}
</style>
