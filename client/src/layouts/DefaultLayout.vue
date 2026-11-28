<script setup lang="ts">
    import { ref, onMounted, onUnmounted, computed } from 'vue';
    import { useRoute } from 'vue-router';
    import {
        PhCalendarBlank, PhCaretDown, PhCaretLeft, PhCaretRight, PhCreditCard,
        PhList, PhSparkle, PhShieldCheck, PhLockKey, PhArrowsClockwise, PhEye, PhEyeSlash,
        PhQrCode, PhTrash
    } from '@phosphor-icons/vue';
    import { storeToRefs } from 'pinia';
    import { onClickOutside } from '@vueuse/core';
    import Sidebar from '../components/Sidebar.vue';
    import VaultPairingModal from '../components/VaultPairingModal.vue';
    import { useFilterStore } from '../stores/useFilterStore';
    import { useProfileStore } from '../stores/useProfileStore';
    import { useVaultStore } from '../stores/useVaultStore';
    import { usePiggybankStore } from '../stores/usePiggybankStore';
    import { useAssetsStore } from '../stores/useAssetsStore';

    const route = useRoute();
    const isSidebarOpen = ref(false);

    const filterStore = useFilterStore();
    const profileStore = useProfileStore();
    const vaultStore = useVaultStore();
    const piggybankStore = usePiggybankStore();
    const assetsStore = useAssetsStore();

    const isPairingModalOpen = ref(false);
    const pairingModalMode = ref<'receive' | 'send'>('receive');

    const openPairingModal = (mode: 'receive' | 'send') => {
        pairingModalMode.value = mode;
        isVaultDropdownOpen.value = false;
        isPairingModalOpen.value = true;
    };

    const handleClearEphemeralRam = () => {
        vaultStore.clearEphemeralSession();
        piggybankStore.piggybanks = [];
        assetsStore.assets = [];
        isVaultDropdownOpen.value = false;
    };

    const { selectedMonth, selectedYear, filterMode, selectedCardIds } = storeToRefs(filterStore);
    const {
        selectMonth, nextYear, previousYear, nextMonth, previousMonth,
        goToCurrentMonth, monthNames, toggleCardSelection
    } = filterStore;
    const isDateDropdownOpen = ref(false);
    const dateDropdownRef = ref<HTMLElement | null>(null);

    const isVaultDropdownOpen = ref(false);
    const vaultDropdownRef = ref<HTMLElement | null>(null);

    const isPrivacyBlurActive = ref(sessionStorage.getItem('somma_privacy_blur') === 'true');

    const togglePrivacyBlur = () => {
        isPrivacyBlurActive.value = !isPrivacyBlurActive.value;
        sessionStorage.setItem('somma_privacy_blur', isPrivacyBlurActive.value ? 'true' : 'false');
    };

    const currentSectionLabel = computed(() => {
        const map: Record<string, string> = {
            '/': 'Visão Geral',
            '/dashboard': 'Dashboard Analítico',
            '/records': 'Registros Financeiros',
            '/investments': 'Investimentos & Cofrinhos',
            '/copilot': 'Copilot IA',
            '/profile': 'Meu Perfil',
            '/assinaturas': 'Assinaturas & Recorrências',
            '/casal': 'Finanças em Casal',
            '/config': 'Configurações do Sistema',
            '/ajuda': 'Central de Ajuda',
            '/sobre': 'Sobre o Somma AI'
        };
        return map[route.path] || 'Workspace';
    });

    onClickOutside(dateDropdownRef, () => {
        isDateDropdownOpen.value = false;
    });

    onClickOutside(vaultDropdownRef, () => {
        isVaultDropdownOpen.value = false;
    });

    const handleMonthSelection = (index: number) => {
        selectMonth(index);
        isDateDropdownOpen.value = false;
    };

    const handleReconnectVault = async () => {
        await vaultStore.checkTailscaleConnection();
        await piggybankStore.fetchPiggybanks();
    };

    const handleToggleSimulatedNetwork = async () => {
        await vaultStore.toggleSimulatedOffline();
        await piggybankStore.fetchPiggybanks();
    };

    const handleToggleStealth = async () => {
        vaultStore.toggleStealthMode();
        await piggybankStore.fetchPiggybanks();
    };

    const handleGlobalKeydown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            isSidebarOpen.value = false;
            isDateDropdownOpen.value = false;
            isVaultDropdownOpen.value = false;
        }
        if (e.altKey && (e.key === 'p' || e.key === 'P')) {
            e.preventDefault();
            togglePrivacyBlur();
        }
    };

    onMounted(async () => {
        window.addEventListener('keydown', handleGlobalKeydown);
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark' || !savedTheme) {
            document.body.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.body.classList.remove('dark');
        }
        await vaultStore.checkTailscaleConnection();
        await profileStore.fetchProfileData();

        if (filterMode.value === 'invoice' && selectedCardIds.value.length === 0 && profileStore.myCards.length > 0) {
            selectedCardIds.value = [profileStore.myCards[0].id_payment];
        }
    });

    onUnmounted(() => {
        window.removeEventListener('keydown', handleGlobalKeydown);
    });
