<script setup lang="ts">
    import { ref, computed, onMounted } from 'vue';
    import {
        PhHeart, PhPlus, PhScales, PhArrowsLeftRight, PhCheckCircle,
        PhTrash, PhX, PhSparkle, PhTarget
    } from '@phosphor-icons/vue';
    import { storeToRefs } from 'pinia';
    import { useProfileStore } from '../stores/useProfileStore';
    import { useAlertStore } from '../stores/useAlertStore';

    interface SharedExpense {
        id: string;
        title: string;
        category: string;
        amount: number;
        paidBy: 'user' | 'partner';
        date: string;
    }

    interface CoupleGoal {
        id: string;
        title: string;
        current: number;
        target: number;
    }

    const profileStore = useProfileStore();
    const { userName } = storeToRefs(profileStore);
    const { showAlert } = useAlertStore();

    const STORAGE_KEY = 'somma_couple_mode_v1';

    const partnerName = ref('Parceiro(a)');
    const splitMethod = ref<'proportional' | 'equal'>('equal');
    const userIncome = ref(0);
    const partnerIncome = ref(0);

    const isEditingSetup = ref(false);
    const isAddExpenseOpen = ref(false);
    const isAddGoalOpen = ref(false);

    const newGoal = ref({
        title: '',
        current: 0,
        target: 0
    });

    const newExpense = ref({
        title: '',
        category: 'Moradia & Contas',
        amount: 0,
        paidBy: 'user' as 'user' | 'partner',
        date: new Date().toISOString().split('T')[0] || ''
    });

    const sharedExpenses = ref<SharedExpense[]>([]);
    const coupleGoals = ref<CoupleGoal[]>([]);

    const saveCoupleState = () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            partnerName: partnerName.value,
            splitMethod: splitMethod.value,
            userIncome: userIncome.value,
            partnerIncome: partnerIncome.value,
            sharedExpenses: sharedExpenses.value,
            coupleGoals: coupleGoals.value
        }));
    };

    onMounted(() => {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                if (parsed.partnerName) partnerName.value = parsed.partnerName;
                if (parsed.splitMethod) splitMethod.value = parsed.splitMethod;
                if (parsed.userIncome) userIncome.value = parsed.userIncome;
                if (parsed.partnerIncome) partnerIncome.value = parsed.partnerIncome;
                if (Array.isArray(parsed.sharedExpenses)) sharedExpenses.value = parsed.sharedExpenses;
                if (Array.isArray(parsed.coupleGoals)) coupleGoals.value = parsed.coupleGoals;
            } catch {
                // ignora erro de parse
            }
        }
    });

    const firstUserName = computed(() => {
        const n = userName.value || 'Você';
        return n.split(' ')[0] || 'Você';
    });

    // Percentual de responsabilidade de cada um (Proporcional à renda vs 50/50)
    const userShareRatio = computed(() => {
        if (splitMethod.value === 'equal') return 0.5;
        const totalInc = (Number(userIncome.value) || 0) + (Number(partnerIncome.value) || 0);
        if (totalInc <= 0) return 0.5;
        return Number(userIncome.value) / totalInc;
    });

    const partnerShareRatio = computed(() => 1 - userShareRatio.value);

    const totalSharedExpenses = computed(() => {
        return sharedExpenses.value.reduce((acc, item) => acc + Number(item.amount), 0);
    });

    const totalPaidByUser = computed(() => {
        return sharedExpenses.value
            .filter(e => e.paidBy === 'user')
            .reduce((acc, item) => acc + Number(item.amount), 0);
    });

    const totalPaidByPartner = computed(() => {
        return sharedExpenses.value
            .filter(e => e.paidBy === 'partner')
            .reduce((acc, item) => acc + Number(item.amount), 0);
    });

    const userFairQuota = computed(() => totalSharedExpenses.value * userShareRatio.value);
    const partnerFairQuota = computed(() => totalSharedExpenses.value * partnerShareRatio.value);

    // Saldo de Acerto: Se > 0, Você pagou a mais e o parceiro te deve. Se < 0, você deve ao parceiro.
    const settlementDifference = computed(() => {
        return totalPaidByUser.value - userFairQuota.value;
    });

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
    };

    const handleAddExpense = () => {
        if (!newExpense.value.title.trim() || newExpense.value.amount <= 0) {
            showAlert('Informe a descrição e um valor válido para a despesa.', 'warning');
            return;
        }
        sharedExpenses.value.unshift({
            id: `ce-${Date.now()}`,
            title: newExpense.value.title.trim(),
            category: newExpense.value.category,
            amount: Number(newExpense.value.amount),
            paidBy: newExpense.value.paidBy,
            date: newExpense.value.date
        });
        saveCoupleState();
        isAddExpenseOpen.value = false;
        newExpense.value.title = '';
        newExpense.value.amount = 0;
        showAlert('Despesa compartilhada registrada!', 'success');
    };

    const removeExpense = (id: string) => {
        sharedExpenses.value = sharedExpenses.value.filter(e => e.id !== id);
        saveCoupleState();
        showAlert('Despesa removida.', 'success');
    };

    const handleSaveSetup = () => {
        saveCoupleState();
        isEditingSetup.value = false;
        showAlert('Regras de divisão do casal atualizadas!', 'success');
    };

    const handleAddGoal = () => {
        if (!newGoal.value.title.trim() || newGoal.value.target <= 0) {
            showAlert('Informe o nome da meta e um valor alvo válido.', 'warning');
            return;
        }
        coupleGoals.value.push({
            id: `cg-${Date.now()}`,
            title: newGoal.value.title.trim(),
            current: Math.max(0, Number(newGoal.value.current) || 0),
            target: Number(newGoal.value.target)
        });
        saveCoupleState();
        isAddGoalOpen.value = false;
        newGoal.value = { title: '', current: 0, target: 0 };
        showAlert('Meta a dois adicionada!', 'success');
    };

    const removeGoal = (id: string) => {
        coupleGoals.value = coupleGoals.value.filter(g => g.id !== id);
        saveCoupleState();
        showAlert('Meta removida.', 'success');
    };
