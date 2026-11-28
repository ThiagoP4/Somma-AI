import { defineStore } from 'pinia';
import { supabase } from '../services/supabase';
import { useProfileStore } from './useProfileStore';

export interface FinanceIncomeRow {
    idIncome?: number;
    title: string;
    value: number;
    date: string;
}

export interface FinanceInstallmentRow {
    idInstallment?: number;
    installmentNumber?: number;
    value: number;
    dueDate: string;
    paid?: boolean;
    fin_purchase?: {
        title?: string;
        total_installments?: number;
        payment_id?: number | null;
        usr_payment?: {
            id_payment?: number;
            nickname?: string;
            bank_name?: string;
            closing_day?: number | null;
        } | null;
        fin_category?: {
            description?: string;
            color?: string;
        } | null;
    } | null;
}

export interface SubscriptionRow {
    idSubscription: number;
    plan_name: string;
    monthly_price: number;
    category?: string;
    cycle?: 'monthly' | 'yearly';
    billing_day?: number;
    card_nickname?: string;
    color?: string;
    active: boolean;
    created_at?: string;
}

let isSyncingSubscriptionsMutex = false;

export interface CopilotChatMessage {
    id: number;
    role: 'user' | 'ai';
    content: string;
}

const createFreshCopilotSessionId = () =>
    `somma-zk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const useFinanceStore = defineStore('finance', {
    state: () => ({
        monthIncomes: [] as FinanceIncomeRow[],
        monthInstallments: [] as FinanceInstallmentRow[],
        subscriptions: [] as SubscriptionRow[],
        isLoadingMonth: false,
        copilotMessages: [] as CopilotChatMessage[],
        copilotSessionId: createFreshCopilotSessionId(),
    }),

    getters: {
        totalMonthIncome: (state): number =>
            state.monthIncomes.reduce((acc, row) => acc + Number(row.value || 0), 0),

        totalMonthExpense: (state): number =>
            state.monthInstallments.reduce((acc, row) => acc + Number(row.value || 0), 0),

        activeMonthlySubscriptionsTotal: (state): number =>
            state.subscriptions
                .filter(s => s.active !== false)
                .reduce(
                    (acc, s) =>
                        acc + (s.cycle === 'yearly' ? Number(s.monthly_price || 0) / 12 : Number(s.monthly_price || 0)),
                    0
                ),
    },

    actions: {
        async fetchMonthTransactions(options: {
            year: number;
            month: number; // 0-11
            filterMode?: 'month' | 'invoice';
            selectedCardIds?: Array<number | string>;
        }) {
            const profileStore = useProfileStore();
            if (!profileStore.userId) {
                await profileStore.fetchProfileData();
            }
            if (!profileStore.userId) return;

            this.isLoadingMonth = true;
            try {
                // Materializa automaticamente assinaturas ativas cujo dia de cobrança já chegou no mês atual
                const now = new Date();
                if (options.year === now.getFullYear() && options.month === now.getMonth()) {
                    await this.syncDueSubscriptionsToRecords();
                }

                const startOfMonth = new Date(options.year, options.month, 1).toISOString().split('T')[0];
                const endOfMonth = new Date(options.year, options.month + 1, 0).toISOString().split('T')[0];

                const { data: incomes } = await supabase
                    .from('fin_income')
                    .select('title, value, date')
                    .gte('date', startOfMonth)
                    .lte('date', endOfMonth)
                    .order('date', { ascending: false })
                    .eq('user_id', profileStore.userId);

                this.monthIncomes = (incomes || []) as FinanceIncomeRow[];

                let expQuery = supabase
                    .from('fin_installment')
                    .select(
                        'idInstallment, installmentNumber, value, dueDate, paid, fin_purchase!inner(title, total_installments, payment_id, usr_payment(id_payment, nickname, bank_name, closing_day), fin_category(description, color))'
                    )
                    .gte('dueDate', startOfMonth)
                    .lte('dueDate', endOfMonth)
                    .order('dueDate', { ascending: false });

                if (options.filterMode === 'invoice' && options.selectedCardIds && options.selectedCardIds.length > 0) {
                    expQuery = expQuery.in('fin_purchase.payment_id', options.selectedCardIds);
                }

                const { data: expenses } = await expQuery;
                this.monthInstallments = (expenses || []) as FinanceInstallmentRow[];
            } finally {
                this.isLoadingMonth = false;
            }
        },

        async fetchSubscriptions() {
            const profileStore = useProfileStore();
            if (!profileStore.userId) {
                await profileStore.fetchProfileData();
            }
            if (!profileStore.userId) return [];

            const { data } = await supabase
                .from('opt_subscription')
                .select('*')
                .eq('user_id', profileStore.userId)
                .order('created_at', { ascending: false });

            this.subscriptions = (data || []) as SubscriptionRow[];
            await this.syncDueSubscriptionsToRecords();
            return this.subscriptions;
        },

        resetCopilotChat(welcomeMessage?: string) {
            this.copilotSessionId = createFreshCopilotSessionId();
            this.copilotMessages = welcomeMessage
                ? [{ id: Date.now(), role: 'ai', content: welcomeMessage }]
                : [];
        },

        /**
         * Verifica de forma idempotente todas as assinaturas ativas e, caso o dia de cobrança (billing_day)
         * já tenha chegado no mês/ano atual, gera automaticamente o registro em `fin_purchase` + `fin_installment`
         * para aparecer na aba Registros sem nunca duplicar.
         */
        async syncDueSubscriptionsToRecords(): Promise<number> {
            if (isSyncingSubscriptionsMutex) return 0;
            isSyncingSubscriptionsMutex = true;

            try {
                const profileStore = useProfileStore();
                if (!profileStore.userId) {
                    await profileStore.fetchProfileData();
                }
                const userId = profileStore.userId;
                if (!userId) return 0;

                if (this.subscriptions.length === 0) {
                    const { data } = await supabase
                        .from('opt_subscription')
                        .select('*')
                        .eq('user_id', userId);
                    this.subscriptions = (data || []) as SubscriptionRow[];
                }

                const activeSubs = this.subscriptions.filter(s => s.active !== false && (s.plan_name || '').trim().length > 0);
                if (activeSubs.length === 0) return 0;

                const now = new Date();
                const curYear = now.getFullYear();
                const curMonth = now.getMonth(); // 0-11
                const todayDay = now.getDate();
                const daysInCurMonth = new Date(curYear, curMonth + 1, 0).getDate();

                const dueSubs = activeSubs.filter(sub => {
                    const rawDay = Math.max(1, Math.min(31, Number(sub.billing_day || 10)));
                    const effectiveBillingDay = Math.min(rawDay, daysInCurMonth);
                    if (todayDay < effectiveBillingDay) return false;

                    // Se for assinatura anual, cobra apenas no mês de aniversário de criação
                    if (sub.cycle === 'yearly' && sub.created_at) {
                        const createdDate = new Date(sub.created_at);
                        if (!Number.isNaN(createdDate.getTime()) && createdDate.getMonth() !== curMonth) {
                            return false;
                        }
                    }
                    return true;
                });

                if (dueSubs.length === 0) return 0;

                const startOfCurMonth = new Date(curYear, curMonth, 1).toISOString().split('T')[0];
                const endOfCurMonth = new Date(curYear, curMonth + 1, 0).toISOString().split('T')[0];

                // Busca compras já lançadas neste mês para garantir idempotência (zero duplicatas)
                const { data: existingPurchases, error: existErr } = await supabase
                    .from('fin_purchase')
                    .select('title')
                    .eq('user_id', userId)
                    .gte('date', startOfCurMonth)
                    .lte('date', endOfCurMonth);

                if (existErr) return 0;

                const existingTitles = new Set(
                    (existingPurchases || []).map((p: any) => String(p.title || '').trim().toLowerCase())
                );

                const missingSubs = dueSubs.filter(sub => {
                    const cleanName = sub.plan_name.trim().toLowerCase();
                    return !existingTitles.has(cleanName) && !existingTitles.has(`[assinatura] ${cleanName}`);
                });

                if (missingSubs.length === 0) return 0;

                // Carrega categorias de despesa do usuário para vincular categoryId automaticamente
                const { data: userCategories } = await supabase
                    .from('fin_category')
                    .select('idCategory, description, type')
                    .eq('type', 'despesa');

                const catList = userCategories || [];
                const defaultCategoryId = catList[0]?.idCategory ?? null;

                let createdCount = 0;

                for (const sub of missingSubs) {
                    const rawDay = Math.max(1, Math.min(31, Number(sub.billing_day || 10)));
                    const effectiveDay = Math.min(rawDay, daysInCurMonth);
                    const billingDateStr = `${curYear}-${String(curMonth + 1).padStart(2, '0')}-${String(effectiveDay).padStart(2, '0')}`;

                    // Resolve cartão pelo nickname salvo na assinatura
                    const matchedCard = profileStore.myCards.find(
                        (c: any) => String(c.nickname || '').trim().toLowerCase() === String(sub.card_nickname || '').trim().toLowerCase()
                    ) || profileStore.myCards[0];
                    const paymentId = matchedCard?.id_payment ?? null;

                    // Resolve categoria pelo nome ou palavra-chave
                    const subCatLower = String(sub.category || '').toLowerCase();
                    const matchedCat =
                        catList.find((c: any) => String(c.description || '').toLowerCase() === subCatLower) ||
                        catList.find((c: any) => subCatLower.includes(String(c.description || '').toLowerCase())) ||
                        catList.find((c: any) => /assinatura|streaming|lazer|outros|fix/i.test(String(c.description || '')));
                    const categoryId = matchedCat?.idCategory ?? defaultCategoryId;

                    const amount = Number(sub.monthly_price || 0);
                    if (amount <= 0) continue;

                    const { data: insertedPurchase, error: pErr } = await supabase
                        .from('fin_purchase')
                        .insert({
                            title: sub.plan_name.trim(),
                            value: amount,
                            date: billingDateStr,
                            total_installments: 1,
                            categoryId,
                            payment_id: paymentId,
                            user_id: userId,
                        })
                        .select('idPurchase')
                        .single();

                    if (pErr || !insertedPurchase?.idPurchase) continue;

                    await supabase.from('fin_installment').insert({
                        purchaseId: insertedPurchase.idPurchase,
                        installmentNumber: 1,
                        value: amount,
                        dueDate: `${billingDateStr}T12:00:00.000Z`,
                        paid: true,
                    });

                    existingTitles.add(sub.plan_name.trim().toLowerCase());
                    createdCount++;
                }

                return createdCount;
            } catch (err) {
                console.error('Erro ao sincronizar assinaturas vencidas com Registros:', err);
                return 0;
            } finally {
                isSyncingSubscriptionsMutex = false;
            }
        },
    },
});
