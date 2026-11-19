<script setup lang="ts">
    import { ref } from 'vue';
    import { useProfileStore } from '../../stores/useProfileStore';
    import { useAlertStore } from '../../stores/useAlertStore';
    import ConfirmModal from '../ConfirmModal.vue';
    import { PhCreditCard, PhPencilSimple, PhTrash, PhPlus } from '@phosphor-icons/vue';
    import { POPULAR_BANKS, getBankLogoUrl } from '../../utils/banks';

    const profileStore = useProfileStore();
    const showAddForm = ref(false);
    const isSaving = ref(false);
    const editingCardId = ref<number | null>(null);
    
    const alertStore = useAlertStore();
    
    const newNickname = ref('');
    const newBankName = ref('');
    const newMethodType = ref('crédito');
    const newClosingDay = ref<number | ''>('');
    const newDueDay = ref<number | ''>('');
    
    const isConfirmingDelete = ref(false);
    const cardToDelete = ref<number | null>(null);

    const handleImageError = (e: Event, fallbackName: string) => {
        const target = e.target as HTMLImageElement;
        if (target && !target.src.includes('ui-avatars')) {
            target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName)}&background=6366F1&color=fff`;
        } else if (target) {
            target.style.display = 'none';
        }
    };

    const toggleAddForm = () => {
        showAddForm.value = !showAddForm.value;
        if (!showAddForm.value) {
            newNickname.value = '';
            newBankName.value = '';
            newMethodType.value = 'crédito';
            newClosingDay.value = '';
            newDueDay.value = '';
            editingCardId.value = null;
        }
    };

    const saveCard = async () => {
        if (!newNickname.value || !newBankName.value) return;

        isSaving.value = true;
        try {
            const payload = {
                nickname: newNickname.value,
                bank_name: newBankName.value,
                method_type: newMethodType.value,
                closing_day: newClosingDay.value || null,
                due_day: newDueDay.value || null
            };

            if (editingCardId.value) {
                await profileStore.updatePaymentMethod(editingCardId.value, payload);
            } else {
                await profileStore.savePaymentMethod(
                    newNickname.value, 
                    newBankName.value, 
                    newMethodType.value,
                    newClosingDay.value || undefined,
                    newDueDay.value || undefined
                );
            }
            toggleAddForm();
        } catch (error) {
            console.error('Erro ao salvar método:', error);
        } finally {
            isSaving.value = false;
        }
    };

    const startEditCard = (card: any) => {
        newNickname.value = card.nickname;
        newBankName.value = card.bank_name;
        newMethodType.value = card.method_type;
        newClosingDay.value = card.closing_day || '';
        newDueDay.value = card.due_day || '';
        editingCardId.value = card.id_payment;
        showAddForm.value = true;
    };

    const confirmDeleteCard = (id: number) => {
        cardToDelete.value = id;
        isConfirmingDelete.value = true;
    };

    const deleteCard = async () => {
        if (cardToDelete.value) {
            alertStore.showAlert('Apagando...', 'warning');
            await profileStore.deletePaymentMethod(cardToDelete.value);
            isConfirmingDelete.value = false;
            cardToDelete.value = null;
            alertStore.showAlert('Método de pagamento removido com sucesso.', 'success');
        }
    };
</script>

<template>
    <div class="profile-card">
        <div class="card-header-actions">
            <div class="title-with-icon">
                <div class="header-icon">
                    <PhCreditCard size="18" weight="duotone" />
                </div>
                <div>
                    <h2>Cartões & Contas</h2>
                    <p class="card-sub">Métodos vinculados às suas compras e faturas</p>
                </div>
            </div>
            <div class="header-controls">
                <button type="button" class="btn-outline-small" @click="toggleAddForm">
                    <PhPlus v-if="!showAddForm" size="14" weight="bold" />
                    {{ showAddForm ? 'Voltar' : 'Adicionar' }}
                </button>
            </div> 
        </div>

        <div class="card-body-wrapper">
            <div class="profile-card-content view-layer" :class="{ 'view-hidden': showAddForm }">
                <div v-if="profileStore.myCards && profileStore.myCards.length > 0" class="cards-list">
                    <div v-for="card in profileStore.myCards" :key="card.id_payment" class="payment-card-item">
                        <div class="card-left">
                            <img
                                v-if="getBankLogoUrl(card.bank_name)" 
                                :src="getBankLogoUrl(card.bank_name) ?? undefined" 
                                :alt="card.bank_name" 
                                class="bank-avatar"
                                @error="(e) => handleImageError(e, card.bank_name)"
                            />
                            <div v-else class="bank-fallback">
                                <PhCreditCard size="18" weight="duotone" />
                            </div>
                            
                            <div class="card-text">
                                <p class="card-name">{{ card.nickname }}</p>
                                <div class="card-meta-row">
                                    <span class="card-type">{{ card.bank_name }}</span>
                                    <span class="cycle-badge" v-if="card.closing_day || card.due_day">
                                        <template v-if="card.closing_day">Fecha {{ card.closing_day }}</template>
                                        <template v-if="card.closing_day && card.due_day"> • </template>
                                        <template v-if="card.due_day">Vence {{ card.due_day }}</template>
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="card-actions">
                            <button class="icon-act edit" @click="startEditCard(card)" title="Editar pagamento">
                                <PhPencilSimple :size="16" />
                            </button>
                            <button class="icon-act delete" @click="confirmDeleteCard(card.id_payment)" title="Excluir pagamento">
                                <PhTrash :size="16" />
                            </button>
                        </div>
                    </div>
                </div>
                <div v-else class="empty-state">
                    <p>Nenhum método de pagamento cadastrado</p>
                </div>
            </div>

            <form class="profile-card-content drawer-form view-layer" :class="{ 'view-hidden': !showAddForm }" @submit.prevent="saveCard">
                <div class="form-grid">
                    <div class="profile-card-content-item full-width">
                        <label for="nickname">Apelido do Cartão</label>
                        <input type="text" id="nickname" v-model="newNickname" placeholder="Ex: Nubank Ultravioleta" required>
                    </div>
                    <div class="profile-card-content-item">
                        <label for="bankName">Instituição Emissora</label>
                        <select id="bankName" v-model="newBankName" required>
                            <option value="" disabled>Selecione seu banco...</option>
                            <option v-for="bank in POPULAR_BANKS" :key="bank.id" :value="bank.name">{{ bank.name }}</option>
                        </select>
                    </div>
                    <div class="profile-card-content-item">
                        <label for="methodType">Modalidade</label>
                        <select id="methodType" v-model="newMethodType" required>
                            <option value="crédito">Crédito</option>
                            <option value="débito">Débito</option>
                            <option value="vale refeição">Vale Refeição</option>
                            <option value="vale alimentação">Vale Alimentação</option>
                            <option value="pix">Pix</option>
                            <option value="outro">Outro</option>
                        </select>
                    </div>
                    <div class="profile-card-content-item" v-if="newMethodType === 'crédito'">
                        <label for="closingDay">Dia do Fechamento</label>
                        <input type="number" id="closingDay" v-model.number="newClosingDay" placeholder="Ex: 25" min="1" max="31">
                    </div>
                    <div class="profile-card-content-item" v-if="newMethodType === 'crédito'">
                        <label for="dueDay">Dia do Vencimento</label>
                        <input type="number" id="dueDay" v-model.number="newDueDay" placeholder="Ex: 5" min="1" max="31">
                    </div>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn-outline" @click="toggleAddForm">
                        Cancelar
                    </button>
                    <button type="submit" class="btn-primary" :disabled="isSaving">
                        {{ isSaving ? 'Salvando...' : 'Salvar Cartão' }}
                    </button>
                </div>
            </form>
        </div>
    </div>

    <ConfirmModal 
        :is-open="isConfirmingDelete"
        title="Excluir Método de Pagamento"
        message="Tem certeza que deseja excluir este método de pagamento? Esta ação não pode ser desfeita."
        confirm-text="Excluir"
        cancel-text="Cancelar"
        @confirm="deleteCard"
        @cancel="isConfirmingDelete = false; cardToDelete = null"
    />
</template>

<style scoped>
    .title-with-icon {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    .header-icon {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        background: var(--primary-subtle);
        color: var(--primary-color);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .card-sub {
        margin: 2px 0 0 0;
        font-size: 0.78rem;
        color: var(--text-secondary);
    }

    .btn-outline-small {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: var(--bg-elevated);
        border: 1px solid var(--border-color);
        color: var(--text-primary);
        padding: 0.4rem 0.75rem;
        border-radius: 8px;
        font-size: 0.78rem;
        font-weight: 600;
        font-family: inherit;
        cursor: pointer;
        transition: all 0.15s;
    }

    .btn-outline-small:hover {
        border-color: var(--primary-color);
        color: var(--primary-color);
    }

    .cards-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .payment-card-item {
        padding: 0.95rem 1.15rem;
        border: 1px solid var(--border-color);
        border-radius: 12px;
        background: var(--bg-elevated);
        display: flex;
        justify-content: space-between;
        align-items: center;
        transition: border-color 0.15s ease;
    }

    .payment-card-item:hover {
        border-color: rgba(99, 102, 241, 0.35);
    }

    .card-left {
        display: flex;
        align-items: center;
        gap: 0.9rem;
    }

    .bank-avatar {
        width: 38px;
        height: 38px;
        border-radius: 10px;
        object-fit: contain;
        background: white;
        padding: 3px;
        border: 1px solid var(--border-color);
        flex-shrink: 0;
    }

    .bank-fallback {
        width: 38px;
        height: 38px;
        border-radius: 10px;
        background: var(--primary-subtle);
        color: var(--primary-color);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .card-text {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
    }

    .card-name {
        font-weight: 600;
        font-size: 0.925rem;
        margin: 0;
        color: var(--text-primary);
    }

    .card-meta-row {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.5rem;
    }

    .card-type {
        color: var(--text-secondary);
        font-size: 0.78rem;
    }

    .cycle-badge {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        color: var(--text-secondary);
        font-size: 0.7rem;
        padding: 1px 7px;
        border-radius: 6px;
        font-weight: 600;
    }

    .card-actions {
        display: flex;
        gap: 4px;
    }

    .icon-act {
        background: transparent;
        border: none;
        width: 28px;
        height: 28px;
        border-radius: 7px;
        cursor: pointer;
        color: var(--text-muted);
        transition: all 0.15s;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .icon-act.edit:hover {
        background: var(--bg-card);
        color: var(--text-primary);
    }

    .icon-act.delete:hover {
        color: var(--danger-color);
        background: var(--danger-bg);
    }

    .form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
    }

    .full-width {
        grid-column: 1 / -1;
    }

    .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
        margin-top: 1.25rem;
    }
</style>
