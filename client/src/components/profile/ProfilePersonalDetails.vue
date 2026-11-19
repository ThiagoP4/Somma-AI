<script setup lang="ts">
import { PhUser, PhFloppyDisk } from '@phosphor-icons/vue';
import { supabase } from '../../services/supabase';
import { useAlertStore } from '../../stores/useAlertStore';
import { useProfileStore } from '../../stores/useProfileStore';

const alertStore = useAlertStore();
const profileStore = useProfileStore();

const applyCpfMask = () => {
    let v = profileStore.userCpf?.replace(/\D/g, '') || '';
    if (v.length > 11) v = v.slice(0, 11);
    
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    
    profileStore.userCpf = v;
};

const applyPhoneMask = () => {
    let v = profileStore.userSecondPhone?.replace(/\D/g, '') || '';
    if (v.length > 11) v = v.slice(0, 11);
    
    if (v.length > 2) {
        v = v.replace(/^(\d{2})(\d)/g, '($1) $2');
        v = v.replace(/(\d)(\d{4})$/, '$1-$2');
    }
    
    profileStore.userSecondPhone = v;
};

const savePersonalData = async () => {
    alertStore.showAlert('Salvando seus dados...', 'warning');
    try {
        const { error: authError } = await supabase.auth.updateUser({
            email: profileStore.userEmail,
        });
        
        if (authError) throw authError;

        const { error: dbError } = await supabase
            .from('usr_profile')
            .upsert({
                id_profile: profileStore.userId,
                cpf: profileStore.userCpf,
                first_name: profileStore.userName.split(' ')[0] || '',
                last_name: profileStore.userName.split(' ').slice(1).join(' ') || '',
                second_phone: profileStore.userSecondPhone,
                avatar_url: profileStore.avatarUrl, 
                role_id: 1, 
                updated_at: new Date().toISOString()
            });

        if (dbError) throw dbError;

        alertStore.showAlert('Dados Pessoais salvos com sucesso!', 'success');
    } catch (error: any) {
        console.error('Erro ao salvar dados pessoais:', error);
        alertStore.showAlert('Erro ao salvar dados: ' + error.message, 'error');
    }
};
</script>

<template>
    <div class="profile-card">
        <div class="card-header-actions">
            <div class="title-with-icon">
                <div class="header-icon">
                    <PhUser size="18" weight="duotone" />
                </div>
                <div>
                    <h2>Dados Pessoais</h2>
                    <p class="card-sub">Informações de identificação da sua conta</p>
                </div>
            </div>
        </div>

        <form class="profile-card-content" @submit.prevent="savePersonalData">
            <div class="form-grid">
                <div class="profile-card-content-item full-width">
                    <label for="name">Nome Completo</label>
                    <input type="text" id="name" v-model="profileStore.userName" placeholder="Seu nome completo">
                </div>
                <div class="profile-card-content-item">
                    <label for="email">E-mail de Login</label>
                    <input type="email" id="email" v-model="profileStore.userEmail" placeholder="voce@exemplo.com">
                </div>
                <div class="profile-card-content-item">
                    <label for="cpf">CPF</label>
                    <input type="text" id="cpf" v-model="profileStore.userCpf" @input="applyCpfMask" maxlength="14" placeholder="000.000.000-00">
                </div>
                <div class="profile-card-content-item">
                    <label for="phone">Telefone Principal (Auth)</label>
                    <input type="tel" id="phone" v-model="profileStore.userPhone" disabled title="Gerenciado pelo provedor de segurança.">
                </div>
                <div class="profile-card-content-item">
                    <label for="second_phone">Telefone Adicional / WhatsApp</label>
                    <input type="tel" id="second_phone" v-model="profileStore.userSecondPhone" @input="applyPhoneMask" maxlength="15" placeholder="(XX) 99999-9999">
                </div>
            </div>
            <div class="card-footer">
                <button class="btn-primary" type="submit">
                    <PhFloppyDisk size="17" weight="bold" />
                    Salvar Alterações
                </button>
            </div>
        </form>
    </div>
</template>

<style scoped>
    .title-with-icon {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    .header-icon {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        background: var(--primary-subtle);
        color: var(--primary-color);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .card-sub {
        margin: 2px 0 0 0;
        font-size: 0.78rem;
        color: var(--text-secondary);
    }

    .form-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 1.15rem;
    }
    
    @media (min-width: 768px) {
        .form-grid {
            grid-template-columns: 1fr 1fr;
        }
        .full-width {
            grid-column: 1 / -1;
        }
    }

    .profile-card-content-item input:disabled {
        opacity: 0.55;
        cursor: not-allowed;
    }

    .card-footer {
        display: flex;
        justify-content: flex-end;
        margin-top: 1.5rem;
        padding-top: 1.15rem;
        border-top: 1px solid var(--border-subtle);
    }
</style>
