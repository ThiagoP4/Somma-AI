<script setup lang="ts">
    import { ref, computed } from 'vue';
    import { useProfileStore } from '../../stores/useProfileStore';
    import { useAlertStore } from '../../stores/useAlertStore';
    import { PhTarget, PhRocketLaunch, PhClockCounterClockwise, PhCheckCircle, PhPencilSimple, PhTrash, PhPlus } from '@phosphor-icons/vue';
    import ConfirmModal from '../ConfirmModal.vue';

    const profileStore = useProfileStore();
    const alertStore = useAlertStore();

    const showAddForm = ref(false);
    const newGoalDescription = ref('');
    const newGoalAmount = ref<number | null>(null);
    const newGoalDeadline = ref('');
    const isSaving = ref(false);
    const activeTab = ref('active');
    const today = new Date().toISOString().split('T')[0];

    const editingGoalId = ref<string | null>(null);

    const activeGoals = computed(() => {
        return profileStore.financialGoals.filter(g => g.status === 'em andamento');
    });

    const historyGoals = computed(() => {
        return profileStore.financialGoals.filter(g => g.status === 'concluída');
    });

    const currentGoals = computed(() => {
        return activeTab.value === 'active' ? activeGoals.value : historyGoals.value;
    });

    const completeGoal = async (id: string) => {
        alertStore.showAlert('Celebrando sua vitória...', 'success');
        await profileStore.updateFinancialGoal(id, { status: 'concluída' });
    };

    const startEditGoal = (goal: any) => {
        editingGoalId.value = goal.id_goal;
        newGoalDescription.value = goal.description;
        newGoalAmount.value = goal.target_amount;
        newGoalDeadline.value = goal.deadline.split('T')[0];
        showAddForm.value = true;
    };

    const isConfirmingDelete = ref(false);
    const goalToDelete = ref<string | null>(null);

    const confirmDeleteGoal = (id: string) => {
        goalToDelete.value = id;
        isConfirmingDelete.value = true;
    };

    const executeDelete = async () => {
        if (goalToDelete.value) {
            alertStore.showAlert('Apagando...', 'warning');
            await profileStore.deleteFinancialGoal(goalToDelete.value);
            isConfirmingDelete.value = false;
            goalToDelete.value = null;
            alertStore.showAlert('Meta removida com sucesso.', 'success');
        }
    };

    const toggleAddForm = () => {
        showAddForm.value = !showAddForm.value;
        if (!showAddForm.value) {
            resetForm();
        }
    };

    const saveNewGoal = async () => {
        if (!newGoalDescription.value || !newGoalAmount.value || !newGoalDeadline.value) {
            alertStore.showAlert('Preencha todos os campos da meta!', 'warning');
            return;
        }
        isSaving.value = true;

        let result;
        if (editingGoalId.value) {
            result = await profileStore.updateFinancialGoal(editingGoalId.value, {
                description: newGoalDescription.value,
                target_amount: newGoalAmount.value,
                deadline: newGoalDeadline.value
            });
        } else {
            result = await profileStore.saveFinancialGoal(
                newGoalDescription.value,
                newGoalAmount.value,
                newGoalDeadline.value
            );
        }

        if (result.success) {
            alertStore.showAlert(editingGoalId.value ? 'Meta atualizada!' : 'Meta criada!', 'success');
            resetForm();
        } else {
            alertStore.showAlert('Erro ao salvar a meta: ' + result.message, 'error');
        }
        isSaving.value = false;
    };

    const resetForm = () => {
        editingGoalId.value = null;
        newGoalDescription.value = '';
        newGoalAmount.value = null;
        newGoalDeadline.value = '';
        showAddForm.value = false;
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        date.setUTCHours(12);
        return date.toLocaleDateString('pt-BR');
    };

    const getGoalPaceHint = (goal: any): { monthsLabel: string; monthlySuggested: string } | null => {
        if (!goal?.deadline || !goal?.target_amount || goal.status !== 'em andamento') return null;
        const target = Number(goal.target_amount || 0);
        if (target <= 0) return null;

        const now = new Date();
        const deadlineDate = new Date(goal.deadline);
        deadlineDate.setUTCHours(12);
        const diffMs = deadlineDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays <= 0) {
            return {
                monthsLabel: 'Prazo atingido',
                monthlySuggested: formatCurrency(target),
            };
        }

        const monthsLeft = Math.max(1, Math.round(diffDays / 30.44));
        const monthly = target / monthsLeft;
        return {
            monthsLabel: monthsLeft === 1 ? 'Falta ~1 mês' : `Faltam ~${monthsLeft} meses`,
            monthlySuggested: `${formatCurrency(monthly)}/mês`,
        };
    };
