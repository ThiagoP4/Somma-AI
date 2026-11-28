import { Capacitor } from '@capacitor/core';
import { supabase } from './supabase';

const BIOMETRIC_STORAGE_KEY = 'somma_biometric_config_v1';
const SESSION_UNLOCKED_KEY = 'somma_biometric_unlocked_session';

export interface BiometricConfig {
    enabled: boolean;
    appLockOnStart: boolean;
    credentialId: string; // base64url ou 'native-android-biometric'
    email: string;
    userId: string;
    accessToken?: string;
    refreshToken?: string;
    registeredAt: string;
}

interface SommaNativeBiometricBridge {
    isAvailable?: () => boolean;
    authenticate?: (title: string, subtitle: string) => void;
}

const getNativeAndroidBridge = (): SommaNativeBiometricBridge | null => {
    if (typeof window === 'undefined') return null;
    const bridge = (window as any).SommaNativeBiometric as SommaNativeBiometricBridge | undefined;
    return bridge && typeof bridge.authenticate === 'function' ? bridge : null;
};

export const isMobileBiometricDevice = (): boolean => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
    const isCapacitorNative = Capacitor.isNativePlatform();
    const isMobileUa = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
    return isCapacitorNative || isMobileUa;
};

const bufferToBase64Url = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i] ?? 0);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const base64UrlToUint8Array = (base64url: string): Uint8Array => {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
    const binary = atob(base64 + pad);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
};

export const getBiometricConfig = (): BiometricConfig | null => {
    // Nunca ativa biometria em computadores desktop (Windows/Mac/Linux web)
    if (!isMobileBiometricDevice()) return null;
    try {
        const raw = localStorage.getItem(BIOMETRIC_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as BiometricConfig;
        if (!parsed?.enabled || !parsed?.credentialId) return null;
        return parsed;
    } catch {
        return null;
    }
};

export const isBiometricEnabled = (): boolean => Boolean(getBiometricConfig()?.enabled);

export const isAppLockEnabled = (): boolean => {
    const cfg = getBiometricConfig();
    return Boolean(cfg?.enabled && cfg?.appLockOnStart);
};

export const isSessionBiometricUnlocked = (): boolean => {
    return sessionStorage.getItem(SESSION_UNLOCKED_KEY) === 'true';
};

export const markSessionBiometricUnlocked = () => {
    sessionStorage.setItem(SESSION_UNLOCKED_KEY, 'true');
};

export const clearSessionBiometricUnlocked = () => {
    sessionStorage.removeItem(SESSION_UNLOCKED_KEY);
};

export const isBiometricSupported = async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false;
    if (!isMobileBiometricDevice()) return false;

    // 1. Se estiver no APK Android com a ponte nativa BiometricPrompt disponível
    const nativeBridge = getNativeAndroidBridge();
    if (nativeBridge) {
        try {
            return Boolean(nativeBridge.isAvailable ? nativeBridge.isAvailable() : true);
        } catch {
            return false;
        }
    }

    // Se estiver dentro do WebView do APK Android sem a ponte nativa, o WebAuthn em https://localhost falha
    if (Capacitor.isNativePlatform()) return false;

    // 2. No navegador mobile (Chrome Android / Safari iOS via HTTPS)
    if (!window.isSecureContext) return false;
    if (!window.PublicKeyCredential || !navigator.credentials) return false;
    try {
        return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
        return false;
    }
};

const runNativeAndroidBiometric = (title: string, subtitle: string): Promise<boolean> => {
    return new Promise((resolve, reject) => {
        const bridge = getNativeAndroidBridge();
        if (!bridge || !bridge.authenticate) {
            reject(new Error('Leitor biométrico nativo indisponível.'));
            return;
        }

        const timer = setTimeout(() => {
            delete (window as any).__onSommaBiometricResult;
            reject(new Error('Tempo limite da leitura biométrica esgotado.'));
        }, 30000);

        (window as any).__onSommaBiometricResult = (success: boolean, errorMsg?: string) => {
            clearTimeout(timer);
            delete (window as any).__onSommaBiometricResult;
            if (success) {
                resolve(true);
            } else {
                const err = new Error(errorMsg || 'Leitura biométrica cancelada.');
                err.name = 'NotAllowedError';
                reject(err);
            }
        };

        try {
            bridge.authenticate(title, subtitle);
        } catch (e: any) {
            clearTimeout(timer);
            delete (window as any).__onSommaBiometricResult;
            reject(e);
        }
    });
};

// Mantém o refresh_token e access_token da biometria sempre sincronizados quando o Supabase renova a sessão
export const syncBiometricSessionToken = (userId: string, refreshToken?: string | null, accessToken?: string | null) => {
    if (!isMobileBiometricDevice()) return;
    try {
        const raw = localStorage.getItem(BIOMETRIC_STORAGE_KEY);
        if (!raw) return;
        const cfg = JSON.parse(raw) as BiometricConfig;
        if (!cfg || cfg.userId !== userId) return;
        if (refreshToken) cfg.refreshToken = refreshToken;
        if (accessToken) cfg.accessToken = accessToken;
        localStorage.setItem(BIOMETRIC_STORAGE_KEY, JSON.stringify(cfg));
    } catch {
        // ignora erro de parse
    }
};

// Escuta globalmente renovações de token do Supabase para nunca deixar o refreshToken da digital defasado
if (typeof window !== 'undefined') {
    supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user && session.refresh_token) {
            syncBiometricSessionToken(session.user.id, session.refresh_token, session.access_token);
        }
    });
}

