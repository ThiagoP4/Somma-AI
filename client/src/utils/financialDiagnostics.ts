import type { Piggybank } from '../stores/usePiggybankStore';
import type { VariableAsset, AssetClass } from '../stores/useAssetsStore';

export interface CategoryExpenseRatio {
    category: string;
    sharePct: number;
}

export interface MonthlyForecastPoint {
    monthLabel: string;
    committedPctOfIncome: number;
    projectedTotalSpendPctOfIncome: number;
    projectedSavingsPct: number;
}

export interface AnonymizedFinancialProfile {
    privacyMode: 'zero-knowledge-ratios-only';
    note: string;
    weight1_immediateCashAndCurrentMonth: {
        monthProgressPct: number;
        expenseCommitmentPct: number;
        savingsRatePct: number;
        spendableNowCoversMonthExpenses: boolean;
        spendableNowFreeRatioOfIncomePct: number | null;
        directExpensesSharePct: number;
        creditCardInvoiceSharePct: number;
        creditCardToIncomePct: number;
        subscriptionsShareOfIncomePct: number;
        healthStatus: 'excelente' | 'saudavel' | 'atencao' | 'critico';
    };
    weight2_trendAndNext3MonthsForecast: {
        currentMonthProjectedCommitmentPct: number;
        vsLast3MonthsAvgSpendPct: number | null;
        spendingPaceStatus: 'abaixo_do_ritmo' | 'no_ritmo' | 'acelerado';
        typicalMonthlyDiscretionaryPctOfIncome: number;
        next3MonthsForecast: MonthlyForecastPoint[];
    };
    weight3_wealthGoalsAndInvestments: {
        vaultConnected: boolean;
        composingBalanceShareOfFixedPct: number;
        isolatedReservesShareOfFixedPct: number;
        lockedUntilMaturityShareOfFixedPct: number;
        fixedIncomePct: number;
        variableIncomeAndCryptoPct: number;
        variableBreakdownPct: Partial<Record<AssetClass, number>>;
        cryptoShareOfWealthPct: number;
        averageCdiPct: number | null;
        activeGoalsAvgProgressPct: number | null;
    };
    weight4_safetyBufferContextOnly: {
        emergencyRunwayMonths: number | null;
        rule: string;
    };
    topExpenseCategoriesPct: CategoryExpenseRatio[];
}

export interface FutureMonthCommittedInput {
    monthLabel: string;
    committedInstallments: number;
}

export interface LocalDiagnosticInput {
    monthlyIncomes: number;
    monthlyExpenses: number;
    monthlyDirectExpenses: number;
    monthlyCreditCardInvoice: number;
    monthlySubscriptions: number;
    categoryTotals: Record<string, number>;
    last3MonthsAvgTotalSpend: number;
    last3MonthsAvgDiscretionarySpend: number;
    next3MonthsCommitted: FutureMonthCommittedInput[];
    monthDayProgressPct: number;
    isVaultUnlocked: boolean;
    piggybanks: Piggybank[];
    variableAssets: VariableAsset[];
    financialGoals?: Array<{ target_amount?: number; current_amount?: number; status?: string }>;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function buildZeroKnowledgeDiagnostics(input: LocalDiagnosticInput): {
    anonymizedProfile: AnonymizedFinancialProfile;
    localInsights: string[];
} {
    const inc = Math.max(0, Number(input.monthlyIncomes) || 0);
    const exp = Math.max(0, Number(input.monthlyExpenses) || 0);
    const directExp = Math.max(0, Number(input.monthlyDirectExpenses) || 0);
    const cardExp = Math.max(0, Number(input.monthlyCreditCardInvoice) || 0);
    const subs = Math.max(0, Number(input.monthlySubscriptions) || 0);
    const monthProgressPct = Math.max(1, Math.min(100, round1(input.monthDayProgressPct || 50)));

    const expenseCommitmentPct = inc > 0 ? round1((exp / inc) * 100) : (exp > 0 ? 100 : 0);
    const savingsRatePct = inc > 0 ? round1(((inc - exp) / inc) * 100) : 0;
    const directExpensesSharePct = exp > 0 ? round1((directExp / exp) * 100) : 0;
    const creditCardInvoiceSharePct = exp > 0 ? round1((cardExp / exp) * 100) : 0;
    const creditCardToIncomePct = inc > 0 ? round1((cardExp / inc) * 100) : 0;
    const subscriptionsShareOfIncomePct = inc > 0 ? round1((subs / inc) * 100) : 0;

    let healthStatus: 'excelente' | 'saudavel' | 'atencao' | 'critico' = 'saudavel';
    if (savingsRatePct >= 30) healthStatus = 'excelente';
    else if (savingsRatePct >= 15) healthStatus = 'saudavel';
    else if (savingsRatePct >= 0) healthStatus = 'atencao';
    else healthStatus = 'critico';

    // Top 5 categorias de despesa em %
    const totalCatSum = Object.values(input.categoryTotals).reduce((a, b) => a + b, 0);
    const topExpenseCategoriesPct: CategoryExpenseRatio[] = totalCatSum > 0
        ? Object.entries(input.categoryTotals)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([category, val]) => ({
                category,
                sharePct: round1((val / totalCatSum) * 100)
            }))
        : [];

