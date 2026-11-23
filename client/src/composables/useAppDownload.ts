import { ref, onMounted } from 'vue';
import { Capacitor } from '@capacitor/core';

// Link oficial permanente do GitHub que SEMPRE baixa o APK da Release mais recente
const DIRECT_LATEST_APK_URL = 'https://github.com/ThiagoP4/Somma-AI/releases/latest/download/app-debug.apk';
const LATEST_RELEASE_API = 'https://api.github.com/repos/ThiagoP4/Somma-AI/releases/latest';

// Estado compartilhado em memória entre Login e Sidebar
const latestVersion = ref('Última versão');
const apkDownloadUrl = ref(DIRECT_LATEST_APK_URL);
const deferredPwaPrompt = ref<any>(null);
const hasFetched = ref(false);

if (typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', (e: Event) => {
        e.preventDefault();
        deferredPwaPrompt.value = e;
    });
}

export function useAppDownload() {
    const isWebBrowser = !Capacitor.isNativePlatform();
    const isAndroidWeb = isWebBrowser && typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

    const fetchLatestRelease = async () => {
        if (!isAndroidWeb || hasFetched.value) return;
        hasFetched.value = true;
        try {
            const res = await fetch(LATEST_RELEASE_API, {
                cache: 'no-store',
                headers: { Accept: 'application/vnd.github+json' }
            });
            if (!res.ok) return;
            const release = await res.json();
            if (release?.tag_name) {
                latestVersion.value = String(release.tag_name);
            }
            const apkAsset = (release?.assets || []).find((a: any) =>
                String(a?.name || '').toLowerCase().endsWith('.apk')
            );
            if (apkAsset?.browser_download_url) {
                apkDownloadUrl.value = apkAsset.browser_download_url;
            }
        } catch {
            // Mantém o link permanente /releases/latest/download/app-debug.apk
        }
    };

    const installDesktopApp = async () => {
        if (!deferredPwaPrompt.value) return false;
        deferredPwaPrompt.value.prompt();
        const choice = await deferredPwaPrompt.value.userChoice;
        deferredPwaPrompt.value = null;
        return choice?.outcome === 'accepted';
    };

    onMounted(() => {
        fetchLatestRelease();
    });

    return {
        isWebBrowser,
        isAndroidWeb,
        latestVersion,
        apkDownloadUrl,
        deferredPwaPrompt,
        installDesktopApp
    };
}
