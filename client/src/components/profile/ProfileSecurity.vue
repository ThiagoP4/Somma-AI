<script setup lang="ts">
import { ref } from 'vue';
import { PhLockKey, PhEye, PhEyeSlash, PhShieldCheck } from '@phosphor-icons/vue';
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
            password: newPassword.value,
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
        <div class="card-header-actions">
            <div class="title-with-icon">
                <div class="header-icon">
                    <PhLockKey size="18" weight="duotone" />
                </div>
                <div>
                    <h2>Segurança & Credenciais</h2>
                    <p class="card-sub">Atualize sua senha de acesso ao workspace</p>
                </div>
            </div>
        </div>

        <form class="profile-card-content" @submit.prevent="updateUserPassword">
            <div class="form-grid">
                <div class="profile-card-content-item">
                    <label for="new_password">Nova Senha</label>
                    <div class="pass-input-wrap">
                        <input
                            :type="showPassword ? 'text' : 'password'"
                            id="new_password"
                            v-model="newPassword"
                            placeholder="Mínimo 8 caracteres"
                            minlength="8"
                            required
                        >
                        <button type="button" class="password-toggle-btn" @click="togglePasswordVisibility" tabindex="-1">
                            <PhEyeSlash v-if="showPassword" size="18" />
                            <PhEye v-else size="18" />
                        </button>
                    </div>
                </div>
                <div class="profile-card-content-item">
                    <label for="confirm_password">Confirmar Nova Senha</label>
                    <input
                        :type="showPassword ? 'text' : 'password'"
                        id="confirm_password"
                        v-model="confirmPassword"
                        placeholder="Repita a nova senha"
                        minlength="8"
                        required
                    >
                </div>
            </div>

            <div class="card-footer">
                <button type="submit" class="btn-primary" :disabled="isUpdatingPassword">
                    <PhShieldCheck size="18" weight="bold" />
                    {{ isUpdatingPassword ? 'Atualizando...' : 'Atualizar Senha' }}
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
    }

    .pass-input-wrap {
        position: relative;
        display: flex;
        align-items: center;
    }

    .pass-input-wrap input {
        width: 100%;
        padding-right: 40px;
    }

    .password-toggle-btn {
        position: absolute;
        right: 10px;
        background: none;
        border: none;
        cursor: pointer;
        color: var(--text-secondary);
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 6px;
        transition: all 0.15s;
    }

    .password-toggle-btn:hover {
        background: var(--bg-hover);
        color: var(--primary-color);
    }

    .card-footer {
        display: flex;
        justify-content: flex-end;
        margin-top: 1.5rem;
        padding-top: 1.15rem;
        border-top: 1px solid var(--border-subtle);
    }
</style>