    // Caixinhas separadas por papel: compõe saldo (disponível agora) vs. reserva isolada vs. travada
    let fixedIncomeTotal = 0;
    let composingBalanceTotal = 0;
    let isolatedReservesTotal = 0;
    let dailyLiquidTotal = 0;
    let lockedMaturityTotal = 0;
    let cdiWeightedSum = 0;
    let cdiWeightBase = 0;
    let goalProgressSum = 0;
    let goalProgressCount = 0;

    if (input.isVaultUnlocked) {
        for (const p of input.piggybanks) {
            const amt = Math.max(0, Number(p.current_amount) || 0);
            const target = Math.max(0, Number(p.target_amount) || 0);
            fixedIncomeTotal += amt;

            if (p.composes_balance) {
                composingBalanceTotal += amt;
            } else {
                isolatedReservesTotal += amt;
            }

            if (p.liquidity === 'maturity') {
                lockedMaturityTotal += amt;
            } else {
                dailyLiquidTotal += amt;
            }

            if ((p.indexer || 'CDI') === 'CDI' && amt > 0) {
                cdiWeightedSum += amt * Number(p.rate_value || 100);
                cdiWeightBase += amt;
            }

            if (target > 0) {
                goalProgressSum += Math.min(100, (amt / target) * 100);
                goalProgressCount += 1;
            }
        }
    }

    const varByClass: Record<AssetClass, number> = {
        ACAO: 0,
        FII: 0,
        ETF: 0,
        CRIPTO: 0,
        BDR: 0
    };
    let variableTotal = 0;
    if (input.isVaultUnlocked) {
        for (const a of input.variableAssets) {
            const pos = Math.max(0, Number(a.quantity || 0) * Number(a.current_price || 0));
            variableTotal += pos;
            const cls = a.asset_class || 'ACAO';
            varByClass[cls] = (varByClass[cls] || 0) + pos;
        }
    }

    const totalWealth = fixedIncomeTotal + variableTotal;
    const fixedIncomePct = totalWealth > 0 ? round1((fixedIncomeTotal / totalWealth) * 100) : 0;
    const variableIncomeAndCryptoPct = totalWealth > 0 ? round1((variableTotal / totalWealth) * 100) : 0;
    const cryptoShareOfWealthPct = totalWealth > 0 ? round1((varByClass.CRIPTO / totalWealth) * 100) : 0;

    const variableBreakdownPct: Partial<Record<AssetClass, number>> = {};
    if (totalWealth > 0) {
        (Object.keys(varByClass) as AssetClass[]).forEach(cls => {
            if (varByClass[cls] > 0) {
                variableBreakdownPct[cls] = round1((varByClass[cls] / totalWealth) * 100);
            }
        });
    }

    const composingBalanceShareOfFixedPct = fixedIncomeTotal > 0 ? round1((composingBalanceTotal / fixedIncomeTotal) * 100) : 0;
    const isolatedReservesShareOfFixedPct = fixedIncomeTotal > 0 ? round1((isolatedReservesTotal / fixedIncomeTotal) * 100) : 0;
    const lockedUntilMaturityShareOfFixedPct = fixedIncomeTotal > 0 ? round1((lockedMaturityTotal / fixedIncomeTotal) * 100) : 0;
    const averageCdiPct = cdiWeightBase > 0 ? round1(cdiWeightedSum / cdiWeightBase) : null;
    const activeGoalsAvgProgressPct = goalProgressCount > 0 ? round1(goalProgressSum / goalProgressCount) : null;

