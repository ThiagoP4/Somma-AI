import { supabase } from './supabase';
import type { Piggybank } from '../stores/usePiggybankStore';
import type { VariableAsset } from '../stores/useAssetsStore';

export interface EphemeralVaultPayload {
    piggybanks: Piggybank[];
    assets: VariableAsset[];
    pairedAt: string;
}

const bytesToBase64 = (bytes: Uint8Array): string => {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i] ?? 0);
    }
    return btoa(binary);
};

const base64ToBytes = (b64: string): Uint8Array => {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
};

export const generatePairingCode = (): string => {
    const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Sem 0/O/1/I para evitar confusão visual
    const rand = new Uint8Array(6);
    window.crypto.getRandomValues(rand);
    return Array.from(rand, b => alphabet[b % alphabet.length]).join('');
};

const deriveAesGcmKey = async (privateKey: CryptoKey, peerPublicJwk: JsonWebKey): Promise<CryptoKey> => {
    const peerPublicKey = await window.crypto.subtle.importKey(
        'jwk',
        peerPublicJwk,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        []
    );

    return window.crypto.subtle.deriveKey(
        { name: 'ECDH', public: peerPublicKey },
        privateKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
};

export interface ReceiverSessionHandle {
    code: string;
    fingerprint: string;
    stop: () => void;
}

/**
 * Inicia uma sessão efêmera no PC do Trabalho (fora da Tailscale).
 * - Gera um par de chaves ECDH P-256 apenas na memória RAM (chave privada non-extractable!).
 * - Escuta no canal WebSocket efêmero do Supabase Realtime (zero gravação em disco/banco).
 * - Assim que recebe e descriptografa o pacote com AES-256-GCM, destrói o canal e a chave privada (burn-after-reading).
 */
export async function startEphemeralVaultReceiver(options: {
    userId: string;
    onPaired: (payload: EphemeralVaultPayload) => void;
    onError: (msg: string) => void;
    onExpire: () => void;
}): Promise<ReceiverSessionHandle> {
    const code = generatePairingCode();

    // Chave privada com extractable = false (nem o próprio JS pode extrair da RAM!)
    const keyPair = await window.crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        ['deriveKey']
    );

    const publicJwk = await window.crypto.subtle.exportKey('jwk', keyPair.publicKey);
    const fingerprint = (publicJwk.x || '').slice(0, 8).toUpperCase();

    const channelName = `somma-vault-pair:${options.userId}:${code}`;
    const channel = supabase.channel(channelName, {
        config: { broadcast: { ack: true } }
    });

    let consumed = false;

    const cleanup = () => {
        if (consumed) return;
        consumed = true;
        clearTimeout(timeoutId);
        supabase.removeChannel(channel);
    };

    const timeoutId = setTimeout(() => {
        if (!consumed) {
            cleanup();
            options.onExpire();
        }
    }, 90_000); // Expira automaticamente em 90 segundos

    channel
        .on('broadcast', { event: 'phone_request_pubkey' }, async () => {
            if (consumed) return;
            await channel.send({
                type: 'broadcast',
                event: 'pc_pubkey',
                payload: { publicJwk, fingerprint }
            });
        })
        .on('broadcast', { event: 'encrypted_vault_bundle' }, async ({ payload }) => {
            if (consumed) return;
            try {
                const { phonePublicJwk, ivB64, ciphertextB64 } = payload || {};
                if (!phonePublicJwk || !ivB64 || !ciphertextB64) {
                    throw new Error('Pacote criptografado inválido.');
                }

                const aesKey = await deriveAesGcmKey(keyPair.privateKey, phonePublicJwk);
                const iv = base64ToBytes(ivB64);
                const ciphertext = base64ToBytes(ciphertextB64);

                const decryptedBuffer = await window.crypto.subtle.decrypt(
                    { name: 'AES-GCM', iv: iv as BufferSource },
                    aesKey,
                    ciphertext as BufferSource
                );

                const jsonStr = new TextDecoder().decode(decryptedBuffer);
                const parsed = JSON.parse(jsonStr) as EphemeralVaultPayload;

                // Confirma ao celular que recebeu e destrói o canal imediatamente (Burn-After-Reading)
                await channel.send({
                    type: 'broadcast',
                    event: 'pair_ack_destroy',
                    payload: { ok: true }
                });

                cleanup();
                options.onPaired(parsed);
            } catch (err: any) {
                cleanup();
                options.onError(err?.message || 'Falha na descriptografia ECDH/AES-256-GCM.');
            }
        })
        .subscribe();

    return {
        code,
        fingerprint,
        stop: cleanup
    };
}

/**
 * Executa no Celular (conectado na VPN Tailscale):
 * - Entra no canal efêmero pelo código de 6 caracteres (lido do QR Code ou digitado).
 * - Recebe a chave pública ECDH P-256 do PC, gera um par de chaves efêmero no celular,
 *   deriva a chave AES-256-GCM compartilhada, criptografa os saldos na RAM e envia 1 única vez.
 */
export async function sendVaultSnapshotToPairedPc(options: {
    userId: string;
    rawCode: string;
    payload: EphemeralVaultPayload;
}): Promise<{ fingerprint: string }> {
    const cleanCode = options.rawCode.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    if (cleanCode.length !== 6) {
        throw new Error('O código de pareamento deve ter 6 caracteres.');
    }

    const phoneKeyPair = await window.crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        ['deriveKey']
    );
    const phonePublicJwk = await window.crypto.subtle.exportKey('jwk', phoneKeyPair.publicKey);

    const channelName = `somma-vault-pair:${options.userId}:${cleanCode}`;
    const channel = supabase.channel(channelName, {
        config: { broadcast: { ack: true } }
    });

    return new Promise((resolve, reject) => {
        let finished = false;

        const done = (err?: Error, res?: { fingerprint: string }) => {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            supabase.removeChannel(channel);
            if (err) reject(err);
            else if (res) resolve(res);
        };

        const timer = setTimeout(() => {
            done(new Error('Tempo esgotado: nenhum PC aguardando com esse código.'));
        }, 12_000);

        channel
            .on('broadcast', { event: 'pc_pubkey' }, async ({ payload }) => {
                if (finished) return;
                try {
                    const pcPubJwk = payload?.publicJwk as JsonWebKey;
                    const fingerprint = String(payload?.fingerprint || '');
                    if (!pcPubJwk) throw new Error('Chave pública do PC ausente.');

                    const aesKey = await deriveAesGcmKey(phoneKeyPair.privateKey, pcPubJwk);
                    const iv = new Uint8Array(12);
                    window.crypto.getRandomValues(iv);

                    const encoded = new TextEncoder().encode(JSON.stringify(options.payload));
                    const encryptedBuf = await window.crypto.subtle.encrypt(
                        { name: 'AES-GCM', iv: iv as BufferSource },
                        aesKey,
                        encoded as BufferSource
                    );

                    await channel.send({
                        type: 'broadcast',
                        event: 'encrypted_vault_bundle',
                        payload: {
                            phonePublicJwk,
                            ivB64: bytesToBase64(iv),
                            ciphertextB64: bytesToBase64(new Uint8Array(encryptedBuf))
                        }
                    });

                    done(undefined, { fingerprint });
                } catch (e: any) {
                    done(new Error(e?.message || 'Erro ao criptografar pacote do Cofre.'));
                }
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.send({
                        type: 'broadcast',
                        event: 'phone_request_pubkey',
                        payload: { ts: Date.now() }
                    });
                }
            });
    });
}
