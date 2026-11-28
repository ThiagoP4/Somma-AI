import { defineStore } from 'pinia';
import { ref } from 'vue';
import { supabase } from '../services/supabase';
import { useProfileStore } from './useProfileStore';

export type AssetClass = 'ACAO' | 'FII' | 'ETF' | 'CRIPTO' | 'BDR';

export interface VariableAsset {
    id_asset: string;
    user_id: string;
    ticker: string;
    name?: string | null;
    asset_class: AssetClass;
    broker?: string | null;
    quantity: number;
    average_price: number;
    current_price: number;
    currency?: string;
    last_dividend_per_share?: number | null;
    last_dividend_date?: string | null;
    staking_apy?: number | null;
    last_price_sync?: string | null;
    created_at?: string;
}

const MOCK_ASSETS_KEY = 'somma_mock_variable_assets_v1';

const DEFAULT_MOCK_ASSETS: VariableAsset[] = [
    {
        id_asset: 'mock-asset-1',
        user_id: 'mock-user-123',
        ticker: 'MXRF11',
        name: 'Maxi Renda FII',
        asset_class: 'FII',
        broker: 'Banco Inter',
        quantity: 120,
        average_price: 9.85,
        current_price: 10.12,
        currency: 'BRL'
    },
    {
        id_asset: 'mock-asset-2',
        user_id: 'mock-user-123',
        ticker: 'PETR4',
        name: 'Petrobras PN',
        asset_class: 'ACAO',
        broker: 'XP Investimentos',
        quantity: 45,
        average_price: 34.20,
        current_price: 38.60,
        currency: 'BRL'
    },
    {
        id_asset: 'mock-asset-3',
        user_id: 'mock-user-123',
        ticker: 'IVVB11',
        name: 'iShares S&P 500 ETF',
        asset_class: 'ETF',
        broker: 'BTG Pactual',
        quantity: 6,
        average_price: 315.00,
        current_price: 368.40,
        currency: 'BRL'
    },
    {
        id_asset: 'mock-asset-4',
        user_id: 'mock-user-123',
        ticker: 'BTC',
        name: 'Bitcoin',
        asset_class: 'CRIPTO',
        broker: 'Binance',
        quantity: 0.0085,
        average_price: 340000,
        current_price: 515000,
        currency: 'BRL'
    }
];