    // Peso 1: Saldo disponível para gastar agora (Entradas + caixinhas que compõem saldo - Despesas)
    const spendableNowFree = inc + composingBalanceTotal - exp;
    const spendableNowCoversMonthExpenses = spendableNowFree >= 0;
    const spendableNowFreeRatioOfIncomePct = inc > 0 ? round1((spendableNowFree / inc) * 100) : null;

    // Peso 2: Tendência de consumo no mês atual + projeção dos próximos 3 meses
    const avg3mTotal = Math.max(0, Number(input.last3MonthsAvgTotalSpend) || 0);
    const avg3mDiscretionary = Math.max(0, Number(input.last3MonthsAvgDiscretionarySpend) || 0);

    // Projeção de fechamento do mês atual:
    // Se já passou pelo menos 20% do mês, projeta ritmo linear limitado; senão usa a média dos últimos 3 meses.
    const rawProjectedMonthSpend = monthProgressPct >= 20
        ? Math.max(exp, exp / (monthProgressPct / 100))
        : (avg3mTotal > 0 ? Math.max(exp, avg3mTotal) : exp);
    const currentMonthProjectedCommitmentPct = inc > 0 ? round1((rawProjectedMonthSpend / inc) * 100) : expenseCommitmentPct;

    const vsLast3MonthsAvgSpendPct = avg3mTotal > 0
        ? round1(((rawProjectedMonthSpend - avg3mTotal) / avg3mTotal) * 100)
        : null;

    let spendingPaceStatus: 'abaixo_do_ritmo' | 'no_ritmo' | 'acelerado' = 'no_ritmo';
    if (expenseCommitmentPct > monthProgressPct + 12) spendingPaceStatus = 'acelerado';
    else if (expenseCommitmentPct < monthProgressPct - 15) spendingPaceStatus = 'abaixo_do_ritmo';

    const typicalMonthlyDiscretionaryPctOfIncome = inc > 0 ? round1((avg3mDiscretionary / inc) * 100) : 0;

    const next3MonthsForecast: MonthlyForecastPoint[] = (input.next3MonthsCommitted || []).map(m => {
        const committed = Math.max(0, Number(m.committedInstallments) || 0) + subs;
        const projectedTotal = committed + avg3mDiscretionary;
        const committedPctOfIncome = inc > 0 ? round1((committed / inc) * 100) : 0;
        const projectedTotalSpendPctOfIncome = inc > 0 ? round1((projectedTotal / inc) * 100) : 0;
        const projectedSavingsPct = inc > 0 ? round1(((inc - projectedTotal) / inc) * 100) : 0;
        return {
            monthLabel: m.monthLabel,
            committedPctOfIncome,
            projectedTotalSpendPctOfIncome,
            projectedSavingsPct
        };
    });

    // Peso 4: Colchão de reserva (calculado sobre a média de gastos para ser mais realista)
    const monthlyCostBase = avg3mTotal > 0 ? avg3mTotal : exp;
    const emergencyRunwayMonths = input.isVaultUnlocked && monthlyCostBase > 0
        ? round1(dailyLiquidTotal / monthlyCostBase)
        : null;

