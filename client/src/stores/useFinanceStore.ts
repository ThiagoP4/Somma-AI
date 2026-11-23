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
}

export const useFinanceStore = defineStore('finance', {
    state: () => ({
        monthIncomes: [] as FinanceIncomeRow[],
        monthInstallments: [] as FinanceInstallmentRow[],
        subscriptions: [] as SubscriptionRow[],
        isLoadingMonth: false,
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
            return this.subscriptions;
        },
    },
});
