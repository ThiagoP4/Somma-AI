<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { Capacitor } from '@capacitor/core';
import { PhSparkle, PhDownloadSimple, PhX } from '@phosphor-icons/vue';
import { useAlertStore } from '../stores/useAlertStore';

declare const __APP_VERSION__: string;
declare const __BUILD_ID__: string;

const DIRECT_LATEST_APK_URL = 'https://github.com/ThiagoP4/Somma-AI/releases/latest/download/app-debug.apk';
const LAST_SEEN_BUILD_KEY = 'somma_last_seen_build_v1';

const { showAlert } = useAlertStore();

const currentVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '2.0.3';
const currentBuildId = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : '';

const hasUpdate = ref(false);
const updateLabel = ref('');
const apkDownloadUrl = ref<string>(DIRECT_LATEST_APK_URL);
const dismissed = ref(false);

// Compara versões semânticas simples (ex: "2.1.0" > "2.0.3")
const isNewerSemver = (remoteVer: string, localVer: string): boolean => {
    const clean = (v: string) => v.replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
    const r = clean(remoteVer);
    const l = clean(localVer);
    for (let i = 0; i < 3; i++) {
        if ((r[i] || 0) > (l[i] || 0)) return true;
        if ((r[i] || 0) < (l[i] || 0)) return false;
    }
    return false;
};

const checkGithubReleaseForAndroid = async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
        const res = await fetch('https://api.github.com/repos/ThiagoP4/Somma-AI/releases/latest', {
            cache: 'no-store',
            headers: { Accept: 'application/vnd.github+json' }
        });
        if (!res.ok) return;
        const release = await res.json();
        const tag = String(release?.tag_name || '');
        if (!tag || !isNewerSemver(tag, currentVersion)) return;

        const apkAsset = (release?.assets || []).find((a: any) =>
            String(a?.name || '').toLowerCase().endsWith('.apk')
        );
        apkDownloadUrl.value = apkAsset?.browser_download_url || DIRECT_LATEST_APK_URL;
        updateLabel.value = tag;
        hasUpdate.value = true;
        dismissed.value = false;
    } catch {
        // Ignora se sem internet ou sem releases ainda
    }
};

const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible' && Capacitor.isNativePlatform()) {
        checkGithubReleaseForAndroid();
    }
};

const notifyApkDownloadStarted = () => {
    showAlert(`Baixando Somma AI ${updateLabel.value} (APK)...`, 'info', 4000);
};

onMounted(async () => {
    // Banner de atualização ativo apenas no APK Android (no navegador web, o deploy atualiza no F5)
    if (!Capacitor.isNativePlatform()) return;

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Feedback visual automático quando o APK abre numa versão mais nova do que a anterior
    const currentSignature = `${currentVersion}|${currentBuildId}`;
    const lastSeen = localStorage.getItem(LAST_SEEN_BUILD_KEY);
    if (lastSeen && lastSeen !== currentSignature) {
        showAlert(`Somma AI atualizado para a v${currentVersion} com sucesso!`, 'success', 5000);
    }
    localStorage.setItem(LAST_SEEN_BUILD_KEY, currentSignature);

    await checkGithubReleaseForAndroid();
});

onUnmounted(() => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
});
</script>

<template>
    <transition name="slide-up">
        <div
            v-if="hasUpdate && !dismissed"
            class="update-banner"
            role="alert"
            aria-live="polite"
        >
            <div class="ub-left">
                <div class="ub-icon">
                    <PhSparkle size="18" weight="fill" />
                </div>
                <div class="ub-text">
                    <strong>Nova atualização disponível ({{ updateLabel }})</strong>
                    <span>Baixe o novo APK do Somma AI com melhorias e correções.</span>
                </div>
            </div>

            <div class="ub-actions">
                <!-- No Android APK, usar link <a> externo evita que window.open() deixe o WebView em tela cinza/preta! -->
                <a
                    :href="apkDownloadUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="btn-update-now"
                    @click="notifyApkDownloadStarted"
                >
                    <PhDownloadSimple size="15" weight="bold" />
                    <span>Baixar APK</span>
                </a>
                <button
                    type="button"
                    class="btn-dismiss"
                    @click="dismissed = true"
                    aria-label="Lembrar depois"
                >
                    <PhX size="15" weight="bold" />
                </button>
            </div>
        </div>
    </transition>
</template>

<style scoped>
.update-banner {
    position: fixed;
    bottom: calc(1.25rem + env(safe-area-inset-bottom, 0px));
    left: 50%;
    transform: translateX(-50%);
    width: min(520px, calc(100vw - 24px));
    z-index: 99990;
    background: color-mix(in srgb, var(--bg-card) 94%, transparent);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border: 1px solid rgba(99, 102, 241, 0.45);
    border-radius: 16px;
    padding: 0.85rem 1rem;
    box-shadow: 0 18px 40px rgba(0, 0, 0, 0.55), 0 0 24px rgba(99, 102, 241, 0.22);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.85rem;
}

.ub-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
}

.ub-icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: var(--primary-gradient);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.ub-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
}

.ub-text strong {
    font-size: 0.84rem;
    color: var(--text-primary);
}

.ub-text span {
    font-size: 0.74rem;
    color: var(--text-secondary);
    line-height: 1.35;
}

.ub-actions {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-shrink: 0;
}

.btn-update-now {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--primary-color);
    color: white;
    text-decoration: none;
    border: none;
    border-radius: 9px;
    padding: 0.5rem 0.85rem;
    font-family: inherit;
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
}

.btn-update-now:hover:not(:disabled) {
    background: var(--primary-hover);
}

.spinning {
    animation: spinUpdate 0.9s linear infinite;
}

@keyframes spinUpdate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

.btn-dismiss {
    background: transparent;
    border: 1px solid var(--border-color);
    color: var(--text-muted);
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
}

.btn-dismiss:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
}

.slide-up-enter-active,
.slide-up-leave-active {
    transition: all 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
    opacity: 0;
    transform: translate(-50%, 24px);
}

@media (max-width: 560px) {
    .update-banner {
        flex-direction: column;
        align-items: stretch;
    }
    .ub-actions {
        justify-content: flex-end;
    }
    .btn-update-now {
        flex: 1;
        justify-content: center;
    }
}
</style>
