<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { PhSparkle, PhArrowsClockwise, PhDownloadSimple, PhX } from '@phosphor-icons/vue';

declare const __APP_VERSION__: string;
declare const __BUILD_ID__: string;

const currentVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '2.0.0';
const currentBuildId = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : '';

const hasUpdate = ref(false);
const updateLabel = ref('');
const updateMode = ref<'web-reload' | 'capgo-ota' | 'github-apk'>('web-reload');
const apkDownloadUrl = ref<string | null>(null);
const isUpdating = ref(false);
const dismissed = ref(false);

let intervalId: ReturnType<typeof setInterval> | null = null;

// Compara versões semânticas simples (ex: "2.1.0" > "2.0.0")
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

const checkWebVersion = async () => {
    if (Capacitor.isNativePlatform() || import.meta.env.DEV) return;
    try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.buildId && currentBuildId && data.buildId !== currentBuildId) {
            updateLabel.value = data.version ? `v${data.version}` : 'Nova versão';
            updateMode.value = 'web-reload';
            hasUpdate.value = true;
            dismissed.value = false;
        }
    } catch {
        // Ignora se offline
    }
};

const checkGithubReleaseForAndroid = async () => {
    try {
        const res = await fetch('https://api.github.com/repos/ThiagoP4/Somma-AI/releases/latest', {
            headers: { Accept: 'application/vnd.github+json' }
        });
        if (!res.ok) return;
        const release = await res.json();
        const tag = String(release?.tag_name || '');
        if (!tag || !isNewerSemver(tag, currentVersion)) return;

        const apkAsset = (release?.assets || []).find((a: any) =>
            String(a?.name || '').toLowerCase().endsWith('.apk')
        );
        apkDownloadUrl.value = apkAsset?.browser_download_url || release?.html_url || null;
        updateLabel.value = tag;
        updateMode.value = 'github-apk';
        hasUpdate.value = true;
        dismissed.value = false;
    } catch {
        // Ignora se sem internet ou sem releases ainda
    }
};

const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
        if (Capacitor.isNativePlatform()) {
            checkGithubReleaseForAndroid();
        } else {
            checkWebVersion();
        }
    }
};

const applyUpdateNow = async () => {
    isUpdating.value = true;
    try {
        if (updateMode.value === 'github-apk' && apkDownloadUrl.value) {
            window.open(apkDownloadUrl.value, '_blank', 'noopener,noreferrer');
            isUpdating.value = false;
            return;
        }

        if (updateMode.value === 'capgo-ota' && Capacitor.isNativePlatform()) {
            await CapacitorUpdater.reload();
            return;
        }

        // PWA / Web: limpa caches antigos e recarrega a aplicação
        if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
        }
        window.location.reload();
    } catch {
        window.location.reload();
    }
};

onMounted(async () => {
    document.addEventListener('visibilitychange', handleVisibilityChange);

    if (Capacitor.isNativePlatform()) {
        // Avisa o Capgo que o bundle atual carregou com sucesso (evita rollback automático)
        try {
            await CapacitorUpdater.notifyAppReady();
            CapacitorUpdater.addListener('updateAvailable', (info: any) => {
                updateLabel.value = info?.bundle?.version ? `v${info.bundle.version}` : 'Live Update';
                updateMode.value = 'capgo-ota';
                hasUpdate.value = true;
                dismissed.value = false;
            });
        } catch {
            // Ignora se Capgo não estiver configurado com token ainda
        }
        await checkGithubReleaseForAndroid();
    } else {
        await checkWebVersion();
        intervalId = setInterval(checkWebVersion, 10 * 60 * 1000);
    }
});

onUnmounted(() => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    if (intervalId) clearInterval(intervalId);
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
                    <span>
                        {{
                            updateMode === 'github-apk'
                                ? 'Baixe o novo APK do Somma AI com melhorias e correções.'
                                : 'Atualize agora para carregar os novos recursos.'
                        }}
                    </span>
                </div>
            </div>

            <div class="ub-actions">
                <button
                    type="button"
                    class="btn-update-now"
                    :disabled="isUpdating"
                    @click="applyUpdateNow"
                >
                    <PhDownloadSimple v-if="updateMode === 'github-apk'" size="15" weight="bold" />
                    <PhArrowsClockwise v-else size="15" weight="bold" />
                    <span>{{ isUpdating ? 'Atualizando...' : (updateMode === 'github-apk' ? 'Baixar APK' : 'Atualizar') }}</span>
                </button>
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
