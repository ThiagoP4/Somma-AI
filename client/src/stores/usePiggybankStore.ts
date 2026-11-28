import { defineStore } from 'pinia';
import { ref } from 'vue';
import { supabase } from '../services/supabase';
import { useProfileStore } from './useProfileStore';

export type YieldIndexer = 'CDI' | 'PREFIXADO' | 'IPCA' | 'SELIC' | 'NONE';
export type LiquidityType = 'daily' | 'maturity';

export interface PiggybankMeta {
    bank_name?: string;
    product_type?: string; // Ex: 'Caixinha RDB', 'CDB', 'LCI / LCA', 'Conta Remunerada', 'Tesouro Selic', 'Saldo em Conta'
    indexer?: YieldIndexer; // Ex: 'CDI', 'PREFIXADO', 'IPCA', 'SELIC', 'NONE'
    rate_value?: number; // Ex: 100 (100% do CDI), 12.5 (12.5% a.a. Prefixado), 6.2 (IPCA + 6.2%)
    liquidity?: LiquidityType; // 'daily' (Liquidez Diária) ou 'maturity' (Travado até o Vencimento)
    maturity_date?: string | null; // YYYY-MM-DD
    last_yield_date?: string | null; // YYYY-MM-DD (último dia útil capitalizado automaticamente)
    total_yield_earned?: number; // Total acumulado em R$ gerado pelo motor automático de juros
    effective_tax_rate?: number | null; // Alíquota efetiva calibrada de IR + IOF (%) aprendida com as conciliações do usuário
}

export interface BcbMarketRates {
    cdiAnnualPct: number; // Ex: 11.15 (% a.a.)
    ipcaAnnualPct: number; // Ex: 4.76 (% a.a.)
    updatedAt: string;
    source: 'bcb-live' | 'fallback';
}

export interface Piggybank extends PiggybankMeta {
    id_piggybank: string;
    user_id: string;
    title: string;
    target_amount: number;
    current_amount: number;
    composes_balance: boolean;
    created_at: string;
}