    const anonymizedProfile: AnonymizedFinancialProfile = {
        privacyMode: 'zero-knowledge-ratios-only',
        note: 'Zero-Knowledge: nenhum valor em R$, nome de banco ou dado pessoal foi enviado. Apenas proporções, ritmos e tendências.',
        weight1_immediateCashAndCurrentMonth: {
            monthProgressPct,
            expenseCommitmentPct,
            savingsRatePct,
            spendableNowCoversMonthExpenses,
            spendableNowFreeRatioOfIncomePct,
            directExpensesSharePct,
            creditCardInvoiceSharePct,
            creditCardToIncomePct,
            subscriptionsShareOfIncomePct,
            healthStatus
        },
        weight2_trendAndNext3MonthsForecast: {
            currentMonthProjectedCommitmentPct,
            vsLast3MonthsAvgSpendPct,
            spendingPaceStatus,
            typicalMonthlyDiscretionaryPctOfIncome,
            next3MonthsForecast
        },
        weight3_wealthGoalsAndInvestments: {
            vaultConnected: input.isVaultUnlocked,
            composingBalanceShareOfFixedPct,
            isolatedReservesShareOfFixedPct,
            lockedUntilMaturityShareOfFixedPct,
            fixedIncomePct,
            variableIncomeAndCryptoPct,
            variableBreakdownPct,
            cryptoShareOfWealthPct,
            averageCdiPct,
            activeGoalsAvgProgressPct
        },
        weight4_safetyBufferContextOnly: {
            emergencyRunwayMonths,
            rule: 'NUNCA use a reserva isolada como justificativa para aprovar compras de consumo quando o Peso 1 ou Peso 2 estiverem apertados.'
        },
        topExpenseCategoriesPct
    };

    // Motor Determinístico Local de Insights (100% offline)
    const localInsights: string[] = [];

    if (inc > 0) {
        if (savingsRatePct >= 25) {
            localInsights.push(`Fluxo do mês saudável: você está poupando ${savingsRatePct}% da renda até aqui.`);
        } else if (savingsRatePct >= 10) {
            localInsights.push(`Você está poupando ${savingsRatePct}% da renda este mês (projeção de fechamento: ${currentMonthProjectedCommitmentPct}% comprometido).`);
        } else if (savingsRatePct >= 0) {
            localInsights.push(`Atenção no mês: gastos já consomem ${expenseCommitmentPct}% da renda (sobra atual de apenas ${savingsRatePct}%).`);
        } else {
            localInsights.push(`Alerta: saídas já superaram as entradas em ${Math.abs(savingsRatePct)}% neste mês.`);
        }

        if (creditCardToIncomePct >= 38) {
            localInsights.push(`Fatura do cartão já consome ${creditCardToIncomePct}% da sua renda mensal (${creditCardInvoiceSharePct}% das saídas). Evite empilhar novos parcelamentos.`);
        }

        const heaviestFuture = [...next3MonthsForecast].sort((a, b) => b.projectedTotalSpendPctOfIncome - a.projectedTotalSpendPctOfIncome)[0];
        if (heaviestFuture && heaviestFuture.projectedTotalSpendPctOfIncome >= 80) {
            localInsights.push(`Tendência futura apertada em ${heaviestFuture.monthLabel}: já há ${heaviestFuture.committedPctOfIncome}% comprometido e projeção total de ${heaviestFuture.projectedTotalSpendPctOfIncome}% da renda.`);
        }
    }

    if (topExpenseCategoriesPct.length > 0 && topExpenseCategoriesPct[0]!.sharePct >= 35) {
        localInsights.push(`Concentração alta: "${topExpenseCategoriesPct[0]!.category}" representa ${topExpenseCategoriesPct[0]!.sharePct}% das despesas do mês.`);
    }

    if (subscriptionsShareOfIncomePct >= 8) {
        localInsights.push(`Assinaturas ativas consomem ${subscriptionsShareOfIncomePct}% da renda mensal.`);
    }

    if (input.isVaultUnlocked && emergencyRunwayMonths !== null) {
        if (emergencyRunwayMonths < 6) {
            localInsights.push(`Reserva de emergência cobre ${emergencyRunwayMonths} meses do seu custo de vida — priorize chegar a 6 meses antes de aumentar risco.`);
        } else {
            localInsights.push(`Colchão de emergência sólido (${emergencyRunwayMonths} meses), mas mantenha compras do dia a dia dentro do orçamento mensal.`);
        }
    }

    return { anonymizedProfile, localInsights };
}

export interface MentionedPurchaseImpact {
    detectedAmountBrl: number;
    detectedItemsCount: number;
    detectedInstallments: number;
    fitsInMonthlyFreeCashFlow: boolean;
    fitsInSpendableNow: boolean;
    shareOfMonthlyFreeCashFlowPct: number | null;
    shareOfSpendableNowPct: number | null;
    shareOfMonthlyIncomePct: number | null;
    shareOfIsolatedReservesPct: number | null;
}

