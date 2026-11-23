import type { Piggybank } from '../stores/usePiggybankStore';
import type { VariableAsset, AssetClass } from '../stores/useAssetsStore';

export interface CategoryExpenseRatio {
    category: string;
    sharePct: number;
}

export interface AnonymizedFinancialProfile {
    privacyMode: 'zero-knowledge-ratios-only';
    note: string;
    pureMonthlyFlow: {
        expenseCommitmentPct: number;
        savingsRatePct: number;
        directExpensesSharePct: number;
        creditCardInvoiceSharePct: number;
        creditCardToIncomePct: number;
        subscriptionsShareOfIncomePct: number;
        healthStatus: 'excelente' | 'saudavel' | 'atencao' | 'critico';
    };
    incomesPlusReservesFlow: {
        vaultConnected: boolean;
        expensesOverIncomesPlusReservesPct: number | null;
        remainingCapacityAfterExpensesPct: number | null;
        emergencyRunwayMonths: number | null;
    };
    topExpenseCategoriesPct: CategoryExpenseRatio[];
    portfolioAllocationPct: {
        vaultConnected: boolean;
        fixedIncomePct: number;
        variableIncomeAndCryptoPct: number;
        variableBreakdownPct: Partial<Record<AssetClass, number>>;
        dailyLiquidityPct: number;
        lockedUntilMaturityPct: number;
        averageCdiPct: number | null;
    };
}

export interface LocalDiagnosticInput {
    monthlyIncomes: number;
    monthlyExpenses: number;
    monthlyDirectExpenses: number;
    monthlyCreditCardInvoice: number;
    monthlySubscriptions: number;
    categoryTotals: Record<string, number>;
    isVaultUnlocked: boolean;
    piggybanks: Piggybank[];
    variableAssets: VariableAsset[];
}

