<script setup lang="ts">
    import { ref, onMounted } from 'vue';
    import { RouterLink, useRoute } from 'vue-router'
    import { PhTrendUp, PhHouse, PhFolders, PhSparkle, PhCalendarBlank, PhCaretDown, PhCaretLeft, PhCaretRight, PhList } from '@phosphor-icons/vue'
    import { useDateStore } from '../stores/useDateStore';
    import { storeToRefs } from 'pinia';
    import { onClickOutside } from '@vueuse/core';
    import Sidebar from '../components/Sidebar.vue';


    const isDark = ref(false);
    const route = useRoute();
    const dateStore = useDateStore();
    const isSidebarOpen = ref(false);

    const { selectedMonth, selectedYear } = storeToRefs(dateStore);

    const { selectMonth, nextYear, previousYear, monthNames } = dateStore;
    const isDateDropdownOpen = ref(false);
    const dateDropdownRef = ref<HTMLElement | null>(null);

    onClickOutside(dateDropdownRef, () => {
        isDateDropdownOpen.value = false;
    })

    const handleMonthSelection = (index: number) => {
        selectMonth(index);
        isDateDropdownOpen.value = false;
    }

    onMounted(() => {
        // Verifica o tema salvo no localStorage
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            isDark.value = true;
            document.body.classList.add('dark')
        }
    });
</script>

<template>
  <div class="layout-wrapper">
    <nav class="navbar" v-if="route.path !== '/login'">
      <div class="left-actions">
        <button class="hamburger-btn" @click="isSidebarOpen = true">
          <PhList size="26" />
        </button>
        <div class="logo">
          <PhTrendUp size="28" weight="fill" class="logo-icon" />
          <span>Finance <span class="ai">AI</span></span>
        </div>
      </div>


    <ul class="nav-links">
        <li>
            <RouterLink to="/" active-class="active">
                <PhHouse size="20" /> Dashboard
            </RouterLink>
        </li>
        <li>
            <RouterLink to="/records" active-class="active">
                <PhFolders size="20" weight="bold" /> Registros
            </RouterLink>
        </li>
        <li>
        <RouterLink to="/copilot" active-class="active">
            <PhSparkle size="20" /> Modo IA
        </RouterLink>
        </li>
      </ul>

      <div class="right-actions">

        <div class="date-selector-container" ref="dateDropdownRef">
          <button class="date-btn" @click="isDateDropdownOpen = !isDateDropdownOpen">
            <PhCalendarBlank size="18" />
            <span>{{ monthNames[selectedMonth] }} {{ selectedYear }}</span>
            <PhCaretDown size="16" />
          </button>
          <div class="date-dropdown" v-if="isDateDropdownOpen">
            <div class="year-selector">
              <button @click="previousYear()"><PhCaretLeft size="18" weight="bold" /></button>
                    <span>{{ selectedYear }}</span>
                    <button @click="nextYear()"><PhCaretRight size="18" weight="bold" /></button>
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

        </div>
      </div>
    </nav>

    <main class="content-area">
      <slot />
    </main>
    <Sidebar :isOpen="isSidebarOpen" @close="isSidebarOpen = false" />
  </div>
</template>

