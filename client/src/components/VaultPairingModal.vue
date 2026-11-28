<script setup lang="ts">
    import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
    import {
        PhQrCode, PhShieldCheck, PhDeviceMobileCamera, PhDesktop,
        PhArrowsClockwise, PhX, PhLockKey, PhCheckCircle, PhCamera, PhStop
    } from '@phosphor-icons/vue';
    import { useVaultStore } from '../stores/useVaultStore';
    import { useProfileStore } from '../stores/useProfileStore';
    import { usePiggybankStore } from '../stores/usePiggybankStore';
    import { useAssetsStore } from '../stores/useAssetsStore';
    import { useAlertStore } from '../stores/useAlertStore';
    import {
        startEphemeralVaultReceiver,
        sendVaultSnapshotToPairedPc,
        type ReceiverSessionHandle
    } from '../services/vaultEphemeralPairing';

    const props = defineProps<{
        initialMode?: 'receive' | 'send';
    }>();

    const emit = defineEmits<{
        (e: 'close'): void;
    }>();

    const vaultStore = useVaultStore();
    const profileStore = useProfileStore();
    const piggybankStore = usePiggybankStore();
    const assetsStore = useAssetsStore();
    const { showAlert } = useAlertStore();

    // Se o dispositivo atual já está conectado na Tailscale (ex: Celular), abre no modo Enviar ("send").
    // Caso contrário (ex: PC do trabalho fora da Tailscale), abre no modo Receber ("receive").
    const activeMode = ref<'receive' | 'send'>(
        props.initialMode ?? (vaultStore.status === 'connected' ? 'send' : 'receive')
    );

    // Estado Modo 1: Receber no PC (RAM Only)
    const pairingCode = ref('');
    const keyFingerprint = ref('');
    const secondsLeft = ref(90);
    const receiverStatus = ref<'initializing' | 'waiting' | 'expired' | 'error'>('initializing');
    const receiverErrorMsg = ref('');
    let receiverHandle: ReceiverSessionHandle | null = null;
    let countdownInterval: ReturnType<typeof setInterval> | null = null;

    // Estado Modo 2: Enviar do Celular (Tailscale Conectado)
    const inputCode = ref('');
    const isSending = ref(false);
    const isCameraActive = ref(false);
    const cameraError = ref('');
    const videoRef = ref<HTMLVideoElement | null>(null);
    let mediaStream: MediaStream | null = null;
    let scanFrameId: number | null = null;

    const formattedPairingCode = computed(() => {
        if (!pairingCode.value || pairingCode.value.length !== 6) return '•••-•••';
        return `${pairingCode.value.slice(0, 3)}-${pairingCode.value.slice(3)}`;
    });

    // =========================================================================
    // Gerador QR Code ISO/IEC 18004 (Version 1-L, 21x21) Nativo Zero-Dependência
    // =========================================================================
    function buildQrMatrixV1L(text: string): boolean[][] {
        const size = 21;
        const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
        const isFunction: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

        const setFunc = (r: number, c: number, val: boolean) => {
            if (r >= 0 && r < size && c >= 0 && c < size) {
                matrix[r]![c] = val;
                isFunction[r]![c] = true;
            }
        };

        const placeFinder = (top: number, left: number) => {
            for (let r = -1; r <= 7; r++) {
                for (let c = -1; c <= 7; c++) {
                    const inOuter = r >= 0 && r <= 6 && c >= 0 && c <= 6;
                    const onBorder = r === 0 || r === 6 || c === 0 || c === 6;
                    const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
                    setFunc(top + r, left + c, inOuter && (onBorder || inCore));
                }
            }
        };

        placeFinder(0, 0);
        placeFinder(0, size - 7);
        placeFinder(size - 7, 0);

        // Timing patterns
        for (let i = 8; i < size - 8; i++) {
            setFunc(6, i, i % 2 === 0);
            setFunc(i, 6, i % 2 === 0);
        }

        // Dark module
        setFunc(size - 8, 8, true);

        // Reserva área de Format Info
        for (let i = 0; i < 9; i++) {
            if (i !== 6) {
                isFunction[8]![i] = true;
                isFunction[i]![8] = true;
            }
        }
        for (let i = 0; i < 8; i++) {
            isFunction[8]![size - 1 - i] = true;
            isFunction[size - 1 - i]![8] = true;
        }

        // Codificação Byte Mode (19 data codewords + 7 EC codewords = 26 codewords)
        const payloadBytes = Array.from(new TextEncoder().encode(text)).slice(0, 17);
        const bits: number[] = [];
        const pushBits = (val: number, len: number) => {
            for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
        };

        pushBits(0b0100, 4); // Byte mode
        pushBits(payloadBytes.length, 8);
        for (const b of payloadBytes) pushBits(b, 8);
        pushBits(0, Math.min(4, 152 - bits.length));
        while (bits.length % 8 !== 0) bits.push(0);

        const dataCw: number[] = [];
        for (let i = 0; i < bits.length; i += 8) {
            let byte = 0;
            for (let j = 0; j < 8; j++) byte = (byte << 1) | (bits[i + j] ?? 0);
            dataCw.push(byte);
        }
        const padBytes = [0xec, 0x11];
        let padIdx = 0;
        while (dataCw.length < 19) {
            dataCw.push(padBytes[padIdx % 2]!);
            padIdx++;
        }

        // Reed-Solomon GF(256) (poly 0x11d) com 7 EC codewords
        const gfExp = new Uint8Array(512);
        const gfLog = new Uint8Array(256);
        let x = 1;
        for (let i = 0; i < 255; i++) {
            gfExp[i] = x;
            gfLog[x] = i;
            x <<= 1;
            if (x & 0x100) x ^= 0x11d;
        }
        for (let i = 255; i < 512; i++) gfExp[i] = gfExp[i - 255]!;
        const gfMul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : gfExp[(gfLog[a]! + gfLog[b]!) % 255]!);

        let gen = [1];
        for (let i = 0; i < 7; i++) {
            const next = new Array(gen.length + 1).fill(0);
            for (let j = 0; j < gen.length; j++) {
                next[j] ^= gen[j]!;
                next[j + 1] ^= gfMul(gen[j]!, gfExp[i]!);
            }
            gen = next;
        }

        const ec = new Array(7).fill(0);
        for (const b of dataCw) {
            const factor = b ^ ec[0]!;
            ec.shift();
            ec.push(0);
            for (let i = 0; i < 7; i++) {
                ec[i] ^= gfMul(gen[i + 1]!, factor);
            }
        }

        const allCodewords = [...dataCw, ...ec];
        const allBits: number[] = [];
        for (const cw of allCodewords) {
            for (let i = 7; i >= 0; i--) allBits.push((cw >>> i) & 1);
        }

        // Zig-zag placement + Mask 0 ((r + c) % 2 === 0)
        let bitIdx = 0;
        let upward = true;
        for (let right = size - 1; right >= 1; right -= 2) {
            if (right === 6) right = 5;
            for (let vert = 0; vert < size; vert++) {
                const r = upward ? size - 1 - vert : vert;
                for (let j = 0; j < 2; j++) {
                    const c = right - j;
                    if (!isFunction[r]![c]) {
                        const bit = bitIdx < allBits.length ? allBits[bitIdx++] === 1 : false;
                        const mask = (r + c) % 2 === 0;
                        matrix[r]![c] = bit !== mask;
                    }
                }
            }
            upward = !upward;
        }

        // Format info para Level L (01) + Mask 0 (000) = 0x77C4
        const formatBits = 0x77c4;
        for (let i = 0; i <= 5; i++) matrix[8]![i] = ((formatBits >>> (14 - i)) & 1) === 1;
        matrix[8]![7] = ((formatBits >>> 8) & 1) === 1;
        matrix[8]![8] = ((formatBits >>> 7) & 1) === 1;
        matrix[7]![8] = ((formatBits >>> 6) & 1) === 1;
        for (let i = 0; i < 6; i++) matrix[5 - i]![8] = ((formatBits >>> (5 - i)) & 1) === 1;

        for (let i = 0; i < 7; i++) matrix[size - 1 - i]![8] = ((formatBits >>> (14 - i)) & 1) === 1;
        for (let i = 0; i < 8; i++) matrix[8]![size - 8 + i] = ((formatBits >>> (7 - i)) & 1) === 1;

        return matrix;
    }

    const qrModules = computed(() => {
        if (!pairingCode.value) return [];
        return buildQrMatrixV1L(`SOMMA:${pairingCode.value}`);
    });

    // =========================================================================
    // Fluxo Modo 1: PC do Trabalho (Receber Cofre na RAM)
    // =========================================================================
    const initReceiverSession = async () => {
        stopReceiverSession();

        if (!profileStore.userId) {
            await profileStore.fetchProfileData();
        }
        if (!profileStore.userId) {
            receiverStatus.value = 'error';
            receiverErrorMsg.value = 'Sessão de usuário não identificada. Faça login novamente.';
            return;
        }

        receiverStatus.value = 'initializing';
        secondsLeft.value = 90;

        try {
            receiverHandle = await startEphemeralVaultReceiver({
                userId: profileStore.userId,
                onPaired: (payload) => {
                    piggybankStore.piggybanks = Array.isArray(payload.piggybanks) ? payload.piggybanks : [];
                    assetsStore.assets = Array.isArray(payload.assets) ? payload.assets : [];
                    vaultStore.activateEphemeralSession(payload.pairedAt);
                    showAlert(
                        'Cofre desbloqueado na memória RAM! Ao fechar ou atualizar a aba (F5), tudo se apaga automaticamente.',
                        'success',
                        5000
                    );
                    emit('close');
                },
                onError: (msg) => {
                    receiverStatus.value = 'error';
                    receiverErrorMsg.value = msg;
                },
                onExpire: () => {
                    receiverStatus.value = 'expired';
                }
            });

            pairingCode.value = receiverHandle.code;
            keyFingerprint.value = receiverHandle.fingerprint;
            receiverStatus.value = 'waiting';

            countdownInterval = setInterval(() => {
                if (secondsLeft.value > 0) {
                    secondsLeft.value--;
                }
            }, 1000);
        } catch (err: any) {
            receiverStatus.value = 'error';
            receiverErrorMsg.value = err?.message || 'Erro ao iniciar canal efêmero.';
        }
    };

    const stopReceiverSession = () => {
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
        if (receiverHandle) {
            receiverHandle.stop();
            receiverHandle = null;
        }
    };

    // =========================================================================
    // Fluxo Modo 2: Celular na Tailscale (Enviar Cofre Criptografado)
    // =========================================================================
    const extractSixCharCode = (raw: string): string => {
        const trimmed = raw.trim().toUpperCase();
        if (trimmed.startsWith('SOMMA:')) {
            return trimmed.replace('SOMMA:', '').replace(/[^A-Z0-9]/g, '').slice(0, 6);
        }
        return trimmed.replace(/[^A-Z0-9]/g, '').slice(0, 6);
    };

    const handleSendToPc = async () => {
        const clean = extractSixCharCode(inputCode.value);
        if (clean.length !== 6) {
            showAlert('Digite ou escaneie os 6 caracteres exibidos no PC.', 'warning');
            return;
        }

        if (vaultStore.status !== 'connected') {
            const ok = await vaultStore.checkTailscaleConnection();
            if (!ok) {
                showAlert('Seu celular precisa estar conectado na VPN Tailscale para ler o Cofre e enviá-lo ao PC.', 'error', 5000);
                return;
            }
        }

        isSending.value = true;
        try {
            if (!profileStore.userId) {
                await profileStore.fetchProfileData();
            }
            await Promise.all([
                piggybankStore.fetchPiggybanks(),
                assetsStore.fetchAssets()
            ]);

            await sendVaultSnapshotToPairedPc({
                userId: profileStore.userId!,
                rawCode: clean,
                payload: {
                    piggybanks: piggybankStore.piggybanks,
                    assets: assetsStore.assets,
                    pairedAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                }
            });

            stopCameraScanner();
            showAlert('Cofre transmitido com criptografia ECDH P-256 + AES-256-GCM para a RAM do PC!', 'success', 4500);
            emit('close');
        } catch (err: any) {
            showAlert(err?.message || 'Falha ao parear com o PC.', 'error', 4500);
        } finally {
            isSending.value = false;
        }
    };

    const startCameraScanner = async () => {
        cameraError.value = '';
        const BarcodeDetectorCtor = (window as any).BarcodeDetector;
        if (!BarcodeDetectorCtor) {
            cameraError.value = 'Seu navegador não possui leitor nativo de QR Code habilitado. Digite o código de 6 letras abaixo (leva 2 segundos!).';
            return;
        }

        try {
            mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });
            isCameraActive.value = true;

            setTimeout(() => {
                if (videoRef.value && mediaStream) {
                    videoRef.value.srcObject = mediaStream;
                    videoRef.value.play().catch(() => {});
                }
            }, 60);

            const detector = new BarcodeDetectorCtor({ formats: ['qr_code'] });

            const tick = async () => {
                if (!isCameraActive.value || !videoRef.value) return;
                try {
                    if (videoRef.value.readyState >= 2) {
                        const codes = await detector.detect(videoRef.value);
                        if (codes && codes.length > 0 && codes[0]?.rawValue) {
                            const code = extractSixCharCode(String(codes[0].rawValue));
                            if (code.length === 6) {
                                inputCode.value = code;
                                stopCameraScanner();
                                await handleSendToPc();
                                return;
                            }
                        }
                    }
                } catch {
                    // Ignora frame inválido
                }
                scanFrameId = requestAnimationFrame(tick);
            };
            scanFrameId = requestAnimationFrame(tick);
        } catch {
            cameraError.value = 'Permissão de câmera negada ou indisponível. Digite o código de 6 caracteres abaixo.';
            isCameraActive.value = false;
        }
    };

    const stopCameraScanner = () => {
        isCameraActive.value = false;
        if (scanFrameId !== null) {
            cancelAnimationFrame(scanFrameId);
            scanFrameId = null;
        }
        if (mediaStream) {
            mediaStream.getTracks().forEach(t => t.stop());
            mediaStream = null;
        }
    };

    watch(activeMode, (mode) => {
        if (mode === 'receive') {
            stopCameraScanner();
            initReceiverSession();
        } else {
            stopReceiverSession();
        }
    });

    onMounted(() => {
        if (activeMode.value === 'receive') {
            initReceiverSession();
        }
    });

    onUnmounted(() => {
        stopReceiverSession();
        stopCameraScanner();
    });