export const usePiggybankStore = defineStore('piggybank', () => {
    const piggybanks = ref<Piggybank[]>([]);
    const isLoading = ref(false);
    const lastAutoYieldGain = ref(0);
    const marketRates = ref<BcbMarketRates>({
        cdiAnnualPct: 11.15,
        ipcaAnnualPct: 4.60,
        updatedAt: new Date().toISOString(),
        source: 'fallback'
    });
    
    const META_STORAGE_KEY = 'somma_piggybank_meta_v1';
    const BCB_CACHE_KEY = 'somma_bcb_rates_cache_v1';

    // Busca a taxa CDI (Série 4389) e IPCA 12m (Série 13522) direto da API Oficial do Banco Central do Brasil
    const fetchBcbMarketRates = async (): Promise<BcbMarketRates> => {
        try {
            const cachedRaw = localStorage.getItem(BCB_CACHE_KEY);
            if (cachedRaw) {
                const cached = JSON.parse(cachedRaw) as BcbMarketRates;
                const ageHours = (Date.now() - new Date(cached.updatedAt).getTime()) / (1000 * 60 * 60);
                if (ageHours < 12 && cached.cdiAnnualPct > 0) {
                    marketRates.value = cached;
                    return cached;
                }
            }
        } catch {
            // Ignora cache inválido
        }

        try {
            const [cdiRes, ipcaRes] = await Promise.allSettled([
                fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.4389/dados/ultimos/1?formato=json'),
                fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.13522/dados/ultimos/1?formato=json')
            ]);

            let cdiAnnual = marketRates.value.cdiAnnualPct;
            let ipcaAnnual = marketRates.value.ipcaAnnualPct;
            let gotLive = false;

            if (cdiRes.status === 'fulfilled' && cdiRes.value.ok) {
                const data = await cdiRes.value.json();
                const val = parseFloat(String(data?.[0]?.valor || '').replace(',', '.'));
                if (!Number.isNaN(val) && val > 0) {
                    cdiAnnual = val;
                    gotLive = true;
                }
            }

            if (ipcaRes.status === 'fulfilled' && ipcaRes.value.ok) {
                const data = await ipcaRes.value.json();
                const val = parseFloat(String(data?.[0]?.valor || '').replace(',', '.'));
                if (!Number.isNaN(val) && val > 0) {
                    ipcaAnnual = val;
                }
            }

            const fresh: BcbMarketRates = {
                cdiAnnualPct: cdiAnnual,
                ipcaAnnualPct: ipcaAnnual,
                updatedAt: new Date().toISOString(),
                source: gotLive ? 'bcb-live' : 'fallback'
            };
            marketRates.value = fresh;
            localStorage.setItem(BCB_CACHE_KEY, JSON.stringify(fresh));
            return fresh;
        } catch {
            return marketRates.value;
        }
    };

    // Calcula os feriados bancários nacionais (ANBIMA / FEBRABAN) para qualquer ano (fixos + móveis via algoritmo de Meeus/Butcher da Páscoa)
    const getBrazilianBankHolidays = (year: number): Set<string> => {
        const pad = (n: number) => String(n).padStart(2, '0');
        const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

        // 1. Feriados Nacionais Fixos (FEBRABAN / ANBIMA)
        const holidays = new Set<string>([
            `${year}-01-01`, // Confraternização Universal
            `${year}-04-21`, // Tiradentes
            `${year}-05-01`, // Dia do Trabalhador
            `${year}-09-07`, // Independência do Brasil
            `${year}-10-12`, // Nossa Senhora Aparecida
            `${year}-11-02`, // Finados
            `${year}-11-15`, // Proclamação da República
            `${year}-11-20`, // Dia Nacional de Zumbi e da Consciência Negra (Lei 14.759/2023)
            `${year}-12-25`  // Natal
        ]);

        // 2. Feriados Móveis Bancários baseados no Domingo de Páscoa (Algoritmo de Meeus/Jones/Butcher)
        const a = year % 19;
        const b = Math.floor(year / 100);
        const c = year % 100;
        const d = Math.floor(b / 4);
        const e = b % 4;
        const f = Math.floor((b + 8) / 25);
        const g = Math.floor((b - f + 1) / 3);
        const h = (19 * a + b - d - g + 15) % 30;
        const i = Math.floor(c / 4);
        const k = c % 4;
        const l = (32 + 2 * e + 2 * i - h - k) % 7;
        const m = Math.floor((a + 11 * h + 22 * l) / 451);
        const easterMonth = Math.floor((h + l - 7 * m + 114) / 31); // 3 = Março, 4 = Abril
        const easterDay = ((h + l - 7 * m + 114) % 31) + 1;

        const addDaysToEaster = (offsetDays: number) => {
            const dt = new Date(year, easterMonth - 1, easterDay, 12, 0, 0);
            dt.setDate(dt.getDate() + offsetDays);
            return fmt(dt);
        };

        holidays.add(addDaysToEaster(-48)); // Segunda-feira de Carnaval (não há expediente bancário)
        holidays.add(addDaysToEaster(-47)); // Terça-feira de Carnaval (não há expediente bancário)
        holidays.add(addDaysToEaster(-2));  // Sexta-feira da Paixão
        holidays.add(addDaysToEaster(60));  // Corpus Christi

        return holidays;
    };

    const isBrazilianBusinessDay = (dateObj: Date): boolean => {
        const dayOfWeek = dateObj.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) return false;
        const year = dateObj.getFullYear();
        const pad = (n: number) => String(n).padStart(2, '0');
        const isoDate = `${year}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`;
        const holidays = getBrazilianBankHolidays(year);
        return !holidays.has(isoDate);
    };

    // Conta quantos dias úteis bancários (Seg-Sex, excluindo feriados nacionais ANBIMA/FEBRABAN) se passaram entre startDate e endDate
    const countBusinessDaysBetween = (startDateStr: string, endDateStr: string): number => {
        const startClean = startDateStr.slice(0, 10);
        const endClean = endDateStr.slice(0, 10);
        if (!startClean || !endClean || startClean >= endClean) return 0;

        const cur = new Date(`${startClean}T12:00:00`);
        const end = new Date(`${endClean}T12:00:00`);
        if (Number.isNaN(cur.getTime()) || Number.isNaN(end.getTime())) return 0;

        let businessDays = 0;
        while (cur < end) {
            cur.setDate(cur.getDate() + 1);
            if (isBrazilianBusinessDay(cur)) {
                businessDays++;
            }
        }
        return businessDays;
    };

    // Calcula a taxa diária (base 252 dias úteis do Banco Central) para uma conta/caixinha
    const getDailyBusinessYieldRate = (piggy: Piggybank): number => {
        const idx = piggy.indexer || 'CDI';
        if (idx === 'NONE') return 0;

        const rate = piggy.rate_value !== undefined && piggy.rate_value !== null ? Number(piggy.rate_value) : 100;
        const cdiAnnualDecimal = marketRates.value.cdiAnnualPct / 100; // Ex: 0.1115 (11.15% a.a.)
        const ipcaAnnualDecimal = marketRates.value.ipcaAnnualPct / 100;

        if (idx === 'CDI' || idx === 'SELIC') {
            // Fator diário do CDI = (1 + CDI_anual)^(1/252) - 1, multiplicado pelo % do CDI (ex: 120% = 1.20)
            const baseDailyCdi = Math.pow(1 + cdiAnnualDecimal, 1 / 252) - 1;
            return baseDailyCdi * (rate / 100);
        }
        if (idx === 'PREFIXADO') {
            // Ex: 13.5% a.a. -> (1 + 0.135)^(1/252) - 1
            return Math.pow(1 + rate / 100, 1 / 252) - 1;
        }
        if (idx === 'IPCA') {
            // Ex: IPCA + 6% a.a. -> ((1 + IPCA) * (1 + spread))^(1/252) - 1
            const combinedAnnual = (1 + ipcaAnnualDecimal) * (1 + rate / 100) - 1;
            return Math.pow(1 + combinedAnnual, 1 / 252) - 1;
        }
        return 0;
    };

    // Verifica se o produto é isento de Imposto de Renda (LCI, LCA, Poupança)
    const isTaxExemptProduct = (piggy: Piggybank): boolean => {
        const prod = (piggy.product_type || piggy.title || '').toUpperCase();
        if (prod.includes('LCI') || prod.includes('LCA') || prod.includes('POUPAN')) return true;
        if (piggy.indexer === 'NONE') return true;
        return false;
    };

    // Verifica se a conta já possui uma alíquota de IR/IOF calibrada pelo aprendizado das conciliações
    const hasCalibratedTaxRate = (piggy: Piggybank): boolean => {
        if (isTaxExemptProduct(piggy)) return false;
        return piggy.effective_tax_rate !== undefined && piggy.effective_tax_rate !== null && !Number.isNaN(Number(piggy.effective_tax_rate));
    };

    // Retorna a alíquota efetiva calibrada (se já aprendida) ou a Tabela Regressiva de IR (22.5% -> 20% -> 17.5% -> 15%), ou 0% se LCI/LCA
    const getEstimatedIrRatePct = (piggy: Piggybank): number => {
        if (isTaxExemptProduct(piggy)) return 0;
        if (hasCalibratedTaxRate(piggy)) {
            const calibrated = Number(piggy.effective_tax_rate);
            return Math.min(95, Math.max(0, calibrated));
        }
        const createdStr = (piggy.created_at || '').slice(0, 10);
        if (!createdStr) return 22.5;
        const createdTime = new Date(`${createdStr}T12:00:00`).getTime();
        if (Number.isNaN(createdTime)) return 22.5;
        const daysOld = Math.max(0, Math.floor((Date.now() - createdTime) / (1000 * 60 * 60 * 24)));
        if (daysOld <= 180) return 22.5;
        if (daysOld <= 360) return 20.0;
        if (daysOld <= 720) return 17.5;
        return 15.0;
    };

    // Calcula a estimativa de rendimento acumulado desde a última conciliação (sem alterar o saldo real sozinho!)
    const getPendingYieldEstimate = (piggy: Piggybank) => {
        const todayStr = new Date().toISOString().slice(0, 10);
        const currentAmt = Number(piggy.current_amount || 0);
        const idx = piggy.indexer || 'CDI';
        const isExempt = isTaxExemptProduct(piggy);
        const irRatePct = getEstimatedIrRatePct(piggy);
        const refDate = (piggy.last_yield_date || piggy.created_at || todayStr).slice(0, 10);

        if (currentAmt <= 0 || idx === 'NONE') {
            return { businessDays: 0, grossGain: 0, netGain: 0, irRatePct, isExempt, refDate };
        }

        const businessDays = countBusinessDaysBetween(refDate, todayStr);
        if (businessDays <= 0) {
            return { businessDays: 0, grossGain: 0, netGain: 0, irRatePct, isExempt, refDate };
        }

        const dailyRate = getDailyBusinessYieldRate(piggy);
        if (dailyRate <= 0) {
            return { businessDays, grossGain: 0, netGain: 0, irRatePct, isExempt, refDate };
        }

        const compoundFactor = Math.pow(1 + dailyRate, businessDays);
        const grossGain = Math.round((currentAmt * compoundFactor - currentAmt) * 100) / 100;
        const netGain = Math.round(grossGain * (1 - irRatePct / 100) * 100) / 100;

        return {
            businessDays,
            grossGain,
            netGain,
            irRatePct,
            isExempt,
            refDate
        };
    };

    // Upsert automático na aba Registros -> Entradas (fin_income) sob a categoria "Proventos" do mês atual
    const upsertMonthlyProventoIncome = async (piggy: Piggybank, gainAmount: number) => {
        const cleanGain = Math.round(Number(gainAmount) * 100) / 100;
        if (cleanGain < 0.01) return null;

        try {
            if (!profileStore.userId) await profileStore.fetchProfileData();
            const userId = profileStore.userId;
            if (!userId) return null;

            // 1. Localiza a categoria "Proventos" (ou "Rendimentos") do tipo receita; se não existir, cria automaticamente
            const { data: categories } = await supabase
                .from('fin_category')
                .select('*')
                .eq('type', 'receita');

            let proventosCat = (categories || []).find((c: any) =>
                /provento/i.test(String(c.description || ''))
            ) || (categories || []).find((c: any) =>
                /rendimento/i.test(String(c.description || ''))
            );

            if (!proventosCat) {
                const { data: createdCat } = await supabase
                    .from('fin_category')
                    .insert({
                        description: 'Proventos',
                        type: 'receita',
                        color: '#10B981',
                        user_id: userId
                    })
                    .select()
                    .single();
                proventosCat = createdCat;
            }

            const categoryId = proventosCat?.idCategory || null;
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const todayStr = now.toISOString().slice(0, 10);
            const firstDayOfMonth = `${year}-${month}-01`;
            const lastDayOfMonth = `${year}-${month}-${String(new Date(year, now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;

            const entryTitle = `Rendimento • ${piggy.title}`;

            // 2. Verifica se já existe uma entrada de Proventos para esta conta/caixinha no mês atual
            const { data: existingIncomes } = await supabase
                .from('fin_income')
                .select('*')
                .eq('user_id', userId)
                .gte('date', firstDayOfMonth)
                .lte('date', lastDayOfMonth);

            const normalizedTarget = entryTitle.trim().toLowerCase();
            const existing = (existingIncomes || []).find((inc: any) =>
                String(inc.title || '').trim().toLowerCase() === normalizedTarget
            );

            if (existing) {
                const newMonthTotal = Math.round((Number(existing.value || 0) + cleanGain) * 100) / 100;
                const { error } = await supabase
                    .from('fin_income')
                    .update({
                        value: newMonthTotal,
                        date: todayStr,
                        ...(categoryId ? { categoryId } : {})
                    })
                    .eq('idIncome', existing.idIncome);

                if (error) throw error;
                return { action: 'updated' as const, title: entryTitle, totalMonthValue: newMonthTotal };
            } else {
                const { error } = await supabase
                    .from('fin_income')
                    .insert({
                        title: entryTitle,
                        value: cleanGain,
                        categoryId,
                        date: todayStr,
                        user_id: userId
                    });

                if (error) throw error;
                return { action: 'created' as const, title: entryTitle, totalMonthValue: cleanGain };
            }
        } catch (err) {
            console.error('[PiggybankStore] Falha ao sincronizar Proventos em fin_income:', err);
            return null;
        }
    };

    // Ação de 1 Clique: Incorpora a estimativa líquida (ou bruta) ao saldo real e opcionalmente lança nos Proventos do mês
    const applyEstimatedYield = async (
        id_piggybank: string,
        mode: 'net' | 'gross' = 'net',
        syncToProventos = true
    ) => {
        const piggy = piggybanks.value.find(p => p.id_piggybank === id_piggybank);
        if (!piggy) return null;

        const todayStr = new Date().toISOString().slice(0, 10);
        const estimate = getPendingYieldEstimate(piggy);
        const gainToApply = mode === 'net' ? estimate.netGain : estimate.grossGain;
        if (gainToApply <= 0) {
            await updatePiggybank(id_piggybank, { last_yield_date: todayStr });
            return { gain: 0, proventoSync: null };
        }

        const newAmount = Math.round((Number(piggy.current_amount) + gainToApply) * 100) / 100;
        const totalEarned = Math.round(((Number(piggy.total_yield_earned) || 0) + gainToApply) * 100) / 100;

        await updatePiggybank(id_piggybank, {
            current_amount: newAmount,
            last_yield_date: todayStr,
            total_yield_earned: totalEarned
        });

        let proventoSync = null;
        if (syncToProventos) {
            proventoSync = await upsertMonthlyProventoIncome(piggy, gainToApply);
        }

        return { gain: gainToApply, proventoSync };
    };

    // Conciliação Inteligente com Auto-Calibração (Machine Learning / Implied Tax Calibration):
    // 1. Ajusta o saldo para o valor exato do app do banco (sem descontar das Receitas do mês)
    // 2. Se o usuário informou a % (ou R$ de imposto sobre o bruto) OU se houve dias úteis com ganho bruto estimado,
    //    calcula a alíquota real retida pelo banco e recalibra `effective_tax_rate` para que as próximas projeções sejam cirúrgicas!
    // 3. Opcionalmente soma o ganho líquido automaticamente na entrada "Proventos" do mês atual em fin_income.
    const reconcileRealBankBalance = async (
        id_piggybank: string,
        exactBankBalance: number,
        explicitTaxRatePct?: number | null,
        syncToProventos = true
    ) => {
        const piggy = piggybanks.value.find(p => p.id_piggybank === id_piggybank);
        if (!piggy) return null;

        const todayStr = new Date().toISOString().slice(0, 10);
        const cleanBalance = Math.round(Math.max(0, Number(exactBankBalance)) * 100) / 100;
        const prevBalance = Number(piggy.current_amount || 0);
        const diff = Math.round((cleanBalance - prevBalance) * 100) / 100;

        const prevEarned = Number(piggy.total_yield_earned || 0);
        const newTotalEarned = diff > 0
            ? Math.round((prevEarned + diff) * 100) / 100
            : prevEarned;

        let newEffectiveTaxRate: number | null | undefined = piggy.effective_tax_rate;
        let calibrationSource: 'manual' | 'implied-from-balance' | 'none' = 'none';

        if (!isTaxExemptProduct(piggy)) {
            if (explicitTaxRatePct !== undefined && explicitTaxRatePct !== null && !Number.isNaN(Number(explicitTaxRatePct))) {
                // Caso B: Usuário informou diretamente a alíquota efetiva (ou calculou via Bruto vs. Desconto R$ do app do banco)
                newEffectiveTaxRate = Math.round(Math.min(95, Math.max(0, Number(explicitTaxRatePct))) * 100) / 100;
                calibrationSource = 'manual';
            } else {
                // Caso A: Dedução matemática reversa a partir do ganho líquido real vs. ganho bruto BCB no período
                const pending = getPendingYieldEstimate(piggy);
                if (pending.businessDays > 0 && pending.grossGain >= 0.05 && diff > 0) {
                    const impliedTax = (1 - diff / pending.grossGain) * 100;
                    // Faixa realista de retenção (entre 0% e 92% considerando IOF regressivo de 30 dias + IR de 22.5%)
                    if (impliedTax >= 0 && impliedTax <= 92) {
                        if (hasCalibratedTaxRate(piggy)) {
                            // Média móvel exponencial (70% peso para a medição mais recente, 30% histórico) para suavizar centavos de arredondamento
                            const prevRate = Number(piggy.effective_tax_rate);
                            newEffectiveTaxRate = Math.round((0.7 * impliedTax + 0.3 * prevRate) * 100) / 100;
                        } else {
                            newEffectiveTaxRate = Math.round(impliedTax * 100) / 100;
                        }
                        calibrationSource = 'implied-from-balance';
                    }
                }
            }
        }

        const payload: Partial<Piggybank> = {
            current_amount: cleanBalance,
            last_yield_date: todayStr,
            total_yield_earned: newTotalEarned
        };

        if (newEffectiveTaxRate !== undefined) {
            payload.effective_tax_rate = newEffectiveTaxRate;
        }

        await updatePiggybank(id_piggybank, payload);

        let proventoSync = null;
        if (syncToProventos && diff >= 0.01) {
            proventoSync = await upsertMonthlyProventoIncome(piggy, diff);
        }

        return {
            diff,
            calibratedTaxPct: newEffectiveTaxRate,
            calibrationSource,
            proventoSync
        };
    };

    const getLocalMetaMap = (): Record<string, PiggybankMeta> => {
        try {
            return JSON.parse(localStorage.getItem(META_STORAGE_KEY) || '{}');
        } catch {
            return {};
        }
    };

    const saveLocalMeta = (id: string, meta: PiggybankMeta) => {
        const map = getLocalMetaMap();
        map[id] = { ...(map[id] || {}), ...meta };
        localStorage.setItem(META_STORAGE_KEY, JSON.stringify(map));
    };

    // Codifica metadados da aplicação no campo title da tabela fin_piggybank do Supabase
    // Ex: "Mercado Pago • Cofrinho da Virada | CDB Liquidez Diária • CDI:130% • VENC:2027-04-09"
    const encodeTitleWithMeta = (baseTitle: string, meta: PiggybankMeta): string => {
        const cleanBase = String(baseTitle || '').split('|')[0]?.trim() || 'Conta Digital';
        const tags: string[] = [];
        if (meta.product_type) tags.push(meta.product_type);
        const idx = meta.indexer || 'CDI';
        const rate = meta.rate_value !== undefined && meta.rate_value !== null ? Number(meta.rate_value) : 100;
        if (idx === 'NONE') {
            tags.push('NONE:0%');
        } else {
            tags.push(`${idx}:${rate}%`);
        }
        if (meta.liquidity === 'maturity' && meta.maturity_date) {
            tags.push(`VENC:${String(meta.maturity_date).slice(0, 10)}`);
        }
        if (meta.effective_tax_rate !== undefined && meta.effective_tax_rate !== null) {
            tags.push(`IR:${Number(meta.effective_tax_rate)}%`);
        }
        return tags.length > 0 ? `${cleanBase} | ${tags.join(' • ')}` : cleanBase;
    };

    // Decodifica metadados embutidos no title do Supabase (compatível com qualquer dispositivo sem depender de localStorage)
    const decodeMetaFromRow = (row: any, localMeta: PiggybankMeta = {}): Piggybank => {
        const rawTitle = String(row.title || '');
        const [cleanTitlePart, metaPart] = rawTitle.split('|').map(s => s.trim());
        const cleanTitle = cleanTitlePart || rawTitle;

        const bankFromTitle = cleanTitle.includes('•') ? cleanTitle.split('•')[0]?.trim() : undefined;
        let parsedProduct = row.product_type || localMeta.product_type;
        let parsedIndexer: YieldIndexer = (row.indexer || localMeta.indexer || 'CDI') as YieldIndexer;
        let parsedRate: number = row.rate_value !== undefined && row.rate_value !== null
            ? Number(row.rate_value)
            : (localMeta.rate_value !== undefined ? Number(localMeta.rate_value) : 120);
        let parsedLiquidity: LiquidityType = (row.liquidity || localMeta.liquidity || 'daily') as LiquidityType;
        let parsedMaturity: string | null = row.maturity_date || localMeta.maturity_date || null;
        let parsedTaxRate: number | null | undefined = row.effective_tax_rate ?? localMeta.effective_tax_rate ?? null;

        if (metaPart) {
            const segments = metaPart.split('•').map(s => s.trim()).filter(Boolean);
            for (const seg of segments) {
                const rateMatch = seg.match(/^(CDI|PREFIXADO|IPCA|SELIC|NONE)\s*:\s*([\d.,]+)%?$/i);
                const vencMatch = seg.match(/^VENC\s*:\s*(\d{4}-\d{2}-\d{2})/i);
                const irMatch = seg.match(/^IR\s*:\s*([\d.,]+)%?$/i);
                if (rateMatch) {
                    parsedIndexer = rateMatch[1]!.toUpperCase() as YieldIndexer;
                    parsedRate = parseFloat(rateMatch[2]!.replace(',', '.')) || 0;
                } else if (vencMatch) {
                    parsedLiquidity = 'maturity';
                    parsedMaturity = vencMatch[1]!;
                } else if (irMatch) {
                    parsedTaxRate = parseFloat(irMatch[1]!.replace(',', '.'));
                } else if (!parsedProduct) {
                    parsedProduct = seg;
                }
            }
        }

        if (!parsedProduct) {
            parsedProduct = parsedLiquidity === 'maturity' ? 'CDB Vencimento Fixo' : 'CDB Liquidez Diária';
        }

        return {
            ...localMeta,
            ...row,
            title: cleanTitle,
            target_amount: Number(row.target_amount || 0),
            current_amount: Number(row.current_amount || 0),
            bank_name: row.bank_name || localMeta.bank_name || bankFromTitle,
            product_type: parsedProduct,
            indexer: parsedIndexer,
            rate_value: parsedRate,
            liquidity: parsedLiquidity,
            maturity_date: parsedMaturity,
            effective_tax_rate: parsedTaxRate
        };
    };

    const enrichWithMeta = (items: any[]): Piggybank[] => {
        const metaMap = getLocalMetaMap();
        return items.map(item => decodeMetaFromRow(item, metaMap[item.id_piggybank] || {}));
    };

    const profileStore = useProfileStore();

    const fetchPiggybanks = async () => {
        isLoading.value = true;
        try {
            if (!profileStore.userId) await profileStore.fetchProfileData();

            await fetchBcbMarketRates();

            const { data, error } = await supabase
                .from('fin_piggybank')
                .select('*')
                .eq('user_id', profileStore.userId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            const onlyPiggybanks = (data || []).filter(
                (row: any) => !String(row?.title || '').startsWith('[ASSET]')
            );
            piggybanks.value = enrichWithMeta(onlyPiggybanks);

        } catch (error) {
            console.error('[PiggybankStore] Error fetching piggybanks:', error);
            piggybanks.value = [];
        } finally {
            isLoading.value = false;
        }
    };

    const createPiggybank = async (
        title: string,
        target_amount: number,
        composes_balance: boolean,
        meta: PiggybankMeta = {},
        initial_amount = 0
    ) => {
        const todayStr = new Date().toISOString().slice(0, 10);
        const fullMeta: PiggybankMeta = {
            last_yield_date: todayStr,
            total_yield_earned: 0,
            ...meta
        };

        try {
            const dbTitle = encodeTitleWithMeta(title, fullMeta);
            const { data, error } = await supabase
                .from('fin_piggybank')
                .insert([{
                    user_id: profileStore.userId,
                    title: dbTitle,
                    target_amount,
                    composes_balance,
                    current_amount: initial_amount
                }])
                .select()
                .single();

            if (error) throw error;
            if (data) {
                saveLocalMeta(data.id_piggybank, fullMeta);
                piggybanks.value.push(decodeMetaFromRow(data, fullMeta));
            }
        } catch (error) {
            console.error('[PiggybankStore] Error creating piggybank:', error);
            throw error;
        }
    };
    
    const updatePiggybank = async (id: string, updates: Partial<Piggybank>) => {
        try {
            const index = piggybanks.value.findIndex(p => p.id_piggybank === id);
            const current = index !== -1 ? piggybanks.value[index] : null;
            const mergedMeta: PiggybankMeta = {
                bank_name: updates.bank_name ?? current?.bank_name,
                product_type: updates.product_type ?? current?.product_type,
                indexer: updates.indexer ?? current?.indexer,
                rate_value: updates.rate_value ?? current?.rate_value,
                liquidity: updates.liquidity ?? current?.liquidity,
                maturity_date: updates.maturity_date !== undefined ? updates.maturity_date : current?.maturity_date,
                last_yield_date: updates.last_yield_date !== undefined ? updates.last_yield_date : current?.last_yield_date,
                total_yield_earned: updates.total_yield_earned ?? current?.total_yield_earned,
                effective_tax_rate: updates.effective_tax_rate !== undefined ? updates.effective_tax_rate : current?.effective_tax_rate
            };

            const baseTitle = updates.title ?? current?.title ?? 'Conta Digital';
            const dbUpdates: Record<string, any> = {
                title: encodeTitleWithMeta(baseTitle, mergedMeta)
            };
            if (updates.target_amount !== undefined) dbUpdates.target_amount = updates.target_amount;
            if (updates.current_amount !== undefined) dbUpdates.current_amount = updates.current_amount;
            if (updates.composes_balance !== undefined) dbUpdates.composes_balance = updates.composes_balance;

            const { error } = await supabase
                .from('fin_piggybank')
                .update(dbUpdates)
                .eq('id_piggybank', id);

            if (error) throw error;

            saveLocalMeta(id, mergedMeta);
            if (index !== -1) {
                const cleanTitle = String(baseTitle).split('|')[0]?.trim() || baseTitle;
                piggybanks.value[index] = {
                    ...piggybanks.value[index],
                    ...updates,
                    ...mergedMeta,
                    title: cleanTitle
                } as Piggybank;
            }
        } catch (error) {
            console.error('Erro ao atualizar cofrinho:', error);
            throw error;
        }
    };

    const deletePiggybank = async (id: string) => {
        try {
            const { error } = await supabase
                .from('fin_piggybank')
                .delete()
                .eq('id_piggybank', id);
            
            if (error) throw error;

            piggybanks.value = piggybanks.value.filter(p => p.id_piggybank !== id);
        } catch (error) {
            console.error('Erro ao excluir cofrinho:', error);
            throw error;
        }
    };

    const getAvailableToDeposit = async () => {
        try {
            const { data: incomes } = await supabase
                .from('fin_income')
                .select('value')
                .eq('user_id', profileStore.userId);
            
            const totalIncomes = (incomes || []).reduce((acc: number, curr: any) => acc + Number(curr.value), 0);
            // Desconta apenas o capital aportado das receitas (exclui os juros bancários total_yield_earned)
            const totalPrincipalSaved = piggybanks.value.reduce(
                (acc: number, curr: Piggybank) => acc + Math.max(0, Number(curr.current_amount) - Number(curr.total_yield_earned || 0)),
                0
            );
            
            return totalIncomes - totalPrincipalSaved;
        } catch (error) {
            console.error('Erro ao buscar disponível:', error);
            return 0;
        }
    };

    const addTransaction = async (id_piggybank: string, type: 'deposit' | 'withdraw', amount: number) => {
        try {
            const piggybank = piggybanks.value.find(p => p.id_piggybank === id_piggybank);

            if (!piggybank) {
                throw new Error('Cofrinho não encontrado');
            }

            if (type === 'deposit') {
                const { data: incomes } = await supabase
                    .from('fin_income')
                    .select('value')
                    .eq('user_id', profileStore.userId);
                
                const totalIncomes = (incomes || []).reduce((acc: number, curr: any) => acc + Number(curr.value), 0);
                const totalPrincipalSaved = piggybanks.value.reduce(
                    (acc: number, curr: Piggybank) => acc + Math.max(0, Number(curr.current_amount) - Number(curr.total_yield_earned || 0)),
                    0
                );
                const maxAvailable = totalIncomes - totalPrincipalSaved;

                if (amount > maxAvailable) {
                    throw new Error(`Saldo insuficiente! O valor máximo que você pode depositar das suas entradas é R$ ${maxAvailable.toFixed(2).replace('.', ',')}.`);
                }
            }

            const { error: txError } = await supabase
                .from('fin_piggybank_transaction')
                .insert([{
                    piggybank_id: id_piggybank,
                    user_id: profileStore.userId,
                    transaction_type: type,
                    amount
                }]);
                
            if (txError) throw txError;

            const newAmount = type === 'deposit'
                ? Number(piggybank.current_amount) + Number(amount)
                : Number(piggybank.current_amount) - Number(amount);

            await updatePiggybank(id_piggybank, { current_amount: newAmount });

        } catch (error) {
            console.error('[PiggybankStore] Error adding transaction:', error);
            throw error;
        }
    };

    return {
        piggybanks,
        isLoading,
        marketRates,
        lastAutoYieldGain,
        fetchBcbMarketRates,
        getDailyBusinessYieldRate,
        isTaxExemptProduct,
        hasCalibratedTaxRate,
        getEstimatedIrRatePct,
        getPendingYieldEstimate,
        applyEstimatedYield,
        reconcileRealBankBalance,
        fetchPiggybanks,
        createPiggybank,
        updatePiggybank,
        deletePiggybank,
        addTransaction,
        getAvailableToDeposit
    };
});