</script>

<template>
  <div v-if="route.path === '/login'" class="login-shell">
    <slot />
  </div>

  <div v-else class="app-shell" :class="{ 'privacy-blur-active': isPrivacyBlurActive }">
    <Sidebar :isOpen="isSidebarOpen" @close="isSidebarOpen = false" />

    <div class="main-column">
      <header class="topbar">
        <div class="topbar-left">
          <button
            class="hamburger-btn"
            @click="isSidebarOpen = true"
            title="Abrir menu"
            aria-label="Abrir menu de navegação"
            :aria-expanded="isSidebarOpen"
          >
            <PhList size="22" />
          </button>
          <div class="breadcrumb" aria-label="Localização atual">
            <span class="bc-root">Somma</span>
            <span class="bc-sep" aria-hidden="true">/</span>
            <span class="bc-current">{{ currentSectionLabel }}</span>
          </div>
        </div>

        <div class="topbar-right">
          <!-- TAILSCALE VAULT STATUS PILL (Arquitetura A Zero-Trust) -->
          <div class="vault-selector-container" ref="vaultDropdownRef">
            <button
              class="vault-pill-btn"
              :class="{
                'is-unlocked': vaultStore.isVaultUnlocked,
                'is-locked': !vaultStore.isVaultUnlocked
              }"
              @click="isVaultDropdownOpen = !isVaultDropdownOpen"
              title="Status do Cofre Tailscale VPN"
              aria-label="Status do Cofre Tailscale VPN"
              :aria-expanded="isVaultDropdownOpen"
            >
              <span class="status-dot"></span>
              <PhShieldCheck v-if="vaultStore.isVaultUnlocked" size="16" weight="fill" />
              <PhLockKey v-else size="16" weight="fill" />
              <span class="vault-pill-text">
                {{
                  vaultStore.isEphemeralPaired
                    ? 'Cofre (RAM Efêmera)'
                    : vaultStore.isVaultUnlocked
                      ? 'Tailscale Vault'
                      : 'Cofre Isolado'
                }}
              </span>
              <PhCaretDown size="13" class="caret" />
            </button>

            <div class="vault-dropdown" v-if="isVaultDropdownOpen">
              <div class="vault-drop-header">
                <div class="vault-badge-icon" :class="vaultStore.isVaultUnlocked ? 'unlocked' : 'locked'">
                  <PhShieldCheck v-if="vaultStore.isVaultUnlocked" size="20" weight="duotone" />
                  <PhLockKey v-else size="20" weight="duotone" />
                </div>
                <div class="vault-drop-titles">
                  <h4>
                    {{
                      vaultStore.isEphemeralPaired
                        ? 'Sessão Efêmera na RAM Ativa'
                        : vaultStore.isVaultUnlocked
                          ? 'Tailscale VPN Conectada'
                          : 'Fora da Rede Tailscale'
                    }}
                  </h4>
                  <p>
                    {{
                      vaultStore.isEphemeralPaired
                        ? 'Dados recebidos via QR Code (ECDH + AES-256-GCM). Apagam sozinhos ao dar F5 ou fechar a aba.'
                        : vaultStore.isVaultUnlocked
                          ? 'Saldos bancários e cofrinhos sincronizados via túnel privado (.ts.net).'
                          : 'Saldos de contas e cofrinhos não são carregados fora da sua VPN.'
                    }}
                  </p>
                </div>
              </div>

              <div class="vault-meta-box">
                <div class="meta-line">
                  <span>Arquitetura</span>
                  <strong>{{ vaultStore.isEphemeralPaired ? 'RAM Only (Zero-Storage)' : 'Dual-DB (Zero-Trust)' }}</strong>
                </div>
                <div class="meta-line">
                  <span>Host Tailnet</span>
                  <strong>{{ vaultStore.tailscaleBaseUrl || 'tailnet-local.ts.net' }}</strong>
                </div>
                <div class="meta-line" v-if="vaultStore.lastCheckedAt">
                  <span>Último ping</span>
                  <strong>{{ vaultStore.lastCheckedAt }}</strong>
                </div>
              </div>

              <div class="vault-actions-list">
                <button
                  v-if="!vaultStore.isVaultUnlocked"
                  type="button"
                  class="vault-act-item primary"
                  @click="openPairingModal('receive')"
                >
                  <PhQrCode size="16" />
                  <span>Desbloquear via Celular (QR / RAM)</span>
                </button>

                <button
                  v-if="vaultStore.status === 'connected'"
                  type="button"
                  class="vault-act-item primary"
                  @click="openPairingModal('send')"
                >
                  <PhQrCode size="16" />
                  <span>Parear um PC (Enviar Cofre)</span>
                </button>

                <button
                  v-if="vaultStore.isEphemeralPaired"
                  type="button"
                  class="vault-act-item"
                  @click="handleClearEphemeralRam"
                >
                  <PhTrash size="16" />
                  <span>Limpar Cofre da RAM Agora</span>
                </button>

                <button type="button" class="vault-act-item" @click="handleToggleStealth">
                  <PhEyeSlash v-if="!vaultStore.manualStealthMode" size="16" />
                  <PhEye v-else size="16" />
                  <span>{{ vaultStore.manualStealthMode ? 'Desativar Modo Furtivo' : 'Ocultar Patrimônio Agora' }}</span>
                </button>

                <button type="button" class="vault-act-item" @click="handleToggleSimulatedNetwork">
                  <PhLockKey size="16" />
                  <span>{{ vaultStore.simulatedOffline ? 'Simular: Conectar Tailscale' : 'Simular: Desconectar VPN' }}</span>
                </button>

                <button type="button" class="vault-act-item" @click="handleReconnectVault">
                  <PhArrowsClockwise size="16" />
                  <span>Testar Conexão Tailscale</span>
                </button>
              </div>
            </div>
          </div>

          <!-- BOTÃO RÁPIDO DE PRIVACIDADE (OLHINHO GLOBAL PARA AMBIENTE DE TRABALHO) -->
          <button
            type="button"
            class="privacy-eye-btn"
            :class="{ active: isPrivacyBlurActive }"
            @click="togglePrivacyBlur"
            :title="isPrivacyBlurActive ? 'Mostrar valores na tela (Alt+P)' : 'Ocultar todos os valores na tela (Alt+P)'"
            :aria-label="isPrivacyBlurActive ? 'Mostrar valores' : 'Ocultar valores'"
          >
            <PhEyeSlash v-if="isPrivacyBlurActive" size="17" weight="bold" />
            <PhEye v-else size="17" />
          </button>

          <!-- SELETOR DE MÊS / FATURA COM SETAS RÁPIDAS < > -->
          <div class="date-selector-container" ref="dateDropdownRef">
            <div class="date-stepper-group">
              <button
                type="button"
                class="month-step-btn"
                @click="previousMonth()"
                title="Mês anterior"
                aria-label="Mês anterior"
              >
                <PhCaretLeft size="14" weight="bold" />
              </button>

              <button
                class="date-btn"
                :class="{ 'mode-invoice-active': filterMode === 'invoice' }"
                @click="isDateDropdownOpen = !isDateDropdownOpen"
                aria-label="Selecionar mês ou fatura"
                :aria-expanded="isDateDropdownOpen"
              >
                <PhCalendarBlank size="16" v-if="filterMode === 'month'" />
                <PhCreditCard size="16" v-else />
                <span>{{ filterMode === 'month' ? monthNames[selectedMonth] + ' ' + selectedYear : 'Fatura • ' + monthNames[selectedMonth] }}</span>
                <PhCaretDown size="14" class="caret" />
              </button>

              <button
                type="button"
                class="month-step-btn"
                @click="nextMonth()"
                title="Próximo mês"
                aria-label="Próximo mês"
              >
                <PhCaretRight size="14" weight="bold" />
              </button>
            </div>

            <div class="date-dropdown" v-if="isDateDropdownOpen">
              <div class="filter-tabs">
                <button
                  class="tab-btn"
                  :class="{ active: filterMode === 'month' }"
                  @click="filterStore.setFilterMode('month')"
                >
                  <PhCalendarBlank size="16" /> Por mês
                </button>
                <button
                  class="tab-btn"
                  :class="{ active: filterMode === 'invoice' }"
                  @click="filterStore.setFilterMode('invoice')"
                >
                  <PhCreditCard size="16" /> Por fatura
                </button>
              </div>

              <div v-if="filterMode === 'month'">
                <div class="year-selector">
                  <button @click="previousYear()"><PhCaretLeft size="16" weight="bold" /></button>
                  <span style="cursor: pointer;" title="Voltar para o mês atual" @click="goToCurrentMonth(); isDateDropdownOpen = false">{{ selectedYear }}</span>
                  <button @click="nextYear()"><PhCaretRight size="16" weight="bold" /></button>
                </div>
                <div class="months-grid">
                  <button 
                    v-for="(month, index) in monthNames" 
                    :key="month" 
                    @click="handleMonthSelection(index)"
                    :class="['month-btn', { active: selectedMonth === index }]"
                  >
                    {{ month }}
                  </button>
                </div>
              </div>

              <div v-else class="invoice-selector">
                <p class="selector-title">Cartões selecionados</p>
                <div class="cards-chips-grid">
                  <div 
                    v-for="card in profileStore.myCards" 
                    :key="card.id_payment"
                    class="card-chip-item"
                    :class="{ selected: selectedCardIds.includes(card.id_payment) }"
                    @click="toggleCardSelection(card.id_payment)"
                  >
                    <div class="chip-icon">
                      <PhCreditCard weight="fill" />
                    </div>
                    <div class="chip-details">
                      <span class="chip-name">{{ card.nickname }}</span>
                      <span class="chip-bank">{{ card.bank_name }}</span>
                    </div>
                    <div class="chip-check" v-if="selectedCardIds.includes(card.id_payment)">
                      <PhSparkle weight="fill" size="12" />
                    </div>
                  </div>
                </div>
                <p v-if="profileStore.myCards.length === 0" class="no-cards-msg">Nenhum cartão cadastrado.</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main class="content-area">
        <slot />
      </main>
    </div>

    <VaultPairingModal
      v-if="isPairingModalOpen"
      :initialMode="pairingModalMode"
      @close="isPairingModalOpen = false"
    />
  </div>
