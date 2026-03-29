import { defineStore } from 'pinia';
import { supabase } from '../services/supabase';

export const useProfileStore = defineStore('profile', {
    // 1. A Memória Pura (State)
    state: () => ({
        userId: '',
        userName: '',
        userEmail: '',
        userCpf: '',
        userPhone: '',
        userSecondPhone: '',
        avatarUrl: '',
        myCards: [] as any[],
        isLoadingProfile: false,
    }),

    // 2. Os Músculos (Ações que falam direto com o Banco de Dados)
    actions: {
        async fetchProfileData() {
            this.isLoadingProfile = true;
            try {
                // Passo 1: Pegar da Auth (Segurança)
                const { data: authData } = await supabase.auth.getUser();
                if (!authData.user) return;

                this.userId = authData.user.id;
                this.userEmail = authData.user.email || '';
                this.userPhone = authData.user.phone || '';

                // Passo 2: Pegar da tabela customizada
                const { data: profileData } = await supabase
                    .from('usr_profile')
                    .select('*')
                    .eq('id_profile', this.userId)
                    .single();

                if (profileData) {
                    this.userName = (profileData.first_name + ' ' + (profileData.last_name || '')).trim();
                    this.userCpf = profileData.cpf || '';
                    this.userSecondPhone = profileData.second_phone || '';
                    this.avatarUrl = profileData.avatar_url || '';
                }

                // Passo 3: Pegar os Pagamentos
                const { data: cardsData } = await supabase
                    .from('usr_payment')
                    .select('*')
                    .eq('user_id', this.userId);

                if (cardsData) this.myCards = cardsData;

            } catch (error) {
                console.error('Erro ao montar o Dashboard Central de Perfil:', error);
            } finally {
                this.isLoadingProfile = false;
            }
        }
    }
});
