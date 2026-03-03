<script setup lang="ts">
    import { ref } from 'vue';
    import { PhSparkle, PhRobot, PhPaperPlaneTilt } from '@phosphor-icons/vue';

    const promptText = ref('');



</script>

<template>
    <div class="ai-container">
        <header class="ai-header">
            <div class="icon-box">
                <PhSparkle size="24" weight="fill"/>
            </div>
            <div class="header-titles">
                <h1>Modo IA</h1>
                <p>Assistente financeiro inteligente</p>
            </div>
        </header>
        <main class="welcome-center">
            <div class="robot-circle">
                <PhRobot size="32" weight="regular"/>
            </div>
            <h2>Olá! Como posso ajudar você hoje?</h2>
            <p class="subtitle">
                Pergunte sobre seus gastos, peça dicas de economia ou ajuda<br />
                para planejar suas finanças.
            </p>
        </main>
        <footer class="input-area">
            <form class="input-wrapper">
                <input
                    type="text"
                    v-model="promptText"
                    placeholder="Pergunte algo sobre suas finanças..."
                    class="ai-input"
                />
                <button type="submit" class="send-btn" :disabled="!promptText.trim()">
                    <PhPaperPlaneTilt size="20" weight="fill" />
                </button>
            </form>
        </footer>
    </div>
</template>

<style scoped>
    .ai-container {
        display: flex;
        flex-direction: column;
        height: calc(100vh - 100px);
        width: 100%;
        color: var(--text-color);
        font-family: 'Inter', sans-serif;
    }

    .ai-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 1rem 0;
    }

    .icon-box {
        background: linear-gradient(135deg, #9333EA, #A855F7);
        width: 42px;
        height: 42px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
    }

    .header-titles h1 {
        margin: 0;
        font-size: 1.2rem;
        font-weight: 700;
    }

    .header-titles p {
        margin: 0;
        font-size: 0.85rem;
        color: var(--text-secondary, #9CA3AF);
    }

    .welcome-center {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 0 1rem;
    }

    .robot-circle {
        background-color: rgba(139, 92, 246, 0.15); /* Fundo roxo bem translúcido */
        color: #A855F7;
        width: 64px;
        height: 64px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 1.5rem;
    }

    .welcome-center h2 {
        font-size: 1.4rem;
        font-weight: 600;
        margin-bottom: 0.5rem;
    }

    .subtitle {
        color: var(--text-secondary);
        font-size: 0.95rem;
        line-height: 1.5;
        margin-bottom: 2rem;
    }

    .input-area {
        padding: 2rem 0;
        display: flex;
        justify-content: center;
        width: 100%;
    }
    
    .input-wrapper {
        display: flex;
        gap: 12px;
        width: 100%;
        max-width: 800px;
    }

    .ai-input {
        flex: 1;
        background-color: rgba(255, 255, 255, 0.05); /* Fundo escuro do input */
        border: 1px solid rgba(255, 255, 255, 0.1);
        padding: 1rem 1.5rem;
        border-radius: 8px;
        color: white;
        font-size: 0.95rem;
        outline: none;
        transition: border-color 0.2s;
    }

    .ai-input:focus {
        border-color: #A855F7;
    }

    .ai-input::placeholder {
        color: rgba(255, 255, 255, 0.5);
    }

    .send-btn {
        background-color: #9333EA;
        color: white;
        border: none;
        width: 52px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: background-color 0.2s;
    }

    .send-btn:hover:not(:disabled) {
        background-color: #7E22CE;
    }

    .send-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    /* Responsividade */
    @media (max-width: 640px) {
        .subtitle { font-size: 0.85rem; br { display: none; } }
        .welcome-center h2 { font-size: 1.2rem; }
        .input-wrapper { max-width: 100%; }
    }
    

</style>