<script setup lang="ts">
    import { ref, onMounted } from 'vue';
    import { RouterLink, useRouter } from 'vue-router'
    import { supabase } from '../services/supabase';
    import { PhSignOut, PhTrendUp, PhHouse, PhPlus, PhTag, PhSun, PhMoon } from '@phosphor-icons/vue'

    const isDark = ref(false);
    const router = useRouter();

    onMounted(() => {
        // Verifica o tema salvo no localStorage
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            isDark.value = true;
            document.body.classList.add('dark')
        }
    });

    const handleLogout = async () => {
      try {
        // 1. Chama o Supabase para destruir a sessão
        const { error } = await supabase.auth.signOut();
        
        if (error) throw error;

        // 2. Redireciona para o Login imediatamente
        router.push('/login');
        
      } catch (error) {
        console.error('Erro ao sair:', error);
        alert('Erro ao tentar sair. Tente novamente.');
      }
    };

    const toggleTheme = () => {
        isDark.value = !isDark.value;
        if (isDark.value) {
            document.body.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.body.classList.remove('dark');
            localStorage.removeItem('theme');
        }
    };

</script>

<template>
  <div class="layout-wrapper">
    <nav class="navbar">
      <div class="logo">
        <PhTrendUp size="28" weight="fill" class="logo-icon" />
        <span>Finance <span class="ai">AI</span></span>
      </div>

    <ul class="nav-links">
        <li>
            <RouterLink to="/" active-class="active">
                <PhHouse size="20" /> Dashboard
            </RouterLink>
        </li>
        <li>
            <RouterLink to="/transactions" active-class="active">
                <PhPlus size="20" weight="bold" /> Compras
            </RouterLink>
        </li>
        <li>
        <RouterLink to="/new-category" active-class="active">
            <PhTag size="20" /> Categorias
        </RouterLink>
        </li>
      </ul>

      <div class="right-actions">

        <button class="theme-btn" @click="toggleTheme" title="Alternar Tema">
          <PhSun v-if="!isDark" size="22" weight="fill"/>
          <PhMoon v-else size="22" weight="fill" />
        </button>

        <button @click="handleLogout" class="logout-btn">
          <PhSignOut size="20" />
          Sair
        </button>

      </div>
    </nav>

    <main class="content-area">
      <slot />
    </main>
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

    .theme-btn {
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
      
      .logo { justify-self: start; }

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