// Registra a digital / Face ID do celular (via BiometricPrompt nativo no APK ou WebAuthn no navegador mobile)
export const registerBiometricForCurrentUser = async (appLockOnStart = true): Promise<BiometricConfig> => {
    const supported = await isBiometricSupported();
    if (!supported) {
        throw new Error('Sensor biométrico não disponível neste aparelho.');
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session?.user) {
        throw new Error('Faça login na sua conta antes de ativar a biometria.');
    }

    const userEmail = session.user.email || 'usuario@somma.ai';
    const userId = session.user.id;
    let credentialId = 'native-android-biometric';

    const nativeBridge = getNativeAndroidBridge();
    if (nativeBridge) {
        const ok = await runNativeAndroidBiometric(
            'Ativar Digital no Somma AI',
            'Confirme sua digital para entrar sem digitar senha'
        );
        if (!ok) {
            throw new Error('Cadastro biométrico cancelado.');
        }
    } else {
        const challenge = crypto.getRandomValues(new Uint8Array(32));
        const userIdBytes = new TextEncoder().encode(userId).slice(0, 64);

        const credential = (await navigator.credentials.create({
            publicKey: {
                challenge,
                rp: {
                    name: 'Somma AI',
                    id: window.location.hostname
                },
                user: {
                    id: userIdBytes,
                    name: userEmail,
                    displayName: userEmail
                },
                pubKeyCredParams: [
                    { type: 'public-key', alg: -7 },   // ES256
                    { type: 'public-key', alg: -257 }  // RS256
                ],
                authenticatorSelection: {
                    authenticatorAttachment: 'platform',
                    userVerification: 'required',
                    residentKey: 'preferred'
                },
                timeout: 20000,
                attestation: 'none'
            }
        })) as PublicKeyCredential | null;

        if (!credential) {
            throw new Error('Cadastro biométrico cancelado.');
        }
        credentialId = bufferToBase64Url(credential.rawId);
    }

    const config: BiometricConfig = {
        enabled: true,
        appLockOnStart,
        credentialId,
        email: userEmail,
        userId,
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        registeredAt: new Date().toISOString()
    };

    localStorage.setItem(BIOMETRIC_STORAGE_KEY, JSON.stringify(config));
    markSessionBiometricUnlocked();
    return config;
};

// Solicita a leitura da digital / Face ID nativa do celular
export const verifyBiometric = async (): Promise<boolean> => {
    const cfg = getBiometricConfig();
    if (!cfg) {
        throw new Error('Biometria não configurada neste aparelho.');
    }

    const supported = await isBiometricSupported();
    if (!supported) {
        throw new Error('Autenticação biométrica indisponível neste aparelho.');
    }

    const nativeBridge = getNativeAndroidBridge();
    if (nativeBridge || cfg.credentialId === 'native-android-biometric') {
        const ok = await runNativeAndroidBiometric(
            'Desbloquear Somma AI',
            cfg.email || 'Confirme sua digital para acessar'
        );
        if (!ok) return false;
        markSessionBiometricUnlocked();
        return true;
    }

    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const credIdBytes = base64UrlToUint8Array(cfg.credentialId);

    const assertion = await navigator.credentials.get({
        publicKey: {
            challenge,
            rpId: window.location.hostname,
            allowCredentials: [
                {
                    id: credIdBytes as BufferSource,
                    type: 'public-key'
                }
            ],
            userVerification: 'required',
            timeout: 20000
        }
    });

    if (!assertion) return false;
    markSessionBiometricUnlocked();
    return true;
};

// Login direto pela tela /login usando a digital do celular
export const loginWithBiometric = async (): Promise<{ email: string }> => {
    const cfg = getBiometricConfig();
    if (!cfg) {
        throw new Error('Nenhuma digital cadastrada neste aparelho.');
    }

    const verified = await verifyBiometric();
    if (!verified) {
        throw new Error('Verificação biométrica cancelada.');
    }

    // 1. Se já houver sessão ativa do Supabase, apenas libera
    const { data: current } = await supabase.auth.getSession();
    if (current.session?.user) {
        syncBiometricSessionToken(current.session.user.id, current.session.refresh_token, current.session.access_token);
        return { email: cfg.email };
    }

    // 2. Caso o usuário tenha saído localmente antes, restaura a sessão pelo refresh_token / access_token salvo
    if (!cfg.refreshToken) {
        throw new Error('Sessão expirada. Entre com e-mail e senha uma vez para renovar sua digital.');
    }

    let restoredSession = null;

    const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession({
        refresh_token: cfg.refreshToken
    });

    if (!refreshErr && refreshed?.session) {
        restoredSession = refreshed.session;
    } else if (cfg.accessToken) {
        const { data: setRes, error: setErr } = await supabase.auth.setSession({
            access_token: cfg.accessToken,
            refresh_token: cfg.refreshToken
        });
        if (!setErr && setRes?.session) {
            restoredSession = setRes.session;
        }
    }

    if (!restoredSession) {
        console.error('[BiometricLogin] Falha ao restaurar sessão:', refreshErr);
        throw new Error('Sua sessão expirou por segurança. Entre com e-mail e senha uma vez para renovar a biometria.');
    }

    syncBiometricSessionToken(restoredSession.user.id, restoredSession.refresh_token, restoredSession.access_token);
    return { email: cfg.email };
};

export const setAppLockOnStart = (enabled: boolean) => {
    const cfg = getBiometricConfig();
    if (!cfg) return;
    cfg.appLockOnStart = enabled;
    localStorage.setItem(BIOMETRIC_STORAGE_KEY, JSON.stringify(cfg));
};

export const disableBiometric = () => {
    localStorage.removeItem(BIOMETRIC_STORAGE_KEY);
    clearSessionBiometricUnlocked();
};