</script>

<template>
    <div class="modal-backdrop" @click.self="emit('close')">
        <div class="pairing-modal">
            <div class="modal-header">
                <div class="header-title">
                    <div class="badge-icon">
                        <PhQrCode size="22" weight="duotone" />
                    </div>
                    <div>
                        <h3>Sincronizar Carteira com o Celular</h3>
                        <p>Visualização temporária criptografada • Válida apenas nesta aba</p>
                    </div>
                </div>
                <button class="close-btn" @click="emit('close')" aria-label="Fechar">
                    <PhX size="20" />
                </button>
            </div>

            <!-- Abas: Receber no PC vs Enviar do Celular -->
            <div class="mode-tabs">
                <button
                    type="button"
                    class="mode-tab"
                    :class="{ active: activeMode === 'receive' }"
                    @click="activeMode = 'receive'"
                >
                    <PhDesktop size="16" weight="duotone" />
                    <span>Neste Computador</span>
                </button>
                <button
                    type="button"
                    class="mode-tab"
                    :class="{ active: activeMode === 'send' }"
                    @click="activeMode = 'send'"
                >
                    <PhDeviceMobileCamera size="16" weight="duotone" />
                    <span>Ler com o Celular</span>
                </button>
            </div>

            <!-- MODO 1: RECEBER NO PC -->
            <div v-if="activeMode === 'receive'" class="mode-body">
                <div v-if="receiverStatus === 'waiting'" class="qr-receiver-card">
                    <div class="qr-svg-wrapper">
                        <svg
                            v-if="qrModules.length === 21"
                            viewBox="0 0 25 25"
                            class="qr-svg"
                            shape-rendering="crispEdges"
                        >
                            <rect width="25" height="25" fill="#ffffff" rx="1.5" />
                            <g v-for="(row, rIdx) in qrModules" :key="rIdx">
                                <rect
                                    v-for="(cell, cIdx) in row"
                                    :key="cIdx"
                                    v-show="cell"
                                    :x="cIdx + 2"
                                    :y="rIdx + 2"
                                    width="1"
                                    height="1"
                                    fill="#090d16"
                                />
                            </g>
                        </svg>
                    </div>

                    <div class="code-display-box">
                        <span class="code-eyebrow">Código de Sincronização</span>
                        <strong class="big-code">{{ formattedPairingCode }}</strong>
                        <div class="crypto-pills">
                            <span class="crypto-pill">
                                <PhLockKey size="12" weight="fill" />
                                Criptografia Ponta a Ponta
                            </span>
                            <span class="timer-pill" :class="{ urgent: secondsLeft <= 20 }">
                                Expira em {{ secondsLeft }}s
                            </span>
                        </div>
                    </div>
                </div>

                <div v-else-if="receiverStatus === 'expired' || receiverStatus === 'error'" class="expired-box">
                    <p>{{ receiverStatus === 'expired' ? 'O QR Code expirou após 90 segundos por segurança.' : receiverErrorMsg }}</p>
                    <button type="button" class="btn-primary" @click="initReceiverSession">
                        <PhArrowsClockwise size="16" weight="bold" />
                        Gerar Novo Código
                    </button>
                </div>

                <div v-else class="loading-state">
                    Preparando código seguro de sincronização...
                </div>

                <div class="security-steps">
                    <div class="step-line">
                        <PhCheckCircle size="16" weight="fill" class="icon-emerald" />
                        <span><strong>Como usar:</strong> Abra o Somma no seu <strong>Celular</strong>, toque em <strong>Cofre Ativo</strong> no topo e escolha <em>"Liberar Acesso em Outro PC"</em>.</span>
                    </div>
                    <div class="step-line">
                        <PhShieldCheck size="16" weight="fill" class="icon-emerald" />
                        <span><strong>Privacidade Total:</strong> Nenhum dado fica salvo neste computador. Ao atualizar a página ou fechar a aba, o acesso é encerrado automaticamente.</span>
                    </div>
                </div>
            </div>

            <!-- MODO 2: ENVIAR DO CELULAR -->
            <div v-else class="mode-body">
                <div class="sender-status-banner" :class="vaultStore.status === 'connected' ? 'ok' : 'warn'">
                    <PhShieldCheck v-if="vaultStore.status === 'connected'" size="18" weight="fill" />
                    <PhLockKey v-else size="18" weight="fill" />
                    <span>
                        {{
                            vaultStore.status === 'connected'
                                ? 'Cofre conectado neste aparelho — pronto para sincronizar com o computador.'
                                : 'Conecte-se ao seu servidor privado no celular antes de sincronizar com o computador.'
                        }}
                    </span>
                </div>

                <div class="camera-section">
                    <template v-if="!isCameraActive">
                        <button type="button" class="btn-camera" @click="startCameraScanner">
                            <PhCamera size="18" weight="duotone" />
                            <span>Escanear QR Code com a Câmera</span>
                        </button>
                    </template>
                    <template v-else>
                        <div class="video-container">
                            <video ref="videoRef" playsinline muted class="qr-video"></video>
                            <button type="button" class="btn-stop-camera" @click="stopCameraScanner">
                                <PhStop size="14" weight="fill" /> Fechar Câmera
                            </button>
                        </div>
                    </template>
                    <p v-if="cameraError" class="camera-warn">{{ cameraError }}</p>
                </div>

                <div class="manual-code-box">
                    <label for="pair-code-input">Ou digite o código de 6 caracteres exibido no PC:</label>
                    <div class="code-input-row">
                        <input
                            id="pair-code-input"
                            v-model="inputCode"
                            type="text"
                            maxlength="12"
                            placeholder="Ex: K7M-9P2"
                            class="code-input"
                            @keyup.enter="handleSendToPc"
                        />
                        <button
                            type="button"
                            class="btn-primary"
                            :disabled="isSending || extractSixCharCode(inputCode).length !== 6"
                            @click="handleSendToPc"
                        >
                            {{ isSending ? 'Criptografando...' : 'Desbloquear PC' }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
    .modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 9999;
        background: rgba(6, 9, 15, 0.78);
        backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
    }

    .pairing-modal {
        width: 100%;
        max-width: 480px;
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 18px;
        padding: 1.35rem;
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
        display: flex;
        flex-direction: column;
        gap: 1.1rem;
    }

    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 0.75rem;
    }

    .header-title {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    .badge-icon {
        width: 42px;
        height: 42px;
        border-radius: 11px;
        background: rgba(16, 185, 129, 0.14);
        color: #10b981;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .header-title h3 {
        margin: 0;
        font-size: 1.05rem;
        font-weight: 700;
        color: var(--text-primary);
    }

    .header-title p {
        margin: 2px 0 0 0;
        font-size: 0.76rem;
        color: var(--text-secondary);
    }

    .close-btn {
        background: transparent;
        border: 1px solid var(--border-color);
        color: var(--text-secondary);
        width: 32px;
        height: 32px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
    }

    .mode-tabs {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.45rem;
        background: var(--bg-page);
        padding: 0.3rem;
        border-radius: 11px;
        border: 1px solid var(--border-color);
    }

    .mode-tab {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.4rem;
        padding: 0.55rem 0.65rem;
        border-radius: 8px;
        border: none;
        background: transparent;
        color: var(--text-secondary);
        font-size: 0.78rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .mode-tab.active {
        background: var(--bg-card);
        color: var(--text-primary);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }

    .mode-body {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .qr-receiver-card {
        display: flex;
        align-items: center;
        gap: 1.1rem;
        padding: 1rem;
        border-radius: 14px;
        background: var(--bg-page);
        border: 1px solid var(--border-color);
    }

    .qr-svg-wrapper {
        width: 138px;
        height: 138px;
        flex-shrink: 0;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28);
    }

    .qr-svg {
        width: 100%;
        height: 100%;
        display: block;
    }

    .code-display-box {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        min-width: 0;
    }

    .code-eyebrow {
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--text-secondary);
        font-weight: 600;
    }

    .big-code {
        font-size: 1.75rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        font-family: 'JetBrains Mono', monospace;
        color: #10b981;
    }

    .crypto-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
        margin-top: 0.2rem;
    }

    .crypto-pill, .timer-pill {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.7rem;
        font-weight: 600;
        padding: 3px 8px;
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.05);
        color: var(--text-secondary);
    }

    .timer-pill.urgent {
        background: rgba(239, 68, 68, 0.15);
        color: #f87171;
    }

    .security-steps {
        display: flex;
        flex-direction: column;
        gap: 0.55rem;
        padding: 0.85rem;
        border-radius: 11px;
        background: rgba(16, 185, 129, 0.06);
        border: 1px solid rgba(16, 185, 129, 0.18);
        font-size: 0.78rem;
        color: var(--text-secondary);
        line-height: 1.45;
    }

    .step-line {
        display: flex;
        align-items: flex-start;
        gap: 0.5rem;
    }

    .icon-emerald {
        color: #10b981;
        flex-shrink: 0;
        margin-top: 2px;
    }

    .expired-box, .loading-state {
        padding: 1.5rem 1rem;
        text-align: center;
        background: var(--bg-page);
        border-radius: 12px;
        border: 1px solid var(--border-color);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
        font-size: 0.85rem;
        color: var(--text-secondary);
    }

    .sender-status-banner {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        padding: 0.75rem 0.9rem;
        border-radius: 10px;
        font-size: 0.8rem;
        font-weight: 600;
    }

    .sender-status-banner.ok {
        background: rgba(16, 185, 129, 0.12);
        color: #10b981;
        border: 1px solid rgba(16, 185, 129, 0.25);
    }

    .sender-status-banner.warn {
        background: rgba(245, 158, 11, 0.12);
        color: #fbbf24;
        border: 1px solid rgba(245, 158, 11, 0.25);
    }

    .camera-section {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .btn-camera {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        width: 100%;
        padding: 0.75rem 1rem;
        border-radius: 10px;
        border: 1px dashed var(--border-color);
        background: var(--bg-page);
        color: var(--text-primary);
        font-weight: 600;
        font-size: 0.85rem;
        cursor: pointer;
    }

    .video-container {
        position: relative;
        border-radius: 12px;
        overflow: hidden;
        background: #000;
        aspect-ratio: 4 / 3;
    }

    .qr-video {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .btn-stop-camera {
        position: absolute;
        bottom: 10px;
        right: 10px;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 6px 12px;
        border-radius: 8px;
        border: none;
        background: rgba(239, 68, 68, 0.9);
        color: #fff;
        font-size: 0.76rem;
        font-weight: 600;
        cursor: pointer;
    }

    .camera-warn {
        margin: 0;
        font-size: 0.76rem;
        color: #fbbf24;
    }

    .manual-code-box {
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
    }

    .manual-code-box label {
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--text-secondary);
    }

    .code-input-row {
        display: flex;
        gap: 0.5rem;
    }

    .code-input {
        flex: 1;
        padding: 0.65rem 0.85rem;
        border-radius: 10px;
        border: 1px solid var(--border-color);
        background: var(--bg-page);
        color: var(--text-primary);
        font-family: 'JetBrains Mono', monospace;
        font-size: 1rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
    }

    @media (max-width: 480px) {
        .qr-receiver-card {
            flex-direction: column;
            text-align: center;
        }
        .crypto-pills {
            justify-content: center;
        }
    }
</style>
