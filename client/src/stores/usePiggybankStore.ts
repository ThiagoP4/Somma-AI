import { defineStore } from 'pinia';
import { ref } from 'vue';
import { supabase } from '../services/supabase';
import { useProfileStore } from './useProfileStore';
import { useVaultStore } from './useVaultStore';

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

    // Tabela Regressiva de Imposto de Renda de Renda Fixa (22.5% -> 20% -> 17.5% -> 15%) ou 0% se LCI/LCA
    const getEstimatedIrRatePct = (piggy: Piggybank): number => {
        if (isTaxExemptProduct(piggy)) return 0;
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

    // Ação de 1 Clique: Incorpora a estimativa líquida (ou bruta) ao saldo real
    const applyEstimatedYield = async (id_piggybank: string, mode: 'net' | 'gross' = 'net') => {
        const piggy = piggybanks.value.find(p => p.id_piggybank === id_piggybank);
        if (!piggy) return;

        const todayStr = new Date().toISOString().slice(0, 10);
        const estimate = getPendingYieldEstimate(piggy);
        const gainToApply = mode === 'net' ? estimate.netGain : estimate.grossGain;
        if (gainToApply <= 0) {
            await updatePiggybank(id_piggybank, { last_yield_date: todayStr });
            return;
        }

        const newAmount = Math.round((Number(piggy.current_amount) + gainToApply) * 100) / 100;
        const totalEarned = Math.round(((Number(piggy.total_yield_earned) || 0) + gainToApply) * 100) / 100;

        await updatePiggybank(id_piggybank, {
            current_amount: newAmount,
            last_yield_date: todayStr,
            total_yield_earned: totalEarned
        });
    };

    // Conciliação com o App do Banco: Ajusta o saldo para o valor exato exibido hoje no banco (sem descontar das Receitas do mês!)
    const reconcileRealBankBalance = async (id_piggybank: string, exactBankBalance: number) => {
        const piggy = piggybanks.value.find(p => p.id_piggybank === id_piggybank);
        if (!piggy) return;

        const todayStr = new Date().toISOString().slice(0, 10);
        const cleanBalance = Math.round(Math.max(0, Number(exactBankBalance)) * 100) / 100;
        const prevBalance = Number(piggy.current_amount || 0);
        const diff = Math.round((cleanBalance - prevBalance) * 100) / 100;

        const prevEarned = Number(piggy.total_yield_earned || 0);
        const newTotalEarned = diff > 0
            ? Math.round((prevEarned + diff) * 100) / 100
            : prevEarned;

        await updatePiggybank(id_piggybank, {
            current_amount: cleanBalance,
            last_yield_date: todayStr,
            total_yield_earned: newTotalEarned
        });
    };

    const getLocalMetaMap = (): Record<string, PiggybankMeta> => {
        try {
            return JSON.parse(localStorage.getItem(META_STORAGE_KEY) || '{}');
        } catch {
            return {};
        }
    };

    // Blindagem C (Zero-Trust): Nunca grava valores financeiros (saldos ou total_yield_earned em R$) no localStorage do navegador.
    // Quando conectado ao Tailscale Vault, os metadados já ficam no PostgreSQL isolado da VPS.
    const saveLocalMeta = (id: string, meta: PiggybankMeta) => {
        if (usePrivateTailscaleApi()) {
            // Remove qualquer cache antigo de metadados sensíveis do localStorage
            localStorage.removeItem(META_STORAGE_KEY);
            return;
        }
        const map = getLocalMetaMap();
        const { total_yield_earned: _ignoredYield, ...safeStructuralMeta } = meta;
        map[id] = { ...(map[id] || {}), ...safeStructuralMeta };
        localStorage.setItem(META_STORAGE_KEY, JSON.stringify(map));
    };

    const enrichWithMeta = (items: any[]): Piggybank[] => {
        if (usePrivateTailscaleApi()) {
            localStorage.removeItem(META_STORAGE_KEY);
            return items as Piggybank[];
        }
        const metaMap = getLocalMetaMap();
        return items.map(item => ({
            ...metaMap[item.id_piggybank],
            ...item
        }));
    };

    const profileStore = useProfileStore();
    const vaultStore = useVaultStore();

    // Em modo real (fora do mock local sem rede), opera 100% na Arquitetura A (Dual-DB: busca do servidor privado https://somma-n8n.powan-bebop.ts.net:8787)
    const usePrivateTailscaleApi = () => {
        const isMock = import.meta.env.VITE_USE_MOCK === 'true' || import.meta.env.MODE === 'mock';
        if (isMock && !localStorage.getItem('somma_app_settings_v1')) return false;
        return Boolean(vaultStore.tailscaleBaseUrl);
    };

    const fetchPiggybanks = async () => {
        isLoading.value = true;
        try {
            if (!profileStore.userId) await profileStore.fetchProfileData();

            // Garante que o status do Tailscale foi verificado
            if (vaultStore.status === 'checking') {
                await vaultStore.checkTailscaleConnection();
            }

            // REGRA ZERO-TRUST (Arquitetura A):
            // Se o usuário NÃO estiver na rede Tailscale (ou ativou Stealth Mode),
            // limpamos os dados da memória RAM e NÃO fazemos requisição de patrimônio!
            if (!vaultStore.isVaultUnlocked) {
                piggybanks.value = [];
                return;
            }

            // Busca a taxa CDI/IPCA real no Banco Central antes de capitalizar os saldos
            await fetchBcbMarketRates();

            if (usePrivateTailscaleApi()) {
                const data = await vaultStore.vaultFetch('/api/vault/piggybanks');
                const list = Array.isArray(data) ? data : (data?.items || []);
                piggybanks.value = enrichWithMeta(list);
                return;
            }

            const { data, error } = await supabase
                .from('fin_piggybank')
                .select('*')
                .eq('user_id', profileStore.userId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            piggybanks.value = enrichWithMeta(data || []);

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
        if (!vaultStore.isVaultUnlocked) {
            throw new Error('Conecte-se à VPN Tailscale para criar ou alterar contas no Cofre.');
        }

        const todayStr = new Date().toISOString().slice(0, 10);
        const fullMeta: PiggybankMeta = {
            last_yield_date: todayStr,
            total_yield_earned: 0,
            ...meta
        };

        try {
            if (usePrivateTailscaleApi()) {
                const created = await vaultStore.vaultFetch('/api/vault/piggybanks', {
                    method: 'POST',
                    body: JSON.stringify({
                        user_id: profileStore.userId,
                        title,
                        target_amount,
                        composes_balance,
                        current_amount: initial_amount,
                        ...fullMeta
                    })
                });
                if (created) {
                    saveLocalMeta(created.id_piggybank, fullMeta);
                    piggybanks.value.push({ ...fullMeta, ...created });
                }
                return;
            }

            const { data, error } = await supabase
                .from('fin_piggybank')
                .insert([{
                    user_id: profileStore.userId,
                    title,
                    target_amount,
                    composes_balance,
                    current_amount: initial_amount,
                    ...fullMeta
                }])
                .select()
                .single();

            if (error) throw error;
            if (data) {
                saveLocalMeta(data.id_piggybank, fullMeta);
                piggybanks.value.push({ ...fullMeta, ...data });
            }
        } catch (error) {
            console.error('[PiggybankStore] Error creating piggybank:', error);
            throw error;
        }
    };
    
    const updatePiggybank = async (id: string, updates: Partial<Piggybank>) => {
        if (!vaultStore.isVaultUnlocked) {
            throw new Error('Conecte-se à VPN Tailscale para modificar cofrinhos.');
        }

        try {
            if (usePrivateTailscaleApi()) {
                await vaultStore.vaultFetch(`/api/vault/piggybanks/${id}`, {
                    method: 'PATCH',
                    body: JSON.stringify(updates)
                });
            } else {
                const { error } = await supabase
                    .from('fin_piggybank')
                    .update(updates)
                    .eq('id_piggybank', id);

                if (error) throw error;
            }

            const index = piggybanks.value.findIndex(p => p.id_piggybank === id);
            if (index !== -1) {
                const metaFields: PiggybankMeta = {};
                if (updates.bank_name !== undefined) metaFields.bank_name = updates.bank_name;
                if (updates.product_type !== undefined) metaFields.product_type = updates.product_type;
                if (updates.indexer !== undefined) metaFields.indexer = updates.indexer;
                if (updates.rate_value !== undefined) metaFields.rate_value = updates.rate_value;
                if (updates.liquidity !== undefined) metaFields.liquidity = updates.liquidity;
                if (updates.maturity_date !== undefined) metaFields.maturity_date = updates.maturity_date;
                if (updates.last_yield_date !== undefined) metaFields.last_yield_date = updates.last_yield_date;
                if (updates.total_yield_earned !== undefined) metaFields.total_yield_earned = updates.total_yield_earned;
                if (Object.keys(metaFields).length > 0) {
                    saveLocalMeta(id, metaFields);
                }
                piggybanks.value[index] = { ...piggybanks.value[index], ...updates } as Piggybank;
            }
        } catch (error) {
            console.error('Erro ao atualizar cofrinho:', error);
            throw error;
        }
    };

    const deletePiggybank = async (id: string) => {
        if (!vaultStore.isVaultUnlocked) {
            throw new Error('Conecte-se à VPN Tailscale para excluir cofrinhos.');
        }

        try {
            if (usePrivateTailscaleApi()) {
                await vaultStore.vaultFetch(`/api/vault/piggybanks/${id}`, {
                    method: 'DELETE'
                });
            } else {
                const { error } = await supabase
                    .from('fin_piggybank')
                    .delete()
                    .eq('id_piggybank', id);
                
                if (error) throw error;
            }

            piggybanks.value = piggybanks.value.filter(p => p.id_piggybank !== id);
        } catch (error) {
            console.error('Erro ao excluir cofrinho:', error);
            throw error;
        }
    };

    const getAvailableToDeposit = async () => {
        if (!vaultStore.isVaultUnlocked) return 0;
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
        if (!vaultStore.isVaultUnlocked) {
            throw new Error('Conecte-se à VPN Tailscale para movimentar valores do Cofre.');
        }

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

            if (usePrivateTailscaleApi()) {
                await vaultStore.vaultFetch(`/api/vault/piggybanks/${id_piggybank}/transactions`, {
                    method: 'POST',
                    body: JSON.stringify({
                        piggybank_id: id_piggybank,
                        user_id: profileStore.userId,
                        transaction_type: type,
                        amount
                    })
                });
            } else {
                const { error: txError } = await supabase
                    .from('fin_piggybank_transaction')
                    .insert([{
                        piggybank_id: id_piggybank,
                        user_id: profileStore.userId,
                        transaction_type: type,
                        amount
                    }]);
                    
                if (txError) throw txError;
            }

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