const parseBrazilianNumber = (raw: string): number => {
    const clean = raw.trim().replace(/\s+/g, '');
    if (clean.includes(',') && clean.includes('.')) {
        return parseFloat(clean.replace(/\./g, '').replace(',', '.'));
    }
    if (clean.includes(',')) {
        return parseFloat(clean.replace(',', '.'));
    }
    if (/^\d{1,3}(\.\d{3})+$/.test(clean)) {
        return parseFloat(clean.replace(/\./g, ''));
    }
    return parseFloat(clean);
};

// Detecta UM OU VÁRIOS valores monetários na frase do usuário (ex: "beca de 300 reais e cartão sd de 300 reais" -> 600)
// e calcula localmente o impacto percentual sobre sobra do mês, saldo disponível agora e reserva isolada.
export function extractMentionedPurchaseImpact(
    text: string,
    context: {
        monthlyIncomes: number;
        freeMonthlyCashFlow: number;
        spendableNowFree: number;
        isolatedReserves: number | null;
    }
): MentionedPurchaseImpact | null {
    if (!text || !text.trim()) return null;

    let installments = 1;
    const instMatch = text.match(/\b(\d{1,2})\s*(?:x|vezes|parcelas?)\b/i);
    if (instMatch?.[1]) {
        const parsedInst = parseInt(instMatch[1], 10);
        if (parsedInst >= 1 && parsedInst <= 48) {
            installments = parsedInst;
        }
    }

    // Formato "10x de 150"
    const perInstMatch = text.match(/\b\d{1,2}\s*(?:x|vezes|parcelas?)\s*(?:de\s*)?(?:R\$\s*)?(\d+(?:[.,]\d{1,3})*(?:,\d{1,2})?)/i);
    let totalAmount = 0;
    let itemsCount = 0;

    if (perInstMatch?.[1] && installments > 1) {
        const instVal = parseBrazilianNumber(perInstMatch[1]);
        if (!Number.isNaN(instVal) && instVal > 0) {
            totalAmount = Math.round(instVal * installments * 100) / 100;
            itemsCount = 1;
        }
    }

    // Soma TODAS as ocorrências de valores monetários mencionados na mensagem (ex: "300 reais ... 300 reais" = 600)
    if (totalAmount <= 0) {
        const combinedRx = /(?:R\$\s*(\d+(?:[.,]\d{1,3})*(?:,\d{1,2})?))|(?:(\d+(?:[.,]\d{1,3})*(?:,\d{1,2})?)\s*(?:reais|real|conto|pila)\b)|(?:(?:de|por|custa|custando|valor(?:\s+de)?)\s+(?:R\$\s*)?(\d+(?:[.,]\d{1,3})*(?:,\d{1,2})?)\b)/gi;
        const matches = [...text.matchAll(combinedRx)];
        for (const m of matches) {
            const rawNum = m[1] || m[2] || m[3];
            if (!rawNum) continue;
            const val = parseBrazilianNumber(rawNum);
            if (!Number.isNaN(val) && val > 0) {
                totalAmount += val;
                itemsCount += 1;
            }
        }
        totalAmount = Math.round(totalAmount * 100) / 100;
    }

    if (totalAmount <= 0) return null;

    const monthlyHit = totalAmount / installments;
    const freeFlow = Number(context.freeMonthlyCashFlow || 0);
    const spendable = Number(context.spendableNowFree || 0);
    const income = Number(context.monthlyIncomes || 0);
    const isolated = context.isolatedReserves;

    return {
        detectedAmountBrl: totalAmount,
        detectedItemsCount: Math.max(1, itemsCount),
        detectedInstallments: installments,
        fitsInMonthlyFreeCashFlow: freeFlow >= monthlyHit,
        fitsInSpendableNow: spendable >= monthlyHit,
        shareOfMonthlyFreeCashFlowPct: freeFlow > 0 ? round1((monthlyHit / freeFlow) * 100) : null,
        shareOfSpendableNowPct: spendable > 0 ? round1((monthlyHit / spendable) * 100) : null,
        shareOfMonthlyIncomePct: income > 0 ? round1((monthlyHit / income) * 100) : null,
        shareOfIsolatedReservesPct: isolated !== null && isolated > 0 ? round1((totalAmount / isolated) * 100) : null
    };
}
