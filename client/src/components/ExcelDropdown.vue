<script setup lang="ts">
    import { ref } from 'vue';
    import { 
        PhMicrosoftExcelLogo, PhX, PhCalendarBlank, 
        PhDownloadSimple, PhUploadSimple 
    } from '@phosphor-icons/vue';

    defineProps<{ currentMonth: string }>();
    
    const emit = defineEmits<{
        (e: 'export', scope: 'month' | 'all'): void;
        (e: 'import', scope: 'month' | 'all'): void;
    }>();

    const isOpen = ref(false);
    const excelScope = ref<'month' | 'all'>('month');

    const handleExport = () => {
        emit('export', excelScope.value);
        isOpen.value = false;
    };

    const handleImport = () => {
        emit('import', excelScope.value);
        isOpen.value = false;
    };
</script>

<template>
    <div class="excel-dropdown-wrapper">
        <button 
            class="btn-secondary"
            @click="isOpen = !isOpen"
            :class="{ 'btn-active': isOpen }"
        >
            <PhMicrosoftExcelLogo size="18" /> Excel
        </button>
        
        <div v-if="isOpen" class="excel-dropdown">
            
            <div class="dropdown-header">
                <div class="header-title">
                    <PhMicrosoftExcelLogo size="20" weight="fill" color="#10B981" />
                    <span>Gerenciar Excel</span>
                </div>
                <button class="close-btn" @click="isOpen = false">
                    <PhX size="16" />
                </button>
            </div>

            <div class="scope-section">
                <span class="section-label">Escopo dos dados</span>
                <div class="scope-selector">
                    <button 
                        class="scope-btn"
                        :class="{ active: excelScope === 'month' }"
                        @click="excelScope = 'month'"
                    >
                        <PhCalendarBlank size="16" /> 
                        <span class="month-text">{{ currentMonth }}</span>
                    </button>
                    <button 
                        class="scope-btn"
                        :class="{ active: excelScope === 'all' }"
                        @click="excelScope = 'all'"
                    >
                        <PhCalendarBlank size="16" /> Todos
                    </button>
                </div>
            </div>

            <div class="action-section">
                <button class="action-card export" @click="handleExport">
                    <PhDownloadSimple size="22" />
                    <div class="action-texts">
                        <span class="title">Exportar registros</span>
                        <span class="subtitle">Baixar planilha Excel com compras e entradas</span>
                    </div>
                </button>
                <button class="action-card import" @click="handleImport">
                    <PhUploadSimple size="22" />
                    <div class="action-texts">
                        <span class="title">Importar registros</span>
                        <span class="subtitle">Carregar planilha Excel exportada anteriormente</span>
                    </div>
                </button>
            </div>
        </div>
        
        <div v-if="isOpen" class="dropdown-backdrop" @click="isOpen = false"></div>
    </div>
</template>

<style scoped>
.excel-dropdown-wrapper {
    position: relative;
}

.dropdown-backdrop {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    z-index: 98;
}

.excel-dropdown {
    position: absolute;
    top: calc(100% + 12px);
    right: 0;
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 16px;
    padding: 20px;
    width: 360px; /* Alargado para o texto não quebrar */
    z-index: 99;
    box-shadow: 0 10px 40px rgba(0,0,0,0.5);
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.dropdown-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.header-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    color: var(--text-primary);
    font-size: 1rem;
}

.close-btn {
    background: transparent; border: none; cursor: pointer;
    color: var(--text-secondary); display: flex;
    padding: 4px; border-radius: 6px; transition: 0.2s;
}
.close-btn:hover { color: var(--text-primary); background: rgba(255,255,255,0.05); }

.scope-section {
    display: flex; flex-direction: column; gap: 8px;
}

.section-label {
    font-size: 0.8rem; color: var(--text-secondary); font-weight: 500;
}

.scope-selector {
    display: flex;
    background-color: var(--bg-page); /* Fundo escuro atrás dos botões */
    border-radius: 10px;
    padding: 6px; gap: 6px;
}

.scope-btn {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;
    background: transparent; border: none;
    color: var(--text-secondary);
    padding: 10px; border-radius: 8px; font-size: 0.9rem; font-weight: 500;
    cursor: pointer; transition: 0.2s; text-transform: capitalize;
    white-space: nowrap; /* Impede a quebra de linha do mês */
}

.scope-btn.active {
    background-color: var(--bg-card);
    color: var(--text-primary);
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}

.action-section { display: flex; flex-direction: column; gap: 12px; }

.action-card {
    display: flex; align-items: center; gap: 14px;
    background: transparent; text-align: left;
    padding: 16px; border-radius: 12px;
    cursor: pointer; transition: 0.2s; border: 1px solid transparent;
}

.action-texts { display: flex; flex-direction: column; gap: 4px; }
.action-texts .title { font-size: 0.95rem; font-weight: 600; }
.action-texts .subtitle { font-size: 0.75rem; opacity: 0.8; }

/* Estilos do Exportar (Verde) */
.action-card.export {
    background-color: rgba(16, 185, 129, 0.05);
    border-color: rgba(16, 185, 129, 0.2);
    color: #10B981; 
}
.action-card.export:hover {
    background-color: rgba(16, 185, 129, 0.1);
    border-color: rgba(16, 185, 129, 0.4);
}

/* Estilos do Importar (Azul) */
.action-card.import {
    background-color: rgba(96, 165, 250, 0.05);
    border-color: rgba(96, 165, 250, 0.2);
    color: #60A5FA; 
}
.action-card.import:hover {
    background-color: rgba(96, 165, 250, 0.1);
    border-color: rgba(96, 165, 250, 0.4);
}
</style>