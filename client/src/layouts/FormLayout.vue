<script setup lang="ts">
import { PhX } from '@phosphor-icons/vue';

defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' }
});

const emit = defineEmits(['close']);
const goBack = () => emit('close');
</script>

<template>
    <Teleport to="body">
  <div class="modal-overlay" @click.self="goBack">
    <div class="form-card">
      
      <div class="card-header">
        <div class="header-text">
            <h2>{{ title }}</h2>
            <p v-if="subtitle" class="subtitle">{{ subtitle }}</p>
        </div>
        <button class="back-btn" @click="goBack" title="Fechar">
          <PhX size="24" weight="bold" />
        </button>
      </div>

      <div class="card-content">
        <slot></slot>
      </div>
    </div>
  </div>
  
</Teleport>
</template>

<style scoped>
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(3px);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
    padding: 1rem;
    animation: fadeIn 0.2s ease-out;
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
    margin-top: 0;
    max-height: 90vh;
    overflow-y: auto;
    animation: slideUp 0.3s ease-out;
}

.card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
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

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

@media (max-width: 640px) {
    .form-card {
        padding: 1.25rem; /* Reduz de 40px para 20px */
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

.required { color: var(--danger-color); }

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