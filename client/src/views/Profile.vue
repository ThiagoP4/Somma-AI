<script setup lang="ts">
    import { ref, onMounted } from 'vue';
    import { supabase } from '../services/supabase';

    const userName = ref('');
    const userEmail = ref('');
    const userCpf = ref('');
    const userPhone = ref('');
    const userPassword = ref('');

    const myCards = ref<any[]>([]);

    onMounted(async () => {
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData.user?.id;

        if (userId) {
            userEmail.value = authData.user?.email || '';
            userPhone.value = authData.user?.phone || '';

            const { data: profileData, error: profileError } = await supabase
                .from('usr_profile')
                .select('*')
                .eq('id_profile', userId)
                .single();
            
            if (profileData && !profileError) {
                userName.value = profileData.first_name + ' ' + profileData.last_name;
                userCpf.value = profileData.cpf;
            }

            const { data: cardsData, error: cardsError } = await supabase
                .from('usr_payment')
                .select('*')
                .eq('user_id', userId);
            
            if (cardsData && !cardsError) {
                myCards.value = cardsData;
            }
        }
    });

    const savePersonalData = async () => {
        console.log("Iniciando savePersonalData...");
        const { data: authData } = await supabase.auth.getUser();
        if(!authData.user) {
             console.error("Erro: Nenhum usuário autenticado detectado no momento do salvamento.");
             return;
        }

        // Tratando null/undefined que vêm da Auth como strings vazias.
        const currentEmail = authData.user.email || '';
        const currentPhone = authData.user.phone || '';

        try {
            let authUpdates: any = {};
            
            // 1. Verificamos pacotes válidos. Só atualiza Auth se os novos valores diferirem dos atuais no Supabase
            if (userEmail.value.trim() !== '' && userEmail.value !== currentEmail) {
                authUpdates.email = userEmail.value;
            }
            if (userPhone.value !== currentPhone) {
                authUpdates.phone = userPhone.value;
            } 

            // Tenta atualizar a tabela Secundária de Segurança apenas se os campos existirem no authUpdates
            if (Object.keys(authUpdates).length > 0) {
                console.log("Enviando atualização para a Central de Segurança (Auth):", authUpdates);
                const { error: authError } = await supabase.auth.updateUser(authUpdates);

                // Se O Telefone do cara for um caracter que o Supabase odeia, o supabase vai retornar um AuthError como FormatInvalid.
                if (authError) {
                    console.error('Erro de Autenticação:', authError);
                    alert('Falha ao tentar mudar seu E-mail ou Telefone: ' + authError.message);
                    return; // Aborta e impede de salvar Nome e CPF pra frente.
                }
            } else {
                 console.log("O Email e Telefone não mudaram em comparação aos do servidor. Pulando auth.updateUser()...");
            }

            // 2. Sempre tenta atualizar Nome e CPF na Tabela Principal Livre
            console.log("Iniciando Upsert Perfil (usr_profile)...");
            const { error: profileError } = await supabase
                .from('usr_profile')
                .upsert({
                    id_profile: authData.user.id,
                    first_name: userName.value.split(' ')[0] || '',
                    last_name: userName.value.split(' ').slice(1).join(' ') || '',
                    cpf: userCpf.value,
                    role_id: 1, 
                    updated_at: new Date().toISOString()
                });
            
            if(!profileError) {
                console.log("Operação Finalizada Total!");
                alert('✅ Seu perfil foi salvo por completo com sucesso! (Se alterou o e-mail verifique a confirmação em breve)');
            } else {
                 console.error('Erro Inesperado na Tabela Perfil (Supabase BD):', profileError);
                 alert('Aconteceu um erro técnico ao atualizar seu Nome/CPF. Tente novamente mais tarde.');
            }
        } catch (error) {
            console.error('Falha de Comunicação / Script Code Failure:', error);
        }
    };

</script>