</script>

<template>
    <div class="couple-page">
        <header class="page-header">
            <div>
                <div class="header-title-row">
                    <h1>Finanças em Casal</h1>
                    <span class="couple-pill">
                        <PhHeart size="13" weight="fill" />
                        {{ firstUserName }} & {{ partnerName }}
                    </span>
                </div>
                <p class="subtitle">Divisão inteligente de despesas da casa, acerto de contas justo e metas a dois</p>
            </div>

            <div class="header-actions">
                <button class="btn-secondary" @click="isEditingSetup = !isEditingSetup">
                    <PhScales size="17" />
                    {{ isEditingSetup ? 'Fechar Regras' : 'Regra de Divisão' }}
                </button>
                <button class="btn-primary" @click="isAddExpenseOpen = true">
                    <PhPlus size="17" weight="bold" />
                    Lançar Gasto Conjunto
                </button>
            </div>
        </header>

        <!-- Painel Expansível: Configurar Rendas e Regra (50/50 vs Proporcional) -->
        <div v-if="isEditingSetup" class="setup-drawer">
            <div class="setup-top">
                <div>
                    <h3>Regra de Divisão de Gastos</h3>
                    <p>Na divisão proporcional, quem ganha mais contribui com uma fatia proporcionalmente justa das contas da casa.</p>
                </div>
                <div class="mode-switcher">
                    <button
                        type="button"
                        class="mode-btn"
                        :class="{ active: splitMethod === 'proportional' }"
                        @click="splitMethod = 'proportional'"
                    >
                        Proporcional à Renda
                    </button>
                    <button
                        type="button"
                        class="mode-btn"
                        :class="{ active: splitMethod === 'equal' }"
                        @click="splitMethod = 'equal'"
                    >
                        Meio a Meio (50% / 50%)
                    </button>
                </div>
            </div>

            <div class="setup-inputs">
                <div class="input-group">
                    <label>Nome do seu Par</label>
                    <input type="text" v-model="partnerName" placeholder="Ex: Marina" />
                </div>
                <div class="input-group">
                    <label>Sua Renda Mensal ({{ firstUserName }})</label>
                    <input type="number" step="100" v-model.number="userIncome" :disabled="splitMethod === 'equal'" />
                </div>
                <div class="input-group">
                    <label>Renda Mensal de {{ partnerName }}</label>
                    <input type="number" step="100" v-model.number="partnerIncome" :disabled="splitMethod === 'equal'" />
                </div>
                <div class="setup-save-col">
                    <button type="button" class="btn-primary" @click="handleSaveSetup">
                        Salvar Regra
                    </button>
                </div>
            </div>
        </div>

        <!-- 3 KPIs Principais do Casal -->
        <section class="couple-kpis">
            <div class="kpi-card">
                <div class="kpi-top">
                    <span class="kpi-label">Despesas da Casa no Mês</span>
                    <span class="split-tag">
                        {{ splitMethod === 'proportional' ? 'Divisão Proporcional' : 'Divisão 50/50' }}
                    </span>
                </div>
                <div class="kpi-val">{{ formatCurrency(totalSharedExpenses) }}</div>
                <div class="quota-bar">
                    <div class="quota-user" :style="{ width: Math.round(userShareRatio * 100) + '%' }"></div>
                </div>
                <div class="quota-legend">
                    <span>{{ firstUserName }} ({{ Math.round(userShareRatio * 100) }}%): <strong>{{ formatCurrency(userFairQuota) }}</strong></span>
                    <span>{{ partnerName }} ({{ Math.round(partnerShareRatio * 100) }}%): <strong>{{ formatCurrency(partnerFairQuota) }}</strong></span>
                </div>
            </div>

            <div class="kpi-card">
                <div class="kpi-top">
                    <span class="kpi-label">Quem Pagou Quanto</span>
                    <PhArrowsLeftRight size="18" class="muted-icon" />
                </div>
                <div class="paid-comparison">
                    <div class="paid-person">
                        <span class="p-name">{{ firstUserName }} pagou</span>
                        <strong class="p-val">{{ formatCurrency(totalPaidByUser) }}</strong>
                    </div>
                    <div class="paid-divider"></div>
                    <div class="paid-person">
                        <span class="p-name">{{ partnerName }} pagou</span>
                        <strong class="p-val">{{ formatCurrency(totalPaidByPartner) }}</strong>
                    </div>
                </div>
                <span class="kpi-helper">Total acumulado de comprovantes lançados</span>
            </div>

            <!-- Card de Acerto de Contas (Quem deve a quem) -->
            <div class="kpi-card highlight">
                <div class="kpi-top">
                    <span class="kpi-label">Acerto de Contas do Mês</span>
                    <PhCheckCircle size="20" weight="fill" class="accent-icon" />
                </div>
                <template v-if="Math.abs(settlementDifference) < 1">
                    <div class="kpi-val settled">Tudo Quitado!</div>
                    <span class="kpi-helper">Vocês pagaram exatamente suas cotas justas.</span>
                </template>
                <template v-else-if="settlementDifference > 0">
                    <div class="kpi-val text-success">+ {{ formatCurrency(settlementDifference) }}</div>
                    <span class="kpi-helper">
                        <strong>{{ partnerName }}</strong> deve transferir para <strong>{{ firstUserName }}</strong> para fechar o mês.
                    </span>
                </template>
                <template v-else>
                    <div class="kpi-val text-primary">{{ formatCurrency(Math.abs(settlementDifference)) }}</div>
                    <span class="kpi-helper">
                        <strong>{{ firstUserName }}</strong> deve transferir para <strong>{{ partnerName }}</strong> para fechar o mês.
                    </span>
                </template>
            </div>
        </section>

        <!-- Grid Principal: Lista de Gastos Compartilhados + Metas do Casal -->
        <div class="couple-main-grid">
            <!-- Coluna Esquerda: Despesas Compartilhadas -->
            <div class="shared-list-card">
                <div class="card-header">
                    <h3>Lançamentos Compartilhados</h3>
                    <span class="count-pill">{{ sharedExpenses.length }} itens</span>
                </div>

                <div class="shared-rows" v-if="sharedExpenses.length > 0">
                    <div class="shared-row" v-for="item in sharedExpenses" :key="item.id">
                        <div class="row-left">
                            <div class="payer-avatar" :class="item.paidBy === 'user' ? 'is-user' : 'is-partner'">
                                {{ item.paidBy === 'user' ? firstUserName.charAt(0) : partnerName.charAt(0) }}
                            </div>
                            <div class="row-info">
                                <span class="row-title">{{ item.title }}</span>
                                <span class="row-meta">
                                    {{ item.category }} • Pago por <strong>{{ item.paidBy === 'user' ? firstUserName : partnerName }}</strong>
                                </span>
                            </div>
                        </div>

                        <div class="row-right">
                            <div class="row-amounts">
                                <span class="total-amt">{{ formatCurrency(item.amount) }}</span>
                                <span class="your-share">Sua parte: {{ formatCurrency(item.amount * userShareRatio) }}</span>
                            </div>
                            <button class="del-btn" @click="removeExpense(item.id)" title="Remover">
                                <PhTrash size="16" />
                            </button>
                        </div>
                    </div>
                </div>

                <div v-else class="empty-state">
                    Nenhuma despesa conjunta lançada neste mês.
                </div>
            </div>

            <!-- Coluna Direita: Sonhos & Metas do Casal -->
            <div class="couple-goals-card">
                <div class="card-header">
                    <div class="header-with-icon">
                        <PhTarget size="19" weight="duotone" class="primary-icon" />
                        <h3>Metas a Dois</h3>
                    </div>
                    <button type="button" class="btn-secondary" style="padding: 0.35rem 0.7rem; font-size: 0.78rem;" @click="isAddGoalOpen = !isAddGoalOpen">
                        <PhPlus size="14" weight="bold" />
                        Nova Meta
                    </button>
                </div>

                <form v-if="isAddGoalOpen" @submit.prevent="handleAddGoal" class="inline-goal-form" style="display: flex; flex-direction: column; gap: 0.55rem; padding: 0.85rem; background: var(--bg-page); border: 1px solid var(--border-color); border-radius: 12px; margin-bottom: 0.75rem;">
                    <input type="text" v-model="newGoal.title" placeholder="Ex: Viagem, Reforma, Casamento..." required style="padding: 0.5rem 0.7rem; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);" />
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                        <input type="number" step="0.01" min="0" v-model.number="newGoal.current" placeholder="Já guardado (R$)" style="padding: 0.5rem 0.7rem; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);" />
                        <input type="number" step="0.01" min="1" v-model.number="newGoal.target" placeholder="Meta total (R$)" required style="padding: 0.5rem 0.7rem; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);" />
                    </div>
                    <div style="display: flex; justify-content: flex-end; gap: 0.5rem;">
                        <button type="button" class="btn-outline" style="padding: 0.35rem 0.7rem; font-size: 0.78rem;" @click="isAddGoalOpen = false">Cancelar</button>
                        <button type="submit" class="btn-primary" style="padding: 0.35rem 0.8rem; font-size: 0.78rem;">Salvar Meta</button>
                    </div>
                </form>

                <div v-if="coupleGoals.length > 0" class="c-goals-list">
                    <div class="c-goal-item" v-for="g in coupleGoals" :key="g.id">
                        <div class="cg-top">
                            <span class="cg-title">{{ g.title }}</span>
                            <div style="display: flex; align-items: center; gap: 0.45rem;">
                                <span class="cg-pct">{{ Math.round((g.current / g.target) * 100) }}%</span>
                                <button type="button" class="del-btn" @click="removeGoal(g.id)" title="Remover meta">
                                    <PhTrash size="14" />
                                </button>
                            </div>
                        </div>
                        <div class="cg-values">
                            <strong>{{ formatCurrency(g.current) }}</strong>
                            <span>de {{ formatCurrency(g.target) }}</span>
                        </div>
                        <div class="cg-bar">
                            <div class="cg-fill" :style="{ width: Math.min(100, Math.round((g.current / g.target) * 100)) + '%' }"></div>
                        </div>
                    </div>
                </div>
                <div v-else class="empty-state" style="padding: 1.25rem 0.5rem;">
                    Nenhuma meta a dois cadastrada ainda.
                </div>

                <div class="couple-ai-box">
                    <PhSparkle size="18" weight="fill" class="sparkle-icon" />
                    <p>
                        <strong>Dica Somma AI:</strong> Com a divisão proporcional ({{ Math.round(userShareRatio * 100) }}% / {{ Math.round(partnerShareRatio * 100) }}%), ambos comprometem exatamente o mesmo percentual de suas rendas individuais com os custos fixos da casa!
                    </p>
                </div>
            </div>
        </div>

        <!-- Modal de Nova Despesa Compartilhada -->
        <Teleport to="body">
            <div v-if="isAddExpenseOpen" class="modal-overlay" @click.self="isAddExpenseOpen = false">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Novo Gasto Conjunto</h3>
                        <button class="close-btn" @click="isAddExpenseOpen = false"><PhX size="20" /></button>
                    </div>

                    <form @submit.prevent="handleAddExpense" class="modal-form">
                        <div class="input-group">
                            <label>Descrição da Despesa</label>
                            <input type="text" v-model="newExpense.title" placeholder="Ex: Supermercado, Conta de Luz, Jantar..." required />
                        </div>

                        <div class="form-row-2">
                            <div class="input-group">
                                <label>Valor Total (R$)</label>
                                <input type="number" step="0.01" min="0.01" v-model.number="newExpense.amount" required />
                            </div>
                            <div class="input-group">
                                <label>Quem pagou a conta?</label>
                                <select v-model="newExpense.paidBy">
                                    <option value="user">{{ firstUserName }} (Eu)</option>
                                    <option value="partner">{{ partnerName }}</option>
                                </select>
                            </div>
                        </div>

                        <div class="form-row-2">
                            <div class="input-group">
                                <label>Categoria</label>
                                <select v-model="newExpense.category">
                                    <option value="Moradia & Contas">Moradia & Contas</option>
                                    <option value="Supermercado">Supermercado</option>
                                    <option value="Lazer a Dois">Lazer a Dois</option>
                                    <option value="Viagens">Viagens</option>
                                    <option value="Pets & Casa">Pets & Casa</option>
                                </select>
                            </div>
                            <div class="input-group">
                                <label>Data</label>
                                <input type="date" v-model="newExpense.date" required />
                            </div>
                        </div>

                        <div class="modal-actions">
                            <button type="button" class="btn-outline" @click="isAddExpenseOpen = false">Cancelar</button>
                            <button type="submit" class="btn-primary">Adicionar ao Casal</button>
                        </div>
                    </form>
                </div>
            </div>
        </Teleport>
    </div>
