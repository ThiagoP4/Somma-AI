<script setup lang="ts">
    import { ref, onMounted, computed } from 'vue';
    import { useRoute } from 'vue-router'
    import { PhCalendarBlank, PhCaretDown, PhCaretLeft, PhCaretRight, PhCreditCard, PhList, PhSparkle } from '@phosphor-icons/vue'
    import { storeToRefs } from 'pinia';
    import { onClickOutside } from '@vueuse/core';
    import Sidebar from '../components/Sidebar.vue';
    import { useFilterStore } from '../stores/useFilterStore';
    import { useProfileStore } from '../stores/useProfileStore';

    const route = useRoute();
    const isSidebarOpen = ref(false);

    const filterStore = useFilterStore();
    const profileStore = useProfileStore();

    const { selectedMonth, selectedYear, filterMode, selectedCardIds } = storeToRefs(filterStore);
    const { selectMonth, nextYear, previousYear, monthNames, toggleCardSelection } = filterStore;
    const isDateDropdownOpen = ref(false);
    const dateDropdownRef = ref<HTMLElement | null>(null);

    const currentSectionLabel = computed(() => {
        const map: Record<string, string> = {
            '/': 'Visão Geral',
            '/dashboard': 'Dashboard Analítico',
            '/records': 'Registros Financeiros',
            '/investments': 'Investimentos & Cofrinhos',
            '/copilot': 'Copilot IA',
            '/profile': 'Meu Perfil',
            '/assinaturas': 'Assinaturas & Recorrências'
        };
        return map[route.path] || 'Workspace';
    });

    onClickOutside(dateDropdownRef, () => {
        isDateDropdownOpen.value = false;
    });

    const handleMonthSelection = (index: number) => {
        selectMonth(index);
        isDateDropdownOpen.value = false;
    };

    onMounted(async () => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark' || !savedTheme) {
            document.body.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.body.classList.remove('dark');
        }
        await profileStore.fetchProfileData();

        if (filterMode.value === 'invoice' && selectedCardIds.value.length === 0 && profileStore.myCards.length > 0) {
            selectedCardIds.value = [profileStore.myCards[0].id_payment];
        }
    });
</script>

<template>
  <!-- Se for tela de login, renderiza direto sem Shell -->
  <div v-if="route.path === '/login'" class="login-shell">
    <slot />
  </div>

  <!-- App Shell Desktop: Sidebar Fixa na Esquerda + Coluna Principal na Direita -->
  <div v-else class="app-shell">
    <Sidebar :isOpen="isSidebarOpen" @close="isSidebarOpen = false" />

    <div class="main-column">
      <header class="topbar">
        <div class="topbar-left">
          <button class="hamburger-btn" @click="isSidebarOpen = true" title="Abrir menu">
            <PhList size="22" />
          </button>
          <div class="breadcrumb">
            <span class="bc-root">Somma</span>
            <span class="bc-sep">/</span>
            <span class="bc-current">{{ currentSectionLabel }}</span>
          </div>
        </div>

        <div class="topbar-right">
          <div class="date-selector-container" ref="dateDropdownRef">
            <button class="date-btn" :class="{ 'mode-invoice-active': filterMode === 'invoice' }" @click="isDateDropdownOpen = !isDateDropdownOpen">
              <PhCalendarBlank size="16" v-if="filterMode === 'month'" />
              <PhCreditCard size="16" v-else />
              <span>{{ filterMode === 'month' ? monthNames[selectedMonth] + ' ' + selectedYear : 'Fatura • ' + monthNames[selectedMonth] }}</span>
              <PhCaretDown size="14" class="caret" />
            </button>

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
                  <span>{{ selectedYear }}</span>
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
  </div>
</template>

<style scoped>
    .app-shell {
      display: flex;
      min-height: 100vh;
      width: 100%;
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
      gap: 0.75rem;
    }

    .date-selector-container {
      position: relative;
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
      }
      .topbar {
        padding: 0 1.25rem;
      }
      .content-area {
        padding: 1.5rem 1.25rem 5.5rem;
      }
    }
</style>
