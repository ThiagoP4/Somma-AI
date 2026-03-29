<script setup lang="ts">
    import { ref, onMounted } from 'vue';
    import { supabase } from '../services/supabase';
    import { useAlertStore } from '../stores/useAlertStore';

    const alertStore = useAlertStore();

    const userName = ref('');
    const userEmail = ref('');
    const userCpf = ref('');
    const userPhone = ref('');
    const userSecondPhone = ref('');
    const userPassword = ref('');
    const avatarUrl = ref('');
    const isUploading = ref(false);
    const fileInput = ref<HTMLInputElement | null>(null);

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
                userSecondPhone.value = profileData.second_phone;
                avatarUrl.value = profileData.avatar_url;
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

    const triggerFileInput = () => {
        if(!isUploading.value) fileInput.value?.click();
    };

    const handleFileUpload = async (event: Event) => {
        const input = event.target as HTMLInputElement;
        if(!input.files || input.files.length === 0) return;

        const file = input.files[0];
        if(!file) return;

        const fileExt = file.name.split('.').pop();
        const { data: authData } = await supabase.auth.getUser();
        if(!authData.user) return;

        const filePath = `${authData.user.id}/avatar-${Date.now()}.${fileExt}`;

        isUploading.value = true;
        alertStore.showAlert('Enviando nova imagem para a nuvem...', 'warning');

        try {
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file, { upsert: true });

            if(uploadError) {
                alertStore.showAlert('Erro ao enviar imagem: ' + uploadError.message, 'error');
                return;
            }

            const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
            avatarUrl.value = data.publicUrl;

            const { error: profileError } = await supabase
                .from('usr_profile')
                .update({ avatar_url: avatarUrl.value })
                .eq('id_profile', authData.user.id);

            if(profileError) throw profileError;

            alertStore.showAlert('Imagem atualizada com sucesso!', 'success');
        } catch (error: any) {
            console.error('Falha de Comunicação / Script Code Failure:', error);
            alertStore.showAlert('Erro ao atualizar perfil: ' + error.message, 'error');
        } finally {
            isUploading.value = false;
        }

    }

    const savePersonalData = async () => {
        const { data: authData } = await supabase.auth.getUser();
        if(!authData.user) {
             console.error("Erro: Nenhum usuário autenticado detectado no momento do salvamento.");
             return;
        }

        const currentEmail = authData.user.email || '';

        try {
            let authUpdates: any = {};
            
            if (userEmail.value.trim() !== '' && userEmail.value !== currentEmail) {
                authUpdates.email = userEmail.value;
            }

            // Tenta atualizar a tabela Secundária de Segurança apenas se os campos existirem no authUpdates
            if (Object.keys(authUpdates).length > 0) {
                console.log("Enviando atualização para a Central de Segurança (Auth):", authUpdates);
                const { error: authError } = await supabase.auth.updateUser(authUpdates);

                // Se O Telefone do cara for um caracter que o Supabase odeia, o supabase vai retornar um AuthError como FormatInvalid.
                if (authError) {
                    console.error('Erro de Autenticação:', authError);
                    alertStore.showAlert('Falha ao tentar mudar E-mail ou Telefone: ' + authError.message, 'error');
                    return; // Aborta e impede de salvar Nome e CPF pra frente.
                }
            } else {
                 console.log("O Email e Telefone não mudaram em comparação aos do servidor. Pulando auth.updateUser()...");
            }

            // 2. Sempre tenta atualizar Nome e CPF na Tabela Principal Livre
            const { error: profileError } = await supabase
                .from('usr_profile')
                .upsert({
                    id_profile: authData.user.id,
                    first_name: userName.value.split(' ')[0] || '',
                    last_name: userName.value.split(' ').slice(1).join(' ') || '',
                    cpf: userCpf.value,
                    second_phone: userSecondPhone.value,
                    avatar_url: avatarUrl.value,
                    role_id: 1, 
                    updated_at: new Date().toISOString()
                });
            
            if(!profileError) {
                alertStore.showAlert('Perfil salvo com sucesso!', 'success');
            } else {
                 console.error('Erro Inesperado na Tabela Perfil (Supabase BD):', profileError);
                 alertStore.showAlert('Ocorreu um erro técnico ao atualizar seus dados. Tente novamente mais tarde.', 'error');
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
                <div class="avatar-placeholder" :class="{'uploading': isUploading}">
                    <img v-if="avatarUrl" :src="avatarUrl" alt="Foto de Perfil" class="custom-avatar-img">
                    <svg v-else xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <input type="file" accept="image/png, image/jpeg, image/webp" hidden ref="fileInput" @change="handleFileUpload">
                <button type="button" class="avatar-edit-btn" title="Alterar foto" @click="triggerFileInput" :disabled="isUploading">
                     <svg v-if="!isUploading" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    <svg v-else class="spin-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" 
                    fill="none" stroke="currentColor" stroke-width="2" 
                    stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="2" x2="12" y2="6"></line>
                    <line x1="12" y1="18" x2="12" y2="22"></line>
                    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                    <line x1="2" y1="12" x2="6" y2="12"></line>
                    <line x1="18" y1="12" x2="22" y2="12"></line>
                    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                    <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                    </svg>
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
                        <div class="profile-card-content-item full-width">
                            <label for="cpf">CPF</label>
                            <input type="text" id="cpf" v-model="userCpf">
                        </div>
                        <div class="profile-card-content-item">
                            <label for="phone">Telefone Principal</label>
                            <input type="tel" id="phone" v-model="userPhone" disabled title="Gerenciado pelo provedor de segurança.">
                        </div>
                        <div class="profile-card-content-item">
                            <label for="second_phone">Telefone Adicional</label>
                            <input type="tel" id="second_phone" v-model="userSecondPhone" placeholder="(XX) 99999-9999">
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
        padding: 0.75rem;
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

    .custom-avatar-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 1.5rem;
    }

    .avatar-placeholder.uploading {
        opacity: 0.5;
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

    .avatar-edit-btn:disabled {
        cursor: not-allowed;
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

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    .spin-icon {
        animation: spin 1s linear infinite;
    }

</style>