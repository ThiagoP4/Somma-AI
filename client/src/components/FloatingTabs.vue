<script setup lang="ts">
import { PhShoppingCart, PhTrendUp, PhTag } from '@phosphor-icons/vue';

defineProps<{ tabs: string[]; currentTab: string; }>();
const emit = defineEmits<{ 
    (e: 'move', direction: number): void;
    (e: 'select', tab: string): void;
}>();

const tabInfo: Record<string, { icon: any; label: string }> = {
    compras: { icon: PhShoppingCart, label: 'Compras' },
    entradas: { icon: PhTrendUp, label: 'Entradas' },
    categorias: { icon: PhTag, label: 'Categorias' }
};
</script>

<template>
    <div class="floating-dock">
        <button 
            v-for="aba in tabs" 
            :key="aba" 
            class="dock-item" 
            :class="{ active: currentTab === aba }"
            @click="emit('select', aba)"
        >
            <component :is="tabInfo[aba]?.icon" size="18" :weight="currentTab === aba ? 'fill' : 'regular'" />
            <span class="dock-label">{{ tabInfo[aba]?.label }}</span>
        </button>
    </div>
</template>

<style scoped>
    .floating-dock {
        display: flex;
        align-items: center;
        gap: 4px;
        position: fixed;
        bottom: 1.5rem;
        left: 50%;
        transform: translateX(-50%);
        z-index: 999;
        padding: 5px;
        background-color: color-mix(in srgb, var(--bg-card) 88%, transparent);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid var(--border-color);
        border-radius: 14px;
        box-shadow: var(--shadow-md);
    }

    .dock-item {
        background: transparent;
        border: 1px solid transparent;
        color: var(--text-secondary);
        cursor: pointer;
        padding: 0.5rem 1rem;
        border-radius: 10px;
        display: flex;
        align-items: center;
        gap: 0.45rem;
        font-family: inherit;
        font-size: 0.85rem;
        font-weight: 500;
        transition: all 0.15s ease;
    }

    .dock-item:hover {
        color: var(--text-primary);
        background-color: var(--bg-hover);
    }

    .dock-item.active {
        background: var(--primary-color);
        color: var(--text-inverse);
        font-weight: 600;
        box-shadow: 0 2px 10px var(--primary-glow);
    }

    @media (max-width: 480px) {
        .dock-item {
            padding: 0.5rem 0.8rem;
            font-size: 0.8rem;
        }
    }
</style>