</script>

<template>
    <div class="profile-card">
        <div class="card-header-actions">
            <div class="title-with-icon">
                <div class="header-icon">
                    <PhTarget size="18" weight="duotone" />
                </div>
                <div>
                    <h2>Metas Financeiras</h2>
                    <p class="card-sub">Objetivos de médio e longo prazo</p>
                </div>
            </div>

            <div class="header-controls">
                <div class="card-tabs" v-if="!showAddForm">
                    <button
                        type="button"
                        :class="{ active: activeTab === 'active' }"
                        @click="activeTab = 'active'"
                        title="Em andamento"
                    >
                        <PhRocketLaunch :size="15" />
                        <span>Ativas ({{ activeGoals.length }})</span>
                    </button>
                    <button
                        type="button"
                        :class="{ active: activeTab === 'history' }" 
                        @click="activeTab = 'history'"
                        title="Concluídas"
                    >
                        <PhClockCounterClockwise :size="15" />
                        <span>Histórico ({{ historyGoals.length }})</span>
                    </button>
                </div>
                <button type="button" class="btn-outline-small" @click="toggleAddForm">
                    <PhPlus v-if="!showAddForm" size="14" weight="bold" />
                    {{ showAddForm ? 'Voltar' : 'Nova' }}
                </button>
            </div>
        </div>

        <div class="card-body-wrapper">
            <div class="profile-card-content goals-container view-layer" :class="{ 'view-hidden': showAddForm }">
                <div v-if="currentGoals.length > 0" class="goals-list">
                    <div v-for="goal in currentGoals" :key="goal.id_goal" class="goal-item-card">
                        <div class="goal-top-row">
                            <span class="goal-status" :class="goal.status.replace(/ /g, '-').toLowerCase()">
                                {{ goal.status }}
                            </span>
                            <div class="goal-actions-top">
                                <button
                                    v-if="goal.status === 'em andamento'" 
                                    class="icon-act check" 
                                    @click="completeGoal(goal.id_goal)" 
                                    title="Marcar como concluída"
                                >
                                    <PhCheckCircle :size="17" />
                                </button>
                                <button class="icon-act edit" @click="startEditGoal(goal)" title="Editar meta">
                                    <PhPencilSimple :size="16" />
                                </button>
                                <button class="icon-act delete" @click="confirmDeleteGoal(goal.id_goal)" title="Excluir meta">
                                    <PhTrash :size="16" />
                                </button>
                            </div>
                        </div>

                        <span class="goal-title">{{ goal.description }}</span>

                        <div class="goal-details">
                            <div class="detail-col">
                                <span class="detail-label">Alvo financeiro</span>
                                <span class="detail-value highlight">{{ formatCurrency(goal.target_amount) }}</span>
                            </div>
                            <div class="detail-col text-right">
                                <span class="detail-label">Prazo limite</span>
                                <span class="detail-value">{{ formatDate(goal.deadline) }}</span>
                            </div>
                        </div>

                        <div
                            v-if="getGoalPaceHint(goal)"
                            class="goal-pace-strip"
                            style="display: flex; justify-content: space-between; align-items: center; padding: 0.45rem 0.7rem; border-radius: 8px; background: rgba(99, 102, 241, 0.08); border: 1px solid rgba(99, 102, 241, 0.2); font-size: 0.75rem; color: var(--text-secondary);"
                        >
                            <span>⏱️ {{ getGoalPaceHint(goal)?.monthsLabel }}</span>
                            <span>Ritmo sugerido: <strong style="color: var(--primary-color);">{{ getGoalPaceHint(goal)?.monthlySuggested }}</strong></span>
                        </div>
                    </div>
                </div>
                <div v-else class="empty-state">
                    <p>Nenhuma meta {{ activeTab === 'active' ? 'ativa' : 'concluída' }} no momento.</p>
                </div>
            </div>

            <form class="profile-card-content drawer-form view-layer" :class="{ 'view-hidden': !showAddForm }" @submit.prevent="saveNewGoal">
                <h3 class="form-title">{{ editingGoalId ? 'Editar Meta' : 'Nova Meta Financeira' }}</h3>
                <div class="form-grid">
                    <div class="profile-card-content-item full-width">
                        <label for="goal_desc">O que você quer alcançar?</label>
                        <input type="text" id="goal_desc" v-model="newGoalDescription" placeholder="Ex: Reserva de Emergência" required>
                    </div>
                    <div class="profile-card-content-item">
                        <label for="goal_amount">Valor Alvo (R$)</label>
                        <input type="number" id="goal_amount" v-model="newGoalAmount" placeholder="Ex: 15000" min="1" step="0.01" required>
                    </div>
                    <div class="profile-card-content-item">
                        <label for="goal_deadline">Data Limite</label>
                        <input type="date" id="goal_deadline" v-model="newGoalDeadline" :min="today" required>
                    </div>
                </div>
                <div class="form-actions-row">
                    <button class="btn-outline" type="button" @click="toggleAddForm">Cancelar</button>
                    <button class="btn-primary" type="submit" :disabled="isSaving">
                        {{ isSaving ? 'Salvando...' : 'Salvar Meta' }}
                    </button>
                </div>
            </form>
        </div>

        <ConfirmModal 
            :isOpen="isConfirmingDelete"
            title="Excluir Meta?"
            message="Essa ação deletará esta meta financeira permanentemente. Deseja continuar?"
            @confirm="executeDelete"
            @cancel="isConfirmingDelete = false"
        />
    </div>
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

    .header-controls {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
    }

    .card-tabs {
        display: flex;
        gap: 3px;
        background: var(--bg-elevated);
        border: 1px solid var(--border-color);
        padding: 3px;
        border-radius: 9px;
    }

    .card-tabs button {
        background: transparent;
        border: none;
        color: var(--text-secondary);
        padding: 0.35rem 0.65rem;
        border-radius: 6px;
        font-size: 0.75rem;
        font-weight: 600;
        font-family: inherit;
        cursor: pointer;
        transition: all 0.15s;
        display: flex;
        align-items: center;
        gap: 0.35rem;
    }

    .card-tabs button.active {
        background: var(--primary-subtle);
        color: var(--primary-color);
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

    .card-body-wrapper {
        position: relative;
        flex: 1;
        display: grid;
        align-items: start;
    }

    .view-layer {
        grid-area: 1 / 1;
        transition: opacity 0.2s ease, transform 0.2s ease, visibility 0.2s;
        opacity: 1;
        visibility: visible;
    }

    .view-hidden {
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
        position: absolute;
        width: 100%;
    }

    .goals-list {
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
        max-height: 360px;
        overflow-y: auto;
        padding-right: 4px;
    }

    .goal-item-card {
        padding: 1.15rem;
        border: 1px solid var(--border-color);
        border-radius: 12px;
        background: var(--bg-elevated);
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
        transition: border-color 0.15s ease;
    }

    .goal-item-card:hover {
        border-color: rgba(99, 102, 241, 0.35);
    }

    .goal-top-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .goal-status {
        font-size: 0.68rem;
        padding: 2px 8px;
        border-radius: 6px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    .goal-status.em-andamento {
        background: var(--primary-subtle);
        color: var(--primary-color);
    }

    .goal-status.concluída {
        background: var(--success-bg);
        color: var(--success-text);
    }

    .goal-actions-top {
        display: flex;
        gap: 4px;
    }

    .icon-act {
        background: transparent;
        border: none;
        width: 28px;
        height: 28px;
        border-radius: 7px;
        color: var(--text-muted);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.15s;
    }

    .icon-act.check:hover { color: var(--success-text); background: var(--success-bg); }
    .icon-act.edit:hover { color: var(--text-primary); background: var(--bg-card); }
    .icon-act.delete:hover { color: var(--danger-color); background: var(--danger-bg); }

    .goal-title {
        font-weight: 600;
        font-size: 0.975rem;
        color: var(--text-primary);
    }

    .goal-details {
        display: flex;
        justify-content: space-between;
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        padding: 0.7rem 0.9rem;
        border-radius: 10px;
    }

    .detail-col {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .text-right {
        text-align: right;
    }

    .detail-label {
        font-size: 0.7rem;
        color: var(--text-muted);
        font-weight: 500;
    }

    .detail-value {
        font-size: 0.9rem;
        color: var(--text-primary);
        font-weight: 600;
        font-feature-settings: "tnum";
    }

    .detail-value.highlight {
        color: var(--primary-color);
        font-weight: 700;
    }

    .form-grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: 1fr 1fr;
    }

    .full-width {
        grid-column: 1 / -1;
    }

    .form-actions-row {
        display: flex;
        gap: 0.75rem;
        margin-top: 1.25rem;
        justify-content: flex-end;
    }
</style>
