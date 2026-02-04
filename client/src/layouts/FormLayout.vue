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
    background-color: #F8FAFC;
    padding: 2rem;
    box-sizing: border-box;
    min-height: 100vh;
    min-height: 100dvh;
    overflow-y: auto;
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
    color: #475569;
}

.required { color: #EF4444; }

.input-field {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 1px solid #E2E8F0;
    border-radius: 8px;
    font-size: 1rem;
    color: #1E293B;
    background-color: #F8FAFC;
    transition: all 0.2s;
    outline: none;
}

.input-field:focus {
    background-color: white;
    border-color: #6366F1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.btn-primary {
    width: 100%;
    padding: 0.9rem;
    background: linear-gradient(135deg, #6366F1 0%, #4F46E5 100%);
    color: white;
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
</style>