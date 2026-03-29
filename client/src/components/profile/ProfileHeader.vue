<script setup lang="ts">
    import { ref } from 'vue';
    import { supabase } from '../../services/supabase';
    import { useAlertStore } from '../../stores/useAlertStore';
    import { useProfileStore } from '../../stores/useProfileStore'
    
    const alertStore = useAlertStore();
    const profileStore = useProfileStore();

    const isUploading = ref(false);
    const fileInput = ref<HTMLInputElement | null>(null);
    
    const triggerFileInput = () => {
        if (!isUploading.value) fileInput.value?.click();
    };

    const handleFileUpload = async (event: Event) => {
        const input = event.target as HTMLInputElement;
        if (!input.files || input.files.length === 0) return;
        const file = input.files[0];
        if (!file) return;
        const fileExt = file.name.split('.').pop();
        const { data: authData } = await supabase.auth.getUser();
        if (!authData.user) return;
        
        const filePath = `${authData.user.id}/avatar-${Date.now()}.${fileExt}`;
        isUploading.value = true;
        alertStore.showAlert('Enviando nova imagem para a nuvem...', 'warning');
        try {
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file, { upsert: true });
            if (uploadError) throw uploadError;
            const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
            profileStore.avatarUrl = data.publicUrl; // Gravando na Central
            const { error: profileError } = await supabase
                .from('usr_profile')
                .update({ avatar_url: profileStore.avatarUrl })
                .eq('id_profile', authData.user.id);
            if (profileError) throw profileError;
            alertStore.showAlert('Sua foto de perfil foi atualizada!', 'success');
        } catch (error: any) {
            console.error('Erro no upload de avatar:', error);
            alertStore.showAlert('Falha ao tentar enviar a foto: ' + error.message, 'error');
        } finally {
            isUploading.value = false;
        }
    };

</script>

<template>
    <div class="profile-header-card">
        <div class="avatar-wrapper">
            <div class="avatar-placeholder" :class="{'uploading': isUploading}">
                <!-- Magia do Store injetando os dados na Mente Compartilhada aqui na View -->
                <img v-if="profileStore.avatarUrl" :src="profileStore.avatarUrl" alt="Foto de Perfil" class="custom-avatar-img">
                <svg v-else xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            
            <input type="file" accept="image/png, image/jpeg, image/webp" hidden ref="fileInput" @change="handleFileUpload">
            
            <button type="button" class="avatar-edit-btn" title="Alterar foto" @click="triggerFileInput" :disabled="isUploading">
                <svg v-if="!isUploading" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                <svg v-else class="spin-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
            </button>
        </div>
        
        <div class="user-intro">
            <h2>{{ profileStore.userName || 'Carregando infos da auth...' }}</h2>
            <p>{{ profileStore.userEmail || 'Buscando servidor...' }}</p>
        </div>
    </div>
</template>
<style scoped>
    /* Roubamos o CSS disso limpinho do Profile mestre */
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
    .avatar-wrapper { position: relative; display: inline-block; }
    .avatar-placeholder {
        width: 80px; height: 80px; background: var(--bg-input); border-radius: 1.5rem; 
        display: flex; align-items: center; justify-content: center; color: var(--text-secondary); transition: opacity 0.3s ease;
    }
    .avatar-placeholder.uploading { opacity: 0.5; }
    .custom-avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: 1.5rem; }
    .avatar-edit-btn {
        position: absolute; bottom: -8px; right: -8px; background: var(--primary-color);
        color: white; border: none; border-radius: 50%; width: 32px; height: 32px;
        display: flex; align-items: center; justify-content: center; cursor: pointer;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2); transition: transform 0.2s, filter 0.2s; padding: 0;
    }
    .avatar-edit-btn:hover { transform: scale(1.05); filter: brightness(1.1); }
    .avatar-edit-btn:disabled { cursor: not-allowed; }
    .user-intro h2 { color: var(--text-primary); font-size: 1.5rem; margin: 0 0 0.5rem 0; font-weight: 600; }
    .user-intro p { color: var(--text-secondary); margin: 0; font-size: 1rem; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .spin-icon { animation: spin 1s linear infinite; }
</style>

