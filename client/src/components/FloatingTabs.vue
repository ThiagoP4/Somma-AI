<script setup lang="ts">
import { PhShoppingCart, PhTrendUp, PhTag, PhCaretLeft, PhCaretRight } from '@phosphor-icons/vue';

defineProps<{ tabs: string[]; currentTab: string; }>();
const emit = defineEmits<{ 
    (e: 'move', direction: number): void;
    (e: 'select', tab: string): void;
    }>();

const tabInfo: Record<string, any> = {
    compras: { icon: PhShoppingCart, label: 'Compras' },
    entradas: { icon: PhTrendUp, label: 'Entradas' },
    categorias: { icon: PhTag, label: 'Categorias' }
};
</script>

<template>
    <div class="sub-nav-container">
        <button class="nav-arrow" @click="emit('move', -1)" :disabled="tabs.indexOf(currentTab) === 0">
            <PhCaretLeft size="20" weight="bold" />
        </button>
        <div class="nav-indicator-bar">
            <button 
                v-for="aba in tabs" 
                :key="aba" 
                class="tab-icon-btn" 
                :class="{ active: currentTab === aba }"
                @click="emit('select', aba)"
                :title="tabInfo[aba]?.label"
            >
                <component :is="tabInfo[aba].icon" size="22" :weight="currentTab === aba ? 'fill' : 'regular' " />
            </button>
        </div>
        <button class="nav-arrow" @click="emit('move', 1)" :disabled="tabs.indexOf(currentTab) === tabs.length - 1">
            <PhCaretRight size="20" weight="bold" />
        </button>
    </div>
</template>

<style scoped>

    .sub-nav-container {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        gap: 1.5rem;
        
        /* FIXAÇÃO NA TELA */
        position: fixed; /* Isso tira o elemento do fluxo e cola na tela */
        bottom: 2rem;    /* Distância da borda inferior */
        left: 50%;       /* Centraliza horizontalmente */
        transform: translateX(-50%); /* Ajuste fino da centralização */
        
        z-index: 999; /* Garante que fique acima de qualquer tabela ou modal */
        
        /* ESTILO PÍLULA FLUTUANTE */
        padding: 0.8rem 2rem;
        background-color: var(--bg-card); /* Deve ser uma cor sólida, ex: #1e293b */
        border: 1px solid var(--border-color);
        border-radius: 999px; /* Arredondamento máximo (Pill shape) */
        box-shadow: 0 15px 35px rgba(0, 0, 0, 0.5); /* Sombra forte para dar profundidade */
        backdrop-filter: blur(10px); /* Opcional: efeito de vidro se o fundo tiver transparência */
    }

    .nav-arrow {
        background: transparent;
        border: none;
        color: var(--text-secondary);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: color 0.2s, transform 0.2s;
        padding: 4px;
    }

    .nav-arrow:hover:not(:disabled) {
        color: var(--text-primary);
        transform: scale(1.1);
    }

    .nav-arrow:disabled {
        opacity: 0.2;
        cursor: not-allowed;
    }

    .nav-indicator-bar {
        display: flex;
        gap: 8px;
    }

    .tab-icon-btn {
            background: transparent;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            padding: 8px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
        }

        .tab-icon-btn:hover {
            color: var(--text-primary);
        }

        .tab-icon-btn.active {
            background: var(--primary-color);
            color: var(--bg-card);
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
            transform: scale(1.1);
        }

</style>