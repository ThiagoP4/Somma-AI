<script setup lang="ts">
import { useRouter } from 'vue-router';
import { PhArrowLeft } from '@phosphor-icons/vue';

defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' }
});

const router = useRouter();
const goBack = () => router.push('/');
</script>

<template>
  <div class="page-container">
    <div class="form-card">
      
      <div class="card-header">
        <button class="back-btn" @click="goBack" title="Voltar">
          <PhArrowLeft size="24" weight="bold" />
        </button>
        <div class="header-text">
          <h2>{{ title }}</h2>
          <p v-if="subtitle" class="subtitle">{{ subtitle }}</p>
        </div>
      </div>

      <div class="card-content">
        <slot></slot>
      </div>

    </div>
  </div>
</template>

<style scoped>
.page-container {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    width: 100%;
}

.form-card {
    background: var(--bg-card);
    width: 100%;
    max-width: 500px;
    padding: 2.5rem;
    border-radius: 16px;
    box-shadow: 0 4px 20px var(--shadow-color);
    border: 1px solid var(--border-color);
    transition: all 0.3s ease;
    margin-top: 1rem;
}

.card-header {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 2rem;
}

.header-text h2 { margin: 0; font-size: 1.5rem; color: var(--text-primary); font-weight: 700; }
.subtitle { margin: 4px 0 0 0; color: var(--text-secondary); font-size: 0.9rem; }

.back-btn {
    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--text-secondary);
    transition: all 0.2s;
}
.back-btn:hover { background-color: var(--bg-page); color: var(--text-primary); border-color: var(--text-secondary); }

@media (max-width: 640px) {
    .form-card {
        padding: 1.25rem; /* Reduz de 40px para 20px */
        margin-top: 0;    /* Cola um pouco mais no topo */
    }

    .card-header {
        margin-bottom: 1.5rem; /* Aproxima o título do formulário */
        gap: 0.75rem;
    }

    .header-text h2 {
        font-size: 1.25rem; /* Título menor (20px) */
    }

    /* Ajuste o botão de voltar para não ficar gigante */
    .back-btn {
        width: 36px;
        height: 36px;
    }
}

</style>

<style>
.form-group {
    margin-bottom: 2.5rem;
}

.form-group label {
    display: block;
    margin-bottom: 0.8rem;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-secondary);
}

.required { color: #B91C1C; }

.input-field {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    font-size: 1rem;
    color: var(--text-primary);
    background-color: var(--bg-input);
    transition: all 0.2s;
    color-scheme: light;
    outline: none;
}

body.dark .input-field {
    color-scheme: dark;
}

body.dark .btn-whatsapp {
    background-color: transparent !important; /* !important garante que sobrescreva o scoped */
    color: #34D399 !important;
    border-color: #059669 !important;
}

body.dark .btn-whatsapp:hover {
    background-color: rgba(16, 185, 129, 0.1) !important;
}

.input-field:focus {
    background-color: var(--bg-card);
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.input-field::placeholder {
    color: var(--text-secondary); /* Importante para não ficar invisível no dark */
    opacity: 0.7;
}

.btn-primary {
    width: 100%;
    padding: 0.9rem;
    background: var(--primary-color);
    color: var(--text-inverse);
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    transition: transform 0.1s, box-shadow 0.2s;
}

.btn-primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);
}


@media (max-width: 640px) {
    .form-group {
        margin-bottom: 1.5rem; 
    }
    
    .btn-primary {
        padding: 0.75rem;
    }
}
</style>