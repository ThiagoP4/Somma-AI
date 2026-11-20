import { defineStore } from 'pinia';
import { ref } from 'vue';
import { supabase } from '../services/supabase';
import { useProfileStore } from './useProfileStore';
import { useVaultStore } from './useVaultStore';

export interface Piggybank {
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

            if (usePrivateTailscaleApi()) {
                const data = await vaultStore.vaultFetch('/api/vault/piggybanks');
                piggybanks.value = Array.isArray(data) ? data : (data?.items || []);
                return;
            }

            const { data, error } = await supabase
                .from('fin_piggybank')
                .select('*')
                .eq('user_id', profileStore.userId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            piggybanks.value = data || [];

        } catch (error) {
            console.error('[PiggybankStore] Error fetching piggybanks:', error);
            piggybanks.value = [];
        } finally {
            isLoading.value = false;
        }
    };

    const createPiggybank = async (title: string, target_amount: number, composes_balance: boolean) => {
        if (!vaultStore.isVaultUnlocked) {
            throw new Error('Conecte-se à VPN Tailscale para criar ou alterar cofrinhos no Cofre.');
        }

        try {
            if (usePrivateTailscaleApi()) {
                const created = await vaultStore.vaultFetch('/api/vault/piggybanks', {
                    method: 'POST',
                    body: JSON.stringify({
                        user_id: profileStore.userId,
                        title,
                        target_amount,
                        composes_balance,
                        current_amount: 0
                    })
                });
                if (created) piggybanks.value.push(created);
                return;
            }

            const { data, error } = await supabase
                .from('fin_piggybank')
                .insert([{
                    user_id: profileStore.userId,
                    title,
                    target_amount,
                    composes_balance,
                    current_amount: 0
                }])
                .select()
                .single();

            if (error) throw error;
            if (data) piggybanks.value.push(data);
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
            const totalAlreadySaved = piggybanks.value.reduce((acc: number, curr: Piggybank) => acc + Number(curr.current_amount), 0);
            
            return totalIncomes - totalAlreadySaved;
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
                const totalAlreadySaved = piggybanks.value.reduce((acc: number, curr: Piggybank) => acc + Number(curr.current_amount), 0);
                const maxAvailable = totalIncomes - totalAlreadySaved;

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
        fetchPiggybanks,
        createPiggybank,
        updatePiggybank,
        deletePiggybank,
        addTransaction,
        getAvailableToDeposit
    };
});
