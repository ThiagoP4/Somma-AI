<script setup lang="ts">
    import { ref, computed } from 'vue';
    import { PhCamera, PhCheckCircle, PhCreditCard, PhTarget, PhShieldCheck } from '@phosphor-icons/vue';
    import { supabase } from '../../services/supabase';
    import { useAlertStore } from '../../stores/useAlertStore';
    import { useProfileStore } from '../../stores/useProfileStore';
    
    const alertStore = useAlertStore();
    const profileStore = useProfileStore();

    const isUploading = ref(false);
    const fileInput = ref<HTMLInputElement | null>(null);
    
    const triggerFileInput = () => {
        if (!isUploading.value) fileInput.value?.click();
    };

    const userInitials = computed(() => {
        const name = profileStore.userName || 'Usuário';
        const parts = name.trim().split(' ').filter(Boolean);
        const first = parts[0] || 'U';
        const last = parts[parts.length - 1] || first;
        if (parts.length >= 2) {
            return ((first[0] || '') + (last[0] || '')).toUpperCase();
        }
        return first.substring(0, 2).toUpperCase();
    });

    const activeGoalsCount = computed(() => {
        return (profileStore.financialGoals || []).filter(g => g.status === 'em andamento').length;
    });

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
            profileStore.avatarUrl = data.publicUrl;
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
    <div class="profile-hero-card">
        <div class="hero-ambient"></div>

        <div class="hero-left">
            <div class="avatar-wrapper">
                <div class="avatar-box" :class="{ uploading: isUploading }">
                    <img v-if="profileStore.avatarUrl" :src="profileStore.avatarUrl" alt="Foto de Perfil" class="custom-avatar-img">
                    <span v-else class="avatar-initials">{{ userInitials }}</span>
                </div>
                
                <input type="file" accept="image/png, image/jpeg, image/webp" hidden ref="fileInput" @change="handleFileUpload">
                
                <button type="button" class="avatar-edit-btn" title="Alterar foto" @click="triggerFileInput" :disabled="isUploading">
                    <PhCamera size="15" weight="bold" />
                </button>
            </div>
            
            <div class="user-intro">
                <div class="name-row">
                    <h2>{{ profileStore.userName || 'Usuário Somma' }}</h2>
                    <span class="verified-badge">
                        <PhCheckCircle size="13" weight="fill" /> Conta Verificada
                    </span>
                </div>
                <p class="user-email">{{ profileStore.userEmail || 'Carregando e-mail...' }}</p>
            </div>
        </div>

        <div class="hero-metrics">
            <div class="hero-stat">
                <div class="stat-icon">
                    <PhCreditCard size="18" weight="duotone" />
                </div>
                <div class="stat-text">
                    <span class="stat-num">{{ profileStore.myCards?.length || 0 }}</span>
                    <span class="stat-lbl">Cartões ativos</span>
                </div>
            </div>
            <div class="stat-sep"></div>
            <div class="hero-stat">
                <div class="stat-icon">
                    <PhTarget size="18" weight="duotone" />
                </div>
                <div class="stat-text">
                    <span class="stat-num">{{ activeGoalsCount }}</span>
                    <span class="stat-lbl">Metas em curso</span>
                </div>
            </div>
            <div class="stat-sep"></div>
            <div class="hero-stat">
                <div class="stat-icon icon-green">
                    <PhShieldCheck size="18" weight="duotone" />
                </div>
                <div class="stat-text">
                    <span class="stat-num">Ativo</span>
                    <span class="stat-lbl">Cofre Supabase</span>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
    .profile-hero-card {
        position: relative;
        overflow: hidden;
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 16px;
        padding: 1.75rem 2rem;
        margin-bottom: 1.5rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 1.5rem;
        box-shadow: var(--shadow-sm);
    }

    .hero-ambient {
        position: absolute;
        top: -80px;
        left: -60px;
        width: 280px;
        height: 280px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(99, 102, 241, 0.14) 0%, transparent 70%);
        pointer-events: none;
    }

    .hero-left {
        position: relative;
        display: flex;
        align-items: center;
        gap: 1.35rem;
        z-index: 1;
    }

    .avatar-wrapper {
        position: relative;
        flex-shrink: 0;
    }

    .avatar-box {
        width: 72px;
        height: 72px;
        background: var(--primary-gradient);
        border-radius: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        box-shadow: 0 6px 18px var(--primary-glow);
        overflow: hidden;
        transition: opacity 0.25s ease;
    }

    .avatar-box.uploading {
        opacity: 0.5;
    }

    .avatar-initials {
        font-size: 1.45rem;
        font-weight: 800;
        letter-spacing: -0.02em;
    }

    .custom-avatar-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .avatar-edit-btn {
        position: absolute;
        bottom: -4px;
        right: -4px;
        background: var(--bg-card);
        color: var(--text-primary);
        border: 1px solid var(--border-color);
        border-radius: 9px;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: var(--shadow-sm);
        transition: all 0.15s ease;
        padding: 0;
    }

    .avatar-edit-btn:hover {
        background: var(--primary-color);
        color: white;
        border-color: var(--primary-color);
    }

    .user-intro {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .name-row {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.65rem;
    }

    .user-intro h2 {
        color: var(--text-primary);
        font-size: 1.35rem;
        margin: 0;
        font-weight: 700;
        letter-spacing: -0.02em;
    }

    .verified-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.72rem;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 99px;
        background: var(--primary-subtle);
        color: var(--primary-color);
        border: 1px solid rgba(99, 102, 241, 0.22);
    }

    .user-email {
        color: var(--text-secondary);
        margin: 0;
        font-size: 0.875rem;
    }

    .hero-metrics {
        position: relative;
        z-index: 1;
        display: flex;
        align-items: center;
        gap: 1.25rem;
        background: var(--bg-elevated);
        border: 1px solid var(--border-color);
        padding: 0.85rem 1.35rem;
        border-radius: 14px;
    }

    .hero-stat {
        display: flex;
        align-items: center;
        gap: 0.65rem;
    }

    .stat-icon {
        width: 34px;
        height: 34px;
        border-radius: 9px;
        background: var(--primary-subtle);
        color: var(--primary-color);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .stat-icon.icon-green {
        background: var(--success-bg);
        color: var(--success-text);
    }

    .stat-text {
        display: flex;
        flex-direction: column;
    }

    .stat-num {
        font-size: 0.95rem;
        font-weight: 700;
        color: var(--text-primary);
        line-height: 1.2;
    }

    .stat-lbl {
        font-size: 0.72rem;
        color: var(--text-secondary);
        font-weight: 500;
    }

    .stat-sep {
        width: 1px;
        height: 28px;
        background: var(--border-color);
    }

    @media (max-width: 768px) {
        .profile-hero-card {
            padding: 1.35rem;
        }
        .hero-metrics {
            width: 100%;
            justify-content: space-between;
            padding: 0.75rem 1rem;
            gap: 0.5rem;
        }
    }
</style>