</template>

<style scoped>
    .text-success { color: var(--success-text); }
    .text-primary { color: var(--primary-color); }

    .couple-page {
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

    .header-title-row {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 0.25rem;
    }

    .page-header h1 {
        font-size: 1.75rem;
        font-weight: 700;
        letter-spacing: -0.02em;
        margin: 0;
        color: var(--text-primary);
    }

    .couple-pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: rgba(236, 72, 153, 0.12);
        color: #EC4899;
        border: 1px solid rgba(236, 72, 153, 0.25);
        padding: 3px 10px;
        border-radius: 99px;
        font-size: 0.76rem;
        font-weight: 600;
    }

    .subtitle {
        margin: 0;
        color: var(--text-secondary);
        font-size: 0.925rem;
    }

    .header-actions {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
    }

    /* === DRAWER DE CONFIGURAÇÃO DE DIVISÃO === */
    .setup-drawer {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 16px;
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
        box-shadow: var(--shadow-sm);
    }

    .setup-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 1rem;
    }

    .setup-top h3 {
        margin: 0 0 0.25rem 0;
        font-size: 1.05rem;
    }

    .setup-top p {
        margin: 0;
        font-size: 0.825rem;
        color: var(--text-secondary);
    }

    .mode-switcher {
        display: flex;
        background: var(--bg-elevated);
        border: 1px solid var(--border-color);
        padding: 4px;
        border-radius: 10px;
        gap: 4px;
    }

    .mode-btn {
        background: transparent;
        border: none;
        color: var(--text-secondary);
        font-family: inherit;
        font-size: 0.8rem;
        font-weight: 600;
        padding: 0.45rem 0.9rem;
        border-radius: 7px;
        cursor: pointer;
    }

    .mode-btn.active {
        background: var(--primary-color);
        color: white;
    }

    .setup-inputs {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr auto;
        align-items: flex-end;
        gap: 1rem;
    }

    /* === KPIs === */
    .couple-kpis {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1.25rem;
    }

    .kpi-card {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 16px;
        padding: 1.4rem 1.5rem;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 0.65rem;
        box-shadow: var(--shadow-sm);
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

    .split-tag {
        font-size: 0.7rem;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 6px;
        background: var(--primary-subtle);
        color: var(--primary-color);
    }

    .kpi-val {
        font-size: 1.85rem;
        font-weight: 800;
        letter-spacing: -0.03em;
        font-feature-settings: "tnum";
    }

    .quota-bar {
        width: 100%;
        height: 7px;
        background: #EC4899;
        border-radius: 99px;
        overflow: hidden;
    }

    .quota-user {
        height: 100%;
        background: var(--primary-color);
    }

    .quota-legend {
        display: flex;
        justify-content: space-between;
        font-size: 0.75rem;
        color: var(--text-secondary);
    }

    .paid-comparison {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: var(--bg-elevated);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        padding: 0.75rem 1rem;
    }

    .paid-person {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .p-name {
        font-size: 0.72rem;
        color: var(--text-muted);
    }

    .p-val {
        font-size: 1.05rem;
        font-weight: 700;
        font-feature-settings: "tnum";
    }

    .paid-divider {
        width: 1px;
        height: 28px;
        background: var(--border-color);
    }

    .kpi-helper {
        font-size: 0.78rem;
        color: var(--text-secondary);
        line-height: 1.4;
    }

    /* === GRID PRINCIPAL === */
    .couple-main-grid {
        display: grid;
        grid-template-columns: 1.5fr 1fr;
        gap: 1.25rem;
        align-items: start;
    }

    .shared-list-card,
    .couple-goals-card {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 16px;
        padding: 1.5rem;
        box-shadow: var(--shadow-sm);
    }

    .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.25rem;
    }

    .card-header h3 {
        margin: 0;
        font-size: 1.05rem;
        font-weight: 700;
    }

    .count-pill {
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--text-secondary);
        background: var(--bg-elevated);
        padding: 2px 9px;
        border-radius: 99px;
    }

    .shared-rows {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .shared-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.9rem 1rem;
        border-radius: 12px;
        background: var(--bg-elevated);
        border: 1px solid var(--border-color);
    }

    .row-left {
        display: flex;
        align-items: center;
        gap: 0.85rem;
    }

    .payer-avatar {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 0.875rem;
        color: white;
    }

    .payer-avatar.is-user {
        background: var(--primary-color);
    }

    .payer-avatar.is-partner {
        background: #EC4899;
    }

    .row-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .row-title {
        font-weight: 600;
        font-size: 0.925rem;
        color: var(--text-primary);
    }

    .row-meta {
        font-size: 0.76rem;
        color: var(--text-secondary);
    }

    .row-right {
        display: flex;
        align-items: center;
        gap: 1rem;
    }

    .row-amounts {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
    }

    .total-amt {
        font-weight: 700;
        font-size: 0.95rem;
        font-feature-settings: "tnum";
    }

    .your-share {
        font-size: 0.72rem;
        color: var(--text-muted);
    }

    .del-btn {
        background: transparent;
        border: none;
        color: var(--text-muted);
        cursor: pointer;
        padding: 6px;
        border-radius: 7px;
    }

    .del-btn:hover {
        background: var(--danger-bg);
        color: var(--danger-color);
    }

    /* Metas a Dois */
    .header-with-icon {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .primary-icon { color: var(--primary-color); }

    .c-goals-list {
        display: flex;
        flex-direction: column;
        gap: 1.1rem;
        margin-bottom: 1.5rem;
    }

    .c-goal-item {
        background: var(--bg-elevated);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
    }

    .cg-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .cg-title {
        font-weight: 600;
        font-size: 0.9rem;
    }

    .cg-pct {
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--primary-color);
        background: var(--primary-subtle);
        padding: 2px 7px;
        border-radius: 99px;
    }

    .cg-values {
        display: flex;
        align-items: baseline;
        gap: 0.35rem;
        font-size: 0.85rem;
    }

    .cg-values span { color: var(--text-muted); font-size: 0.78rem; }

    .cg-bar {
        width: 100%;
        height: 7px;
        background: var(--bg-card);
        border-radius: 99px;
        overflow: hidden;
    }

    .cg-fill {
        height: 100%;
        background: linear-gradient(90deg, var(--primary-color), #EC4899);
        border-radius: 99px;
    }

    .couple-ai-box {
        display: flex;
        align-items: flex-start;
        gap: 0.65rem;
        background: var(--primary-subtle);
        border: 1px solid rgba(99, 102, 241, 0.25);
        border-radius: 12px;
        padding: 0.9rem 1rem;
    }

    .sparkle-icon {
        color: var(--primary-color);
        flex-shrink: 0;
        margin-top: 2px;
    }

    .couple-ai-box p {
        margin: 0;
        font-size: 0.78rem;
        line-height: 1.45;
        color: var(--text-secondary);
    }

    /* Modal */
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
    }

    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.25rem;
    }

    .modal-header h3 { margin: 0; }

    .close-btn {
        background: transparent;
        border: none;
        color: var(--text-secondary);
        cursor: pointer;
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

    .modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
        margin-top: 0.75rem;
    }

    @media (max-width: 960px) {
        .couple-kpis,
        .couple-main-grid,
        .setup-inputs,
        .form-row-2 {
            grid-template-columns: minmax(0, 1fr);
        }
    }

    @media (max-width: 640px) {
        .page-header h1 {
            font-size: 1.4rem;
        }
        .header-actions {
            width: 100%;
            flex-wrap: wrap;
        }
        .header-actions button {
            flex: 1 1 140px;
        }
        .mode-switcher {
            width: 100%;
            flex-wrap: wrap;
        }
        .mode-btn {
            flex: 1;
        }
        .couple-card,
        .setup-drawer {
            padding: 1.15rem;
            min-width: 0;
            overflow: hidden;
        }
    }
</style>