<style scoped>

    .layout-wrapper {
      font-family: 'Inter', sans-serif;
      background-color: var(--bg-page);
      color: var(--text-primary);
      min-height: 100vh;
    }

    .navbar {
      background-color: var(--bg-card);
      height: 70px;
      padding: 0 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border-color);
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: 0 4px 6px -1px var(--shadow-color);
    }

    .left-actions {
      display: flex;
      align-items: center;
      gap: 1.5rem;
    }

    .hamburger-btn {
      background: transparent;
      border: none;
      color: var(--text-primary);
      cursor: pointer;
      display: flex;
      align-items: center;
      padding: 4px;
      border-radius: 6px;
      transition: background-color 0.2s;
    }

    .hamburger-btn:hover {
        background-color: var(--bg-page);
    }

    .logo {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--text-primary);
        letter-spacing: -0.5px;
    }
    
    .logo-icon { color: var(--primary-color); }
    .ai { color: var(--primary-color); }

    .nav-links {
      list-style: none;
      display: flex;
      gap: 2rem;
      margin: 0;
      padding: 0;
    }

    .nav-links a {
      text-decoration: none;
      color: var(--text-primary);
      font-weight: 500;
      font-size: 0.95rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.2s ease;
      padding: 0.5rem 0;
      border-bottom: 2px solid transparent;
    }

    .nav-links a:hover { color: var(--primary-color); }
    
    .nav-links a.active {
      color: var(--text-primary);
      border-bottom: 2px solid var(--primary-color);
      font-weight: 600;
    }

    .right-actions {
      display: flex;
      align-items: center;
      gap: 1rem;
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
      padding: 0.5rem 1rem;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      font-family: 'Inter', sans-serif;
      transition: all 0.2s;
    }

    .date-btn:hover {
      background-color: var(--bg-page);
      border-color: var(--text-secondary);
    }

    .date-dropdown {
      position: absolute;
      top: calc(100% + 0.5rem);
      right: 0;
      background-color: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 1rem;
      box-shadow: 0 10px 25px rgba(0,0,0,0.3);
      z-index: 200;
      width: 250px;
      animation: fadeIn 0.15s ease-out;
    }

    .year-selector {
      display: flex;
      justify-content: center;
      align-items: center;
      margin-bottom: 1rem;
      font-weight: 700;
      font-size: 1.1rem;
      color: var(--text-primary);
    }

    .year-selector button {
      background: transparent;
      border: none;
      color: var(--text-secondary);
      cursor: pointer;
      padding: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      transition: all 0.2s;
    }

    .year-selector button:hover {
      color: var(--text-primary);
      background-color: var(--bg-page);
    }

    .months-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.5rem;
    }

    .month-btn {
      background: transparent;
      border: none;
      color: var(--text-primary);
      padding: 0.5rem;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.2s;
      font-family: 'Inter', sans-serif;
    }

    .month-btn:hover {
      background-color: var(--bg-page);
    }

    .month-btn.active {
      background-color: var(--primary-color);
      color: var(--bg-card);
    }

/*    .theme-btn {
      background: transparent;
      border: none;
      cursor: pointer;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 8px;
      border-radius: 50%;
      transition: all 0.2s;
    }

    .theme-btn:hover {
      background-color: var(--bg-page);
      color: var(--primary-color);
      transform: rotate(15deg);
    }

    .logout-btn {
      background: transparent;
      border: 1px solid var(--border-color);
      padding: 0.5rem 1rem;
      border-radius: 8px;
      color: #B91C1C;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-family: 'Inter', sans-serif;
      transition: all 0.2s;
    }

    .logout-btn:hover {
      background-color: rgba(239, 68, 68, 0.1);
      border-color: #FECACA;
      color: #B91C1C;
    }
      */
    
    .content-area {
      padding: 2rem;
      max-width: 1200px;
      margin: 0 auto;
      animation: fadeIn 0.5s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @media (max-width: 768px) {
      /* 1. Reduzir padding lateral do menu */
      .navbar {
        height: 60px; /* Reduz de 70px para 60px */
        padding: 0 1rem !important;
        display: grid; 
        grid-template-columns: 1fr auto 1fr; /* Divide em 3 partes: Esquerda Livre, Meio Fixo, Direita Livre */
        align-items: center;
      }
      .content-area {
        padding: 1rem !important; /* Reduz de 2rem para 1rem */
      }
      /* 2. Esconder o texto "Finance AI" do logo (deixa só o ícone) */
      .logo span, .nav-links a span, .logout-btn span {
          display: none; 
      }
      
      .left-actions { justify-self: start; }

      .logo-icon { width: 24px; height: 24px; }
      
      /* 3. Ajustar os links do meio (Dashboard, etc) */
      .nav-links {
          justify-self: center;
          gap: 1.5rem; /* Diminui o espaço entre eles */
      }

      .nav-links a {
          font-size: 0; /* TRUQUE: Esconde o texto do link */
      }
      
      .nav-links a svg {
          /* Aumenta um pouco o ícone já que o texto sumiu */
          font-size: 22px !important; 
      }

      /* 4. Ajustar botão de Sair */
      .logout-btn {
          font-size: 0; /* Esconde texto "Sair" */
          padding: 0.5rem; /* Botão quadrado */
      }
      
      /* 5. Ajustar container da direita */
      .right-actions {
          justify-self: end;
      }
    }
    @media (max-width: 640px) {
      .content-area {
        padding: 1rem !important; /* Reduz de 2rem para 1rem no celular */
      }
      .navbar {
        padding: 0 1rem !important; /* Ajusta o menu também */
      }
    }
</style>