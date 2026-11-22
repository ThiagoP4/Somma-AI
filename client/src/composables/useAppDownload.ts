import { ref, onMounted } from 'vue';
import { Capacitor } from '@capacitor/core';

const RELEASES_FALLBACK_URL = 'https://github.com/ThiagoP4/Somma-AI/releases/latest';
const LATEST_RELEASE_API = 'https://api.github.com/repos/ThiagoP4/Somma-AI/releases/latest';

// Estado compartilhado em memória entre Login e Sidebar
const latestVersion = ref('v2.0.0');
const apkDownloadUrl = ref(RELEASES_FALLBACK_URL);
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

    const fetchLatestRelease = async () => {
        if (!isWebBrowser || hasFetched.value) return;
        hasFetched.value = true;
        try {
            const res = await fetch(LATEST_RELEASE_API, {
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
            } else if (release?.html_url) {
                apkDownloadUrl.value = release.html_url;
            }
        } catch {
            // Mantém fallback para a página de Releases do GitHub
        }
    };

    const installPwa = async () => {
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
        latestVersion,
        apkDownloadUrl,
        deferredPwaPrompt,
        installPwa
    };
}