</template>

<style scoped>
    .app-shell {
      display: flex;
      min-height: 100vh;
      width: 100%;
      overflow-x: clip;
      background-color: var(--bg-page);
      color: var(--text-primary);
    }

    .main-column {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }

    .topbar {
      height: 64px;
      padding: 0 2.25rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background-color: color-mix(in srgb, var(--bg-page) 85%, transparent);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border-color);
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .topbar-left {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .hamburger-btn {
      display: none;
      background: transparent;
      border: 1px solid var(--border-color);
      color: var(--text-secondary);
      cursor: pointer;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 9px;
      transition: all 0.15s ease;
    }

    .hamburger-btn:hover {
      background-color: var(--bg-hover);
      color: var(--text-primary);
    }

    .breadcrumb {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
    }

    .bc-root {
      color: var(--text-muted);
      font-weight: 500;
    }

    .bc-sep {
      color: var(--text-muted);
      opacity: 0.5;
    }

    .bc-current {
      color: var(--text-primary);
      font-weight: 600;
    }

    .topbar-right {
      display: flex;
      align-items: center;
      gap: 0.65rem;
    }

    /* === TAILSCALE VAULT STATUS PILL === */
    .vault-selector-container {
      position: relative;
    }

    .vault-pill-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      height: 36px;
      padding: 0 0.85rem;
      border-radius: 10px;
      font-family: inherit;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      border: 1px solid var(--border-color);
      background-color: var(--bg-card);
      color: var(--text-secondary);
    }

    .vault-pill-btn .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
    }

    .vault-pill-btn.is-unlocked {
      border-color: rgba(16, 185, 129, 0.3);
      background-color: rgba(16, 185, 129, 0.08);
      color: var(--success-text);
    }

    .vault-pill-btn.is-unlocked .status-dot {
      background-color: var(--success-color);
      box-shadow: 0 0 8px var(--success-color);
    }

    .vault-pill-btn.is-locked {
      border-color: var(--border-color);
      background-color: var(--bg-elevated);
      color: var(--text-secondary);
    }

    .vault-pill-btn.is-locked .status-dot {
      background-color: #F59E0B;
    }

    .vault-dropdown {
      position: absolute;
      top: calc(100% + 0.5rem);
      right: 0;
      width: 310px;
      background-color: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 14px;
      padding: 1.1rem;
      box-shadow: var(--shadow-md);
      z-index: 210;
      display: flex;
      flex-direction: column;
      gap: 0.9rem;
      animation: fadeIn 0.15s ease-out;
    }

    .vault-drop-header {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
    }

    .vault-badge-icon {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .vault-badge-icon.unlocked {
      background: var(--success-bg);
      color: var(--success-text);
    }

    .vault-badge-icon.locked {
      background: rgba(245, 158, 11, 0.12);
      color: #F59E0B;
    }

    .vault-drop-titles h4 {
      margin: 0 0 0.2rem 0;
      font-size: 0.9rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .vault-drop-titles p {
      margin: 0;
      font-size: 0.76rem;
      line-height: 1.4;
      color: var(--text-secondary);
    }

    .vault-meta-box {
      background-color: var(--bg-elevated);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      padding: 0.65rem 0.85rem;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .meta-line {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.74rem;
    }

    .meta-line span {
      color: var(--text-muted);
    }

    .meta-line strong {
      color: var(--text-primary);
      font-weight: 600;
      max-width: 170px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .vault-actions-list {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .vault-act-item {
      display: flex;
      align-items: center;
      gap: 0.55rem;
      width: 100%;
      padding: 0.5rem 0.75rem;
      border-radius: 8px;
      border: 1px solid var(--border-color);
      background: transparent;
      color: var(--text-secondary);
      font-family: inherit;
      font-size: 0.8rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .vault-act-item:hover {
      background-color: var(--bg-hover);
      color: var(--text-primary);
    }

    .vault-act-item.primary {
      background-color: var(--primary-subtle);
      color: var(--primary-color);
      border-color: rgba(99, 102, 241, 0.25);
      font-weight: 600;
    }

    /* === SELETOR DE DATA === */
    .date-selector-container {
      position: relative;
    }

    .privacy-eye-btn {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      border: 1px solid var(--border-color);
      background-color: var(--bg-card);
      color: var(--text-secondary);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.15s ease;
      padding: 0;
    }

    .privacy-eye-btn:hover {
      border-color: var(--primary-color);
      color: var(--text-primary);
    }

    .privacy-eye-btn.active {
      background-color: var(--primary-subtle);
      border-color: var(--primary-color);
      color: var(--primary-color);
    }

    .date-stepper-group {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .month-step-btn {
      width: 30px;
      height: 36px;
      border-radius: 9px;
      border: 1px solid var(--border-color);
      background-color: var(--bg-card);
      color: var(--text-secondary);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.15s ease;
      padding: 0;
    }

    .month-step-btn:hover {
      border-color: var(--primary-color);
      color: var(--text-primary);
    }

    .date-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background-color: var(--bg-card);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      padding: 0.45rem 0.9rem;
      border-radius: 10px;
      cursor: pointer;
      font-weight: 600;
      font-size: 0.85rem;
      font-family: inherit;
      transition: all 0.15s ease;
      height: 36px;
    }

    .date-btn:hover {
      border-color: var(--text-muted);
      background-color: var(--bg-hover);
    }

    .date-btn .caret {
      color: var(--text-secondary);
    }
    
    .date-dropdown {
      position: absolute;
      top: calc(100% + 0.5rem);
      right: 0;
      background-color: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 14px;
      padding: 1rem;
      box-shadow: var(--shadow-md);
      z-index: 200;
      width: 280px;
      animation: fadeIn 0.15s ease-out;
    }

    .year-selector {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.85rem;
      padding: 0 0.25rem;
      font-weight: 700;
      font-size: 0.95rem;
      color: var(--text-primary);
    }

    .year-selector button {
      background: transparent;
      border: 1px solid var(--border-color);
      color: var(--text-secondary);
      cursor: pointer;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 7px;
      transition: all 0.15s;
    }

    .year-selector button:hover {
      color: var(--text-primary);
      background-color: var(--bg-hover);
    }

    .months-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.35rem;
    }

    .month-btn {
      background: transparent;
      border: 1px solid transparent;
      color: var(--text-secondary);
      padding: 0.45rem;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 500;
      font-size: 0.825rem;
      transition: all 0.15s;
      font-family: inherit;
    }

    .month-btn:hover {
      background-color: var(--bg-hover);
      color: var(--text-primary);
    }

    .month-btn.active {
      background-color: var(--primary-subtle);
      color: var(--primary-color);
      border-color: rgba(99, 102, 241, 0.3);
      font-weight: 600;
    }

    .filter-tabs {
      display: flex;
      background-color: var(--bg-page);
      padding: 3px;
      border-radius: 9px;
      border: 1px solid var(--border-color);
      margin-bottom: 0.85rem;
      gap: 3px;
    }

    .tab-btn {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 0.4rem;
      border: none;
      background: transparent;
      color: var(--text-secondary);
      font-weight: 600;
      font-size: 0.8rem;
      cursor: pointer;
      border-radius: 6px;
      transition: all 0.15s;
      justify-content: center;
    }

    .tab-btn.active {
      background-color: var(--primary-color);
      color: white;
    }
  
    .invoice-selector {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }

    .selector-title {
      font-size: 0.72rem;
      color: var(--text-secondary);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin: 0 0 0.2rem 0;
    }

    .cards-chips-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0.45rem;
      max-height: 240px;
      overflow-y: auto;
    }

    .card-chip-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: 10px;
      border: 1px solid var(--border-color);
      background-color: var(--bg-page);
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .card-chip-item:hover {
      border-color: var(--text-muted);
    }

    .card-chip-item.selected {
      border-color: var(--primary-color);
      background: var(--primary-subtle);
    }

    .chip-icon {
      width: 30px;
      height: 30px;
      background-color: var(--bg-card);
      border-radius: 7px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-secondary);
      border: 1px solid var(--border-color);
    }

    .card-chip-item.selected .chip-icon {
      background-color: var(--primary-color);
      color: white;
      border-color: var(--primary-color);
    }

    .chip-details {
      display: flex;
      flex-direction: column;
      flex: 1;
    }

    .chip-name {
      font-size: 0.825rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    .chip-bank {
      font-size: 0.7rem;
      color: var(--text-secondary);
    }

    .chip-check {
      color: var(--primary-color);
    }

    .no-cards-msg {
      font-size: 0.8rem;
      color: var(--text-secondary);
      text-align: center;
      padding: 1rem;
    }

    .content-area {
      flex: 1;
      width: 100%;
      padding: 2rem 2.25rem 6rem;
      animation: fadeIn 0.25s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @media (max-width: 1024px) {
      .hamburger-btn {
        display: flex;
        width: 40px;
        height: 40px;
      }
      .topbar {
        padding: 0 1rem;
        gap: 0.5rem;
      }
      .topbar-left {
        min-width: 0;
        flex: 1;
      }
      .breadcrumb {
        min-width: 0;
        overflow: hidden;
      }
      .bc-current {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .content-area {
        padding: 1.25rem 1rem calc(5.5rem + env(safe-area-inset-bottom, 0px));
      }
    }

    @media (max-width: 640px) {
      .bc-root,
      .bc-sep,
      .vault-pill-text {
        display: none;
      }
      .vault-pill-btn {
        padding: 0 0.65rem;
        height: 38px;
      }
      .date-btn {
        padding: 0.4rem 0.7rem;
        font-size: 0.8rem;
        height: 38px;
        white-space: nowrap;
      }
      .vault-dropdown,
      .date-dropdown {
        position: fixed;
        top: 68px;
        left: 12px;
        right: 12px;
        width: auto;
        max-width: calc(100vw - 24px);
      }
    }
</style>
