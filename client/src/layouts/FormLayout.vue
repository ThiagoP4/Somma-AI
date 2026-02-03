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
/* Apenas estrutura do card e container */
.page-container {
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: #F8FAFC;
    padding: 2rem;
    min-height: 100vh;
}

.form-card {
    background: white;
    width: 100%;
    max-width: 480px;
    padding: 2.5rem;
    border-radius: 16px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.05);
    border: 1px solid #F1F5F9;
    transition: all 0.3s ease;
}

.card-header {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 2rem;
}

.header-text h2 { margin: 0; font-size: 1.5rem; color: #1E293B; font-weight: 700; }
.subtitle { margin: 4px 0 0 0; color: #64748B; font-size: 0.9rem; }

.back-btn {
    background: transparent;
    border: 1px solid #E2E8F0;
    border-radius: 8px;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #64748B;
    transition: all 0.2s;
}
.back-btn:hover { background-color: #F1F5F9; color: #1E293B; border-color: #CBD5E1; }

/* Desktop Responsivo */
@media (min-width: 768px) {
    .form-card {
        max-width: 700px;
        padding: 4rem;
        min-height: 500px;
        display: flex;
        flex-direction: column;
        gap: 3rem; /* Espaço entre Header e Form */
    }
    
    .card-content {
        display: flex;
        flex-direction: column;
        flex: 1; /* Faz o form ocupar a altura toda */
    }
}
</style>