export function buildZeroKnowledgeDiagnostics(input: LocalDiagnosticInput): {
    anonymizedProfile: AnonymizedFinancialProfile;
    localInsights: string[];
} {
    const inc = Math.max(0, Number(input.monthlyIncomes) || 0);
    const exp = Math.max(0, Number(input.monthlyExpenses) || 0);
    const directExp = Math.max(0, Number(input.monthlyDirectExpenses) || 0);
    const cardExp = Math.max(0, Number(input.monthlyCreditCardInvoice) || 0);
    const subs = Math.max(0, Number(input.monthlySubscriptions) || 0);

    const expenseCommitmentPct = inc > 0 ? Math.round((exp / inc) * 1000) / 10 : (exp > 0 ? 100 : 0);
    const savingsRatePct = inc > 0 ? Math.round(((inc - exp) / inc) * 1000) / 10 : 0;
    const directExpensesSharePct = exp > 0 ? Math.round((directExp / exp) * 1000) / 10 : 0;
    const creditCardInvoiceSharePct = exp > 0 ? Math.round((cardExp / exp) * 1000) / 10 : 0;
    const creditCardToIncomePct = inc > 0 ? Math.round((cardExp / inc) * 1000) / 10 : 0;
    const subscriptionsShareOfIncomePct = inc > 0 ? Math.round((subs / inc) * 1000) / 10 : 0;

    let healthStatus: 'excelente' | 'saudavel' | 'atencao' | 'critico' = 'saudavel';
    if (savingsRatePct >= 30) healthStatus = 'excelente';
    else if (savingsRatePct >= 15) healthStatus = 'saudavel';
    else if (savingsRatePct >= 0) healthStatus = 'atencao';
    else healthStatus = 'critico';

    // Top 5 categorias de despesa em % (sem valores em R$)
    const totalCatSum = Object.values(input.categoryTotals).reduce((a, b) => a + b, 0);
    const topExpenseCategoriesPct: CategoryExpenseRatio[] = totalCatSum > 0
        ? Object.entries(input.categoryTotals)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([category, val]) => ({
                category,
                sharePct: Math.round((val / totalCatSum) * 1000) / 10
            }))
        : [];

    // Carteira (apenas percentuais e meses de reserva, sem valores absolutos em R$ nem nomes de bancos!)
    let fixedIncomeTotal = 0;
    let dailyLiquidTotal = 0;
    let lockedMaturityTotal = 0;
    let cdiWeightedSum = 0;
    let cdiWeightBase = 0;

    if (input.isVaultUnlocked) {
        for (const p of input.piggybanks) {
            const amt = Math.max(0, Number(p.current_amount) || 0);
            fixedIncomeTotal += amt;
            if (p.liquidity === 'maturity') {
                lockedMaturityTotal += amt;
            } else {
                dailyLiquidTotal += amt;
            }
            if ((p.indexer || 'CDI') === 'CDI' && amt > 0) {
                cdiWeightedSum += amt * Number(p.rate_value || 100);
                cdiWeightBase += amt;
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
    const fixedIncomePct = totalWealth > 0 ? Math.round((fixedIncomeTotal / totalWealth) * 1000) / 10 : 0;
    const variableIncomeAndCryptoPct = totalWealth > 0 ? Math.round((variableTotal / totalWealth) * 1000) / 10 : 0;

    const variableBreakdownPct: Partial<Record<AssetClass, number>> = {};
    if (totalWealth > 0) {
        (Object.keys(varByClass) as AssetClass[]).forEach(cls => {
            if (varByClass[cls] > 0) {
                variableBreakdownPct[cls] = Math.round((varByClass[cls] / totalWealth) * 1000) / 10;
            }
        });
    }

    const dailyLiquidityPct = fixedIncomeTotal > 0 ? Math.round((dailyLiquidTotal / fixedIncomeTotal) * 1000) / 10 : 0;
    const lockedUntilMaturityPct = fixedIncomeTotal > 0 ? Math.round((lockedMaturityTotal / fixedIncomeTotal) * 1000) / 10 : 0;
    const averageCdiPct = cdiWeightBase > 0 ? Math.round((cdiWeightedSum / cdiWeightBase) * 10) / 10 : null;
    const emergencyRunwayMonths = input.isVaultUnlocked && exp > 0
        ? Math.round((dailyLiquidTotal / exp) * 10) / 10
        : null;

    const totalIncomesPlusReserves = inc + dailyLiquidTotal;
    const expensesOverIncomesPlusReservesPct = input.isVaultUnlocked && totalIncomesPlusReserves > 0
        ? Math.round((exp / totalIncomesPlusReserves) * 1000) / 10
        : null;
    const remainingCapacityAfterExpensesPct = input.isVaultUnlocked && totalIncomesPlusReserves > 0
        ? Math.round(((totalIncomesPlusReserves - exp) / totalIncomesPlusReserves) * 1000) / 10
        : null;

    const anonymizedProfile: AnonymizedFinancialProfile = {
        privacyMode: 'zero-knowledge-ratios-only',
        note: 'Nenhum valor absoluto em R$, nome de banco ou dado pessoal foi incluído. Apenas proporções percentuais.',
        pureMonthlyFlow: {
            expenseCommitmentPct,
            savingsRatePct,
            directExpensesSharePct,
            creditCardInvoiceSharePct,
            creditCardToIncomePct,
            subscriptionsShareOfIncomePct,
            healthStatus
        },
        incomesPlusReservesFlow: {
            vaultConnected: input.isVaultUnlocked,
            expensesOverIncomesPlusReservesPct,
            remainingCapacityAfterExpensesPct,
            emergencyRunwayMonths
        },
        topExpenseCategoriesPct,
        portfolioAllocationPct: {
            vaultConnected: input.isVaultUnlocked,
            fixedIncomePct,
            variableIncomeAndCryptoPct,
            variableBreakdownPct,
            dailyLiquidityPct,
            lockedUntilMaturityPct,
            averageCdiPct
        }
    };

    // Motor Determinístico Local de Insights (100% offline, sem chamar IA externa)
    const localInsights: string[] = [];

    if (inc > 0) {
        if (savingsRatePct >= 25) {
            localInsights.push(`Excelente disciplina no fluxo puro do mês: você está poupando ${savingsRatePct}% da sua renda mensal (acima da meta ideal de 20%).`);
        } else if (savingsRatePct >= 10) {
            localInsights.push(`No fluxo puro do mês, você está poupando ${savingsRatePct}% da renda. Reduzir 5% na maior categoria te leva à faixa ouro de 20%+.`);
        } else if (savingsRatePct >= 0) {
            localInsights.push(`Atenção no fluxo puro do mês: seus gastos consomem ${expenseCommitmentPct}% da renda (sobra de apenas ${savingsRatePct}%). Evite novos parcelamentos agora.`);
        } else {
            localInsights.push(`Alerta no fluxo puro do mês: suas saídas superaram as entradas em ${Math.abs(savingsRatePct)}%. Congele gastos não essenciais imediatamente.`);
        }

        if (creditCardToIncomePct >= 40) {
            localInsights.push(`A fatura do cartão consome ${creditCardToIncomePct}% da sua renda mensal (${creditCardInvoiceSharePct}% de todas as saídas). Vale frear parcelamentos novos.`);
        }
    }

    if (topExpenseCategoriesPct.length > 0) {
        const top = topExpenseCategoriesPct[0]!;
        if (top.sharePct >= 35) {
            localInsights.push(`Concentração alta: "${top.category}" representa ${top.sharePct}% de todas as suas despesas do mês.`);
        }
    }

    if (subscriptionsShareOfIncomePct >= 8) {
        localInsights.push(`Suas assinaturas recorrentes consomem ${subscriptionsShareOfIncomePct}% da sua renda mensal — vale revisar serviços pouco usados.`);
    }

    if (input.isVaultUnlocked && emergencyRunwayMonths !== null) {
        if (emergencyRunwayMonths < 3) {
            localInsights.push(`Sua liquidez diária cobre ${emergencyRunwayMonths} meses do seu custo de vida atual. Priorize construir pelo menos 6 meses de reserva antes de aumentar exposição em risco.`);
        } else if (emergencyRunwayMonths >= 6) {
            localInsights.push(`Reserva sólida! Sua liquidez diária cobre ${emergencyRunwayMonths} meses do seu padrão de gastos — você já tem espaço seguro para buscar mais rentabilidade (CDBs longos, LCI/LCA ou Renda Variável).`);
        }
    }

    if (input.isVaultUnlocked && averageCdiPct !== null && averageCdiPct < 100) {
        localInsights.push(`Sua média ponderada em Renda Fixa está em ${averageCdiPct}% do CDI. Considere migrar saldos parados sem remuneração para caixinhas >= 100% CDI.`);
    }

    return { anonymizedProfile, localInsights };
}

export interface MentionedPurchaseImpact {
    detectedAmountBrl: number;
    detectedInstallments: number;
    fitsInMonthlyFreeCashFlow: boolean;
    shareOfMonthlyFreeCashFlowPct: number | null;
    shareOfMonthlyIncomePct: number | null;
    shareOfDailyLiquidityPct: number | null;
    shareOfIncomesPlusReservesFreePct: number | null;
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

// Detecta valores monetários digitados na frase do usuário (ex: "R$ 300", "300 reais", "10x de 150")
// e calcula localmente o impacto percentual sem enviar saldos absolutos para a IA.
export function extractMentionedPurchaseImpact(
    text: string,
    context: {
        monthlyIncomes: number;
        freeMonthlyCashFlow: number;
        dailyLiquidReserve: number | null;
    }
): MentionedPurchaseImpact | null {
    if (!text || !text.trim()) return null;

    // 1. Detecta número de parcelas se mencionado (ex: "10x", "em 12 vezes", "6 parcelas")
    let installments = 1;
    const instMatch = text.match(/\b(\d{1,2})\s*(?:x|vezes|parcelas?)\b/i);
    if (instMatch?.[1]) {
        const parsedInst = parseInt(instMatch[1], 10);
        if (parsedInst >= 1 && parsedInst <= 48) {
            installments = parsedInst;
        }
    }

    // 2. Detecta formato "10x de 150" (valor da parcela)
    const perInstMatch = text.match(/\b\d{1,2}\s*(?:x|vezes|parcelas?)\s*(?:de\s*)?(?:R\$\s*)?(\d+(?:[.,]\d{1,3})*(?:,\d{1,2})?)/i);
    let totalAmount = 0;

    if (perInstMatch?.[1] && installments > 1) {
        const instVal = parseBrazilianNumber(perInstMatch[1]);
        if (!Number.isNaN(instVal) && instVal > 0) {
            totalAmount = Math.round(instVal * installments * 100) / 100;
        }
    }

    // 3. Detecta "R$ 300", "300 reais", "de 300", "por 1.200,00"
    if (totalAmount <= 0) {
        const currencyRegexes = [
            /R\$\s*(\d+(?:[.,]\d{1,3})*(?:,\d{1,2})?)/i,
            /(\d+(?:[.,]\d{1,3})*(?:,\d{1,2})?)\s*(?:reais|real|conto|pila)\b/i,
            /(?:de|por|custa|custando|valor(?:\s+de)?)\s+(?:R\$\s*)?(\d+(?:[.,]\d{1,3})*(?:,\d{1,2})?)\b/i
        ];
        for (const rx of currencyRegexes) {
            const m = text.match(rx);
            if (m?.[1]) {
                const val = parseBrazilianNumber(m[1]);
                if (!Number.isNaN(val) && val > 0) {
                    totalAmount = Math.round(val * 100) / 100;
                    break;
                }
            }
        }
    }

    if (totalAmount <= 0) return null;

    const monthlyHit = totalAmount / installments;
    const freeFlow = Number(context.freeMonthlyCashFlow || 0);
    const income = Number(context.monthlyIncomes || 0);
    const liquid = context.dailyLiquidReserve;

    const totalFreeWithReserves = liquid !== null ? Math.max(0, freeFlow) + liquid : null;

    return {
        detectedAmountBrl: totalAmount,
        detectedInstallments: installments,
        fitsInMonthlyFreeCashFlow: freeFlow >= monthlyHit,
        shareOfMonthlyFreeCashFlowPct: freeFlow > 0 ? Math.round((monthlyHit / freeFlow) * 1000) / 10 : null,
        shareOfMonthlyIncomePct: income > 0 ? Math.round((monthlyHit / income) * 1000) / 10 : null,
        shareOfDailyLiquidityPct: liquid !== null && liquid > 0 ? Math.round((totalAmount / liquid) * 1000) / 10 : null,
        shareOfIncomesPlusReservesFreePct: totalFreeWithReserves !== null && totalFreeWithReserves > 0
            ? Math.round((totalAmount / totalFreeWithReserves) * 1000) / 10
            : null
    };
}
