<script setup lang="ts">
import { ref } from 'vue';
import { supabase } from '../../services/supabase';
import { useAlertStore } from '../../stores/useAlertStore';

const alertStore = useAlertStore();

const newPassword = ref('');
const confirmPassword = ref('');
const showPassword = ref(false);
const isUpdatingPassword = ref(false);

const togglePasswordVisibility = () => {
    showPassword.value = !showPassword.value;
};

const updateUserPassword = async () => {
    if (newPassword.value !== confirmPassword.value) {
        alertStore.showAlert('As senhas não estão iguais', 'error');
        return;
    }

    isUpdatingPassword.value = true;
    alertStore.showAlert('Atualizando senha, aguarde...', 'warning');

    try {
        const { error: passwordError } = await supabase.auth.updateUser({
            password: newPassword.value, // Mudança real de senha!
        });
        
        if (passwordError) throw passwordError;
        
        alertStore.showAlert('Forte e segura! Sua nova chave secreta está salva.', 'success');
        newPassword.value = '';
        confirmPassword.value = '';     
    } catch (error: any) {
        console.error('Falha de Comunicação:', error);
        alertStore.showAlert('Erro ao atualizar senha: ' + error.message, 'error');
    } finally {
        isUpdatingPassword.value = false;
    }
};
</script>

<template>
    <div class="profile-card">
        <h2>Segurança da Conta</h2>
        <form class="profile-card-content" @submit.prevent="updateUserPassword">
            <div class="form-grid">
                <div class="profile-card-content-item full-width position-relative">
                    <label for="new_password">Nova Senha</label>
                    <input :type="showPassword ? 'text' : 'password'" id="new_password" v-model="newPassword" placeholder="Digite sua nova senha" minlength="8" required>
                    <button type="button" class="password-toggle-btn" @click="togglePasswordVisibility" tabindex="-1">
                        <svg v-if="!showPassword" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    </button>
                </div>
                <div class="profile-card-content-item full-width">
                    <label for="confirm_password">Confirmar Nova Senha</label>
                    <input :type="showPassword ? 'text' : 'password'" id="confirm_password" v-model="confirmPassword" placeholder="Repita a senha" minlength="8" required>
                </div>
                <div style="margin-top: 1.5rem; width: 100%;">
                    <button type="submit" class="btn-apply" style="width: 100%;" :disabled="isUpdatingPassword">
                        {{ isUpdatingPassword ? 'Enviando para Nuvem' : 'Salvar nova senha' }}
                    </button>
                </div>
            </div>
        </form>
    </div>
</template>

<style scoped>
    /* CSS das Caixas de Vidro Importado pro Card independente */
    .profile-card { background: var(--bg-card); border-radius: 1rem; padding: 2rem; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
    .profile-card h2 { color: var(--text-primary); font-size: 1.25rem; margin: 0 0 1.5rem 0; font-weight: 600; padding-bottom: 0.75rem; border-bottom: 1px solid var(--border-color); }
    .form-grid { display: flex; flex-direction: column; gap: 1.5rem; }
    .profile-card-content-item { display: flex; flex-direction: column; gap: 0.5rem; }
    .profile-card-content-item label { color: var(--text-secondary); font-size: 0.9rem; font-weight: 500; }
    .profile-card-content-item input { background: transparent; border: 1px solid var(--border-color); color: var(--text-primary); padding: 0.8rem; border-radius: 6px; font-size: 1rem; transition: border-color 0.2s; }
    .profile-card-content-item input:focus { border-color: var(--primary-color); outline: none; }
    .btn-apply { background-color: var(--primary-color); color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.5rem; font-weight: 600; cursor: pointer; transition: opacity 0.2s; }
    .btn-apply:hover { opacity: 0.9; }
    .btn-apply:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Estilos Específicos Exclusivos desse Componente */
    .position-relative { position: relative; }
    .password-toggle-btn { position: absolute; right: 12px; top: 36px; background: none; border: none; cursor: pointer; color: var(--text-secondary); display: flex; align-items: center; justify-content: center; transition: all 0.2s; padding: 4px; border-radius: 50%; }
    .password-toggle-btn:hover { background: rgba(255, 255, 255, 0.05); color: var(--primary-color); }
</style>