<template>
    <div class="page-container">
        <div class="profile-header-card">
            <div class="avatar-wrapper">
                <div class="avatar-placeholder">
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <button type="button" class="avatar-edit-btn" title="Alterar foto">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                </button>
            </div>
            
            <div class="user-intro">
                <h2>{{ userName || 'Usuário Não Configurado' }}</h2>
                <p>{{ userEmail || 'Carregando infos da auth...' }}</p>
            </div>
        </div>

        <div class="profile-dashboard-grid">
            <div class="profile-card">
                <h2>Dados Pessoais</h2>
                <form class="profile-card-content" @submit.prevent="savePersonalData">
                    <div class="form-grid">
                        <div class="profile-card-content-item full-width">
                            <label for="name">Nome Completo</label>
                            <input type="text" id="name" v-model="userName">
                        </div>
                        <div class="profile-card-content-item full-width">
                            <label for="email">E-mail</label>
                            <input type="email" id="email" v-model="userEmail" placeholder="Digite seu novo E-mail de login">
                        </div>
                        <div class="profile-card-content-item">
                            <label for="cpf">CPF</label>
                            <input type="text" id="cpf" v-model="userCpf">
                        </div>
                        <div class="profile-card-content-item">
                            <label for="phone">Telefone</label>
                            <input type="tel" id="phone" v-model="userPhone" placeholder="(XX) 99999-9999">
                        </div>
                        <div class="profile-card-content-item full-width">
                            <label for="password">Senha</label>
                            <input type="password" id="password" v-model="userPassword" placeholder="Digite sua nova senha">
                        </div>
                    </div>
                    <button class="btn-apply" type="submit">Salvar Dados</button>
                </form>
            </div>

            <div class="column-stack">
                <div class="profile-card">
                    <h2>Metas Financeiras</h2>
                    <div class="profile-card-content">
                        <div class="profile-card-content-item">
                            <label for="monthlyIncome">Minhas metas</label>
                            <input type="number" id="monthlyIncome">
                        </div>
                        <button class="btn-apply" type="button" @click="">Salvar Meta</button>
                    </div>
                </div>

                <div class="profile-card">
                    <div class="card-header-actions">
                        <h2>Meus Pagamentos</h2>
                        <button class="btn-secondary" type="button" @click="">+ Adicionar</button>
                    </div>
                    <div class="profile-card-content">
                        <div v-for="card in myCards" :key="card.idCard" class="profile-card-content-item">
                                <p class="card-name">{{ card.nickname }}</p>
                                <span class="card-type">{{ card.method_type }}</span>
                        </div>
                        <div v-if="myCards.length === 0" class="empty-state">
                                <p>Nenhum método de pagamento cadastrado</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

    </div>
    
</template>


<style scoped>

    .page-container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 2rem;
        color: var(--text-primary);
    }

    .form-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 1.5rem;
        width: 100%;
    }

    .page-header {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        margin-bottom: 2rem;
    }

    .page-header h1 {
        color: var(--text-primary);
        font-size: 2.5rem;
        margin-bottom: 0.5rem;
    }

    .page-header p {
        color: var(--text-secondary);
        margin: 0;
    }

    .profile-card {
        background: var(--bg-card);
        border-radius: 1rem;
        padding: 2rem;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .profile-card h2 {
        color: var(--text-primary);
        margin-bottom: 1rem;
        font-size: 1.25rem;
    }

     .profile-card-content {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .profile-card-content .btn-apply,
    .profile-card-content .btn-secondary {
        align-self: flex-start;
    }

    :focus-visible {
        outline: 2px solid var(--primary-color);
        outline-offset: 4px; /* Afasta o contorno do botão */
        border-radius: 4px;
    }
    
    .profile-card-content-item {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    .profile-card-content-item label {
        font-size: 0.85rem;
        font-weight: 500;
        color: var(--text-secondary);
    }
    .profile-card-content-item input {
        background: transparent;
        border: 1px solid var(--border-color);
        color: var(--text-primary);
        padding: 0.8rem;
        border-radius: 6px;
        font-size: 1rem;
        transition: border-color 0.2s;
    }
    .profile-card-content-item input:focus {
        border-color: var(--primary-color);
        outline: none;
    }
    .profile-card-content-item input:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
    .card-header-actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem; 
    }
    
    .card-header-actions h2 {
        margin-bottom: 0; 
    }

    .card-name { font-weight: bold; margin: 0; color: var(--text-primary);}
    .card-type { color: var(--text-secondary); font-size: 0.9rem; }
    .empty-state { text-align: center; color: var(--text-secondary); padding: 2rem 0; }


    @media (min-width: 768px) {
        .form-grid {
            grid-template-columns: 1fr 1fr;
        }
        .full-width {
            grid-column: 1 / -1; /* Ocupa todas as colunas da linha */
        }
    }

    /* Layout do Dashboard */
    .profile-dashboard-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 2rem;
        align-items: start;
    }

    .column-stack {
        display: flex;
        flex-direction: column;
        gap: 2rem;
    }

    @media (min-width: 1024px) {
        .profile-dashboard-grid {
            grid-template-columns: 3fr 2fr;
        }
    }

    /* Avatar e Introdução do Usuário */
    .profile-header-card {
        background: var(--bg-card);
        border-radius: 1rem;
        padding: 2rem;
        margin-bottom: 2rem;
        display: flex;
        align-items: center;
        gap: 1.5rem;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .avatar-wrapper {
        position: relative;
        display: inline-block;
    }

    .avatar-placeholder {
        width: 80px;
        height: 80px;
        background: var(--bg-input); 
        border-radius: 1.25rem; 
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--primary-color);
    }

    .avatar-edit-btn {
        position: absolute;
        bottom: -8px;
        right: -8px;
        background: var(--primary-color); /* Na imagem de referencia era Roxo, aqui aplicará a cor tema global Laranja/Vermelha */
        border: 4px solid var(--bg-card); /* Esse border faz aquele recorte lindissimo no botão da câmera para ele não colar na foto */
        color: var(--text-inverse, #fff); 
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: transform 0.2s, filter 0.2s;
        padding: 0;
    }

    .avatar-edit-btn:hover {
        transform: scale(1.05);
        filter: brightness(1.1);
    }

    .user-intro h2 {
        color: var(--text-primary);
        font-size: 1.5rem;
        margin: 0 0 0.5rem 0;
        font-weight: 600;
    }

    .user-intro p {
        color: var(--text-secondary);
        margin: 0;
        font-size: 1rem;
    }

</style>