export const useAssetsStore = defineStore('variableAssets', () => {
    const assets = ref<VariableAsset[]>([]);
    const isLoading = ref(false);
    const isSyncingQuotes = ref(false);

    const profileStore = useProfileStore();

    const isMock = import.meta.env.VITE_USE_MOCK === 'true' || import.meta.env.MODE === 'mock';

    const getLocalAssetsStorageKey = () =>
        profileStore.userId ? `somma_variable_assets_${profileStore.userId}` : MOCK_ASSETS_KEY;

    const loadLocalAssets = (): VariableAsset[] => {
        try {
            const userKey = getLocalAssetsStorageKey();
            const raw = localStorage.getItem(userKey);
            if (raw) return JSON.parse(raw);

            // Migra automaticamente ativos salvos na chave antiga antes da unificação (ex: MXRF11 e USDT)
            const legacyRaw = localStorage.getItem(MOCK_ASSETS_KEY);
            if (legacyRaw) {
                const parsed = JSON.parse(legacyRaw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    localStorage.setItem(userKey, JSON.stringify(parsed));
                    return parsed;
                }
            }
        } catch {
            // fallback
        }
        return isMock ? [...DEFAULT_MOCK_ASSETS] : [];
    };

    const saveLocalAssets = (list: VariableAsset[]) => {
        localStorage.setItem(getLocalAssetsStorageKey(), JSON.stringify(list));
    };

    // Busca cotação ao vivo (Cripto via Binance BRL)
    const fetchLiveQuote = async (
        ticker: string,
        assetClass: AssetClass
    ): Promise<{
        price: number;
        name?: string | null;
        last_dividend_per_share?: number | null;
        last_dividend_date?: string | null;
        source: string;
    } | null> => {
        const cleanTicker = ticker.trim().toUpperCase();
        if (!cleanTicker) return null;

        if (assetClass === 'CRIPTO') {
            try {
                const pair = cleanTicker.endsWith('BRL') ? cleanTicker : `${cleanTicker}BRL`;
                const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${pair}`);
                if (res.ok) {
                    const data = await res.json();
                    const price = parseFloat(data?.price);
                    if (!Number.isNaN(price) && price > 0) {
                        return { price, source: 'binance-brl', last_dividend_per_share: null, last_dividend_date: null };
                    }
                }
            } catch {
                // ignora
            }
        }

        return null;
    };

    // Calcula automaticamente o provento estimado do ativo (B3: Qtd x Último Dividendo/Cota; Cripto: Posição x APY Staking / 12)
    const getEstimatedProventoBrl = (asset: VariableAsset): number => {
        const qty = Number(asset.quantity || 0);
        if (qty <= 0) return 0;

        if (asset.asset_class === 'CRIPTO') {
            const apy = Number(asset.staking_apy || 0);
            if (apy <= 0) return 0;
            const posVal = qty * Number(asset.current_price || 0);
            return Math.round(((posVal * (apy / 100)) / 12) * 100) / 100;
        }

        const divPerShare = Number(asset.last_dividend_per_share || 0);
        if (divPerShare <= 0) return 0;
        return Math.round(qty * divPerShare * 100) / 100;
    };

    const ASSET_ROW_PREFIX = '[ASSET]';

    const encodeAssetToPiggyRow = (asset: Omit<VariableAsset, 'id_asset' | 'created_at'>, userId: string) => {
        const metaPayload = {
            ticker: asset.ticker.trim().toUpperCase(),
            name: asset.name || null,
            asset_class: asset.asset_class || 'ACAO',
            broker: asset.broker || null,
            quantity: Number(asset.quantity) || 0,
            average_price: Number(asset.average_price) || 0,
            current_price: Number(asset.current_price) || Number(asset.average_price) || 0,
            currency: asset.currency || 'BRL',
            last_dividend_per_share: asset.last_dividend_per_share ?? null,
            last_dividend_date: asset.last_dividend_date ?? null,
            staking_apy: asset.staking_apy ?? null
        };
        const currentTotalBrl = Math.round(metaPayload.quantity * metaPayload.current_price * 100) / 100;
        const costTotalBrl = Math.round(metaPayload.quantity * metaPayload.average_price * 100) / 100;

        return {
            user_id: userId,
            title: `${ASSET_ROW_PREFIX} ${JSON.stringify(metaPayload)}`,
            current_amount: currentTotalBrl,
            target_amount: costTotalBrl,
            composes_balance: false
        };
    };

    const decodePiggyRowToAsset = (row: any): VariableAsset | null => {
        const rawTitle = String(row?.title || '');
        if (!rawTitle.startsWith(ASSET_ROW_PREFIX)) return null;
        try {
            const jsonPart = rawTitle.slice(ASSET_ROW_PREFIX.length).trim();
            const parsed = JSON.parse(jsonPart);
            return {
                id_asset: String(row.id_piggybank),
                user_id: String(row.user_id),
                ticker: String(parsed.ticker || '').toUpperCase(),
                name: parsed.name || null,
                asset_class: (parsed.asset_class || 'ACAO') as AssetClass,
                broker: parsed.broker || null,
                quantity: Number(parsed.quantity) || 0,
                average_price: Number(parsed.average_price) || 0,
                current_price: Number(parsed.current_price) || 0,
                currency: parsed.currency || 'BRL',
                last_dividend_per_share: parsed.last_dividend_per_share ?? null,
                last_dividend_date: parsed.last_dividend_date ?? null,
                staking_apy: parsed.staking_apy ?? null,
                created_at: row.created_at
            };
        } catch {
            return null;
        }
    };

    const fetchAssets = async () => {
        isLoading.value = true;
        try {
            if (!profileStore.userId) await profileStore.fetchProfileData();
            if (isMock) {
                assets.value = loadLocalAssets();
                return;
            }

            const { data, error } = await supabase
                .from('fin_piggybank')
                .select('*')
                .eq('user_id', profileStore.userId)
                .like('title', `${ASSET_ROW_PREFIX}%`)
                .order('created_at', { ascending: true });

            if (error) throw error;

            const cloudAssets = (data || [])
                .map(decodePiggyRowToAsset)
                .filter((a): a is VariableAsset => a !== null);

            // Se ainda não houver ativos no Supabase, verifica se há ativos no cache local do aparelho e migra para a nuvem
            if (cloudAssets.length === 0 && profileStore.userId) {
                const localOnes = loadLocalAssets();
                if (localOnes.length > 0) {
                    const migrated: VariableAsset[] = [];
                    for (const item of localOnes) {
                        const rowToInsert = encodeAssetToPiggyRow(item, profileStore.userId);
                        const { data: inserted } = await supabase
                            .from('fin_piggybank')
                            .insert([rowToInsert])
                            .select()
                            .single();
                        const decoded = inserted ? decodePiggyRowToAsset(inserted) : null;
                        if (decoded) migrated.push(decoded);
                    }
                    if (migrated.length > 0) {
                        assets.value = migrated;
                        saveLocalAssets(migrated);
                        return;
                    }
                }
            }

            assets.value = cloudAssets;
            saveLocalAssets(cloudAssets);
        } catch (error) {
            console.error('[AssetsStore] Erro ao carregar ativos:', error);
            assets.value = loadLocalAssets();
        } finally {
            isLoading.value = false;
        }
    };

    const createAsset = async (payload: Omit<VariableAsset, 'id_asset' | 'user_id' | 'created_at'>) => {
        if (!profileStore.userId) await profileStore.fetchProfileData();
        const cleanPayload = {
            ...payload,
            user_id: profileStore.userId || 'mock-user-123',
            ticker: payload.ticker.trim().toUpperCase(),
            quantity: Number(payload.quantity) || 0,
            average_price: Number(payload.average_price) || 0,
            current_price: Number(payload.current_price) || Number(payload.average_price) || 0
        };

        if (!isMock && profileStore.userId) {
            const rowPayload = encodeAssetToPiggyRow(cleanPayload, profileStore.userId);
            const { data, error } = await supabase
                .from('fin_piggybank')
                .insert([rowPayload])
                .select()
                .single();

            if (error) throw error;
            const created = decodePiggyRowToAsset(data);
            if (created) {
                assets.value.push(created);
                saveLocalAssets(assets.value);
                return created;
            }
        }

        const newItem: VariableAsset = {
            ...cleanPayload,
            id_asset: `asset-${Date.now()}`,
            created_at: new Date().toISOString()
        };
        assets.value.push(newItem);
        saveLocalAssets(assets.value);
        return newItem;
    };

    const updateAsset = async (id: string, updates: Partial<VariableAsset>) => {
        const idx = assets.value.findIndex(a => a.id_asset === id);
        if (idx === -1) return null;

        const merged = { ...assets.value[idx], ...updates } as VariableAsset;

        if (!isMock && profileStore.userId && !id.startsWith('mock-') && !id.startsWith('asset-')) {
            const rowPayload = encodeAssetToPiggyRow(merged, profileStore.userId);
            const { error } = await supabase
                .from('fin_piggybank')
                .update(rowPayload)
                .eq('id_piggybank', id)
                .eq('user_id', profileStore.userId);

            if (error) throw error;
        }

        assets.value[idx] = merged;
        saveLocalAssets(assets.value);
        return merged;
    };

    const deleteAsset = async (id: string) => {
        if (!isMock && profileStore.userId && !id.startsWith('mock-') && !id.startsWith('asset-')) {
            const { error } = await supabase
                .from('fin_piggybank')
                .delete()
                .eq('id_piggybank', id)
                .eq('user_id', profileStore.userId);

            if (error) throw error;
        }

        assets.value = assets.value.filter(a => a.id_asset !== id);
        saveLocalAssets(assets.value);
    };

    const syncAllLivePrices = async (): Promise<{ updatedCount: number; failedCount: number }> => {
        if (assets.value.length === 0) {
            return { updatedCount: 0, failedCount: 0 };
        }

        isSyncingQuotes.value = true;
        let updatedCount = 0;
        let failedCount = 0;

        try {
            for (const asset of assets.value) {
                const quote = await fetchLiveQuote(asset.ticker, asset.asset_class);
                if (quote && quote.price > 0) {
                    await updateAsset(asset.id_asset, {
                        current_price: quote.price,
                        ...(quote.name && !asset.name ? { name: quote.name } : {}),
                        ...(quote.last_dividend_per_share !== undefined && quote.last_dividend_per_share !== null
                            ? {
                                last_dividend_per_share: quote.last_dividend_per_share,
                                last_dividend_date: quote.last_dividend_date || null
                              }
                            : {})
                    });
                    updatedCount++;
                } else {
                    failedCount++;
                }
            }
        } finally {
            isSyncingQuotes.value = false;
        }

        return { updatedCount, failedCount };
    };

    // Lançamento de 1 clique de Dividendos / JCP / Rendimentos de FII direto em Registros -> Entradas (Proventos)
    const registerDividendToProventos = async (asset: VariableAsset, amount: number) => {
        const cleanVal = Math.round(Number(amount) * 100) / 100;
        if (cleanVal < 0.01) return null;

        if (!profileStore.userId) await profileStore.fetchProfileData();
        const userId = profileStore.userId;
        if (!userId) return null;

        const { data: categories } = await supabase
            .from('fin_category')
            .select('*')
            .eq('type', 'receita');

        let proventosCat = (categories || []).find((c: any) =>
            /provento|dividendo/i.test(String(c.description || ''))
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
        const firstDay = `${year}-${month}-01`;
        const lastDay = `${year}-${month}-${String(new Date(year, now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;

        const labelPrefix = asset.asset_class === 'FII'
            ? 'Rendimento FII'
            : (asset.asset_class === 'CRIPTO' ? 'Staking / Earn' : 'Dividendo');
        const entryTitle = `${labelPrefix} • ${asset.ticker}`;

        const { data: existingIncomes } = await supabase
            .from('fin_income')
            .select('*')
            .eq('user_id', userId)
            .gte('date', firstDay)
            .lte('date', lastDay);

        const existing = (existingIncomes || []).find((inc: any) =>
            String(inc.title || '').trim().toLowerCase() === entryTitle.toLowerCase()
        );

        if (existing) {
            const totalMonth = Math.round((Number(existing.value || 0) + cleanVal) * 100) / 100;
            const { error } = await supabase
                .from('fin_income')
                .update({ value: totalMonth, date: todayStr, ...(categoryId ? { categoryId } : {}) })
                .eq('idIncome', existing.idIncome);
            if (error) throw error;
            return { title: entryTitle, totalMonthValue: totalMonth };
        } else {
            const { error } = await supabase
                .from('fin_income')
                .insert({
                    title: entryTitle,
                    value: cleanVal,
                    categoryId,
                    date: todayStr,
                    user_id: userId
                });
            if (error) throw error;
            return { title: entryTitle, totalMonthValue: cleanVal };
        }
    };

    return {
        assets,
        isLoading,
        isSyncingQuotes,
        fetchLiveQuote,
        getEstimatedProventoBrl,
        fetchAssets,
        createAsset,
        updateAsset,
        deleteAsset,
        syncAllLivePrices,
        registerDividendToProventos
    };
});
