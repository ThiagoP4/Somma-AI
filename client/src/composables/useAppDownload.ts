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

// Detecção blindada: retorna true se estiver rodando dentro do APK Android (Capacitor/WebView) OU como App Instalado (Standalone)
export function isRunningInsideInstalledApp(): boolean {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
    if (Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'web') return true;
    if ((window as any).Capacitor?.isNativePlatform?.()) return true;
    // Android WebView (APK Capacitor) sempre inclui "; wv)" no User-Agent ou roda em https://localhost no Android
    const ua = navigator.userAgent || '';
    if (/\bwv\b/i.test(ua)) return true;
    if (/Android/i.test(ua) && (window.location.hostname === 'localhost' || window.location.protocol === 'capacitor:')) return true;
    // App instalado na tela inicial (Standalone / PWA)
    if (window.matchMedia?.('(display-mode: standalone)')?.matches) return true;
    if ((navigator as any).standalone === true) return true;
    return false;
}

export function useAppDownload() {
    const insideApp = isRunningInsideInstalledApp();
    const isWebBrowser = !insideApp;
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
