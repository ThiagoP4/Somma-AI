<script setup lang="ts">
import { useProfileStore } from '../../stores/useProfileStore';
const profileStore = useProfileStore();
</script>

<template>
    <div class="profile-card">
        <div class="card-header-actions">
            <h2>Meus Pagamentos</h2>
            <button class="btn-outline-small" @click="$emit('add')">+ Adicionar</button>
        </div>
        
        <div class="profile-card-content">
            <!-- O Vue Renderiza automaticamente os cartões do banco aqui! -->
            <div v-if="profileStore.myCards && profileStore.myCards.length > 0" class="cards-list">
                <div v-for="card in profileStore.myCards" :key="card.id_payment" class="payment-card-item">
                    <p class="card-name">{{ card.card_name }}</p>
                    <p class="card-type">{{ card.card_type }}</p>
                </div>
            </div>
            
            <!-- Ou mostra a mensagem triste de vazio -->
            <div v-else class="empty-state">
                <p>Nenhum método de pagamento cadastrado</p>
            </div>
        </div>
    </div>
</template>

<style scoped>
    .profile-card { background: var(--bg-card); border-radius: 1rem; padding: 2rem; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
    .profile-card h2 { color: var(--text-primary); font-size: 1.25rem; font-weight: 600; margin-bottom: 0;}
    
    .card-header-actions { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--border-color); }
    
    .btn-outline-small { background: transparent; border: 1px solid var(--border-color); color: var(--text-secondary); padding: 0.4rem 0.8rem; border-radius: 0.5rem; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; }
    .btn-outline-small:hover { border-color: var(--primary-color); color: var(--primary-color); }

    .empty-state { text-align: center; color: var(--text-secondary); padding: 2rem 0; font-size: 0.95rem; }
    
    .cards-list { display: flex; flex-direction: column; gap: 1rem; }
    .payment-card-item { padding: 1rem; border: 1px solid var(--border-color); border-radius: 0.5rem; background: rgba(255,255,255,0.02);}
    .card-name { font-weight: bold; margin: 0 0 0.25rem 0; color: var(--text-primary); }
    .card-type { color: var(--text-secondary); font-size: 0.85rem; margin: 0; text-transform: capitalize; }
</style>
