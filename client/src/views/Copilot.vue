<script setup lang="ts">
    import { ref, onMounted, nextTick } from 'vue';
    import { PhSparkle, PhRobot, PhPaperPlaneTilt, PhUser } from '@phosphor-icons/vue';
    import { supabase } from '../services/supabase';
    import { useProfileStore } from '../stores/useProfileStore';

    const profileStore = useProfileStore();

    interface Message {
        id: number;
        role: 'user' | 'ai';
        content: string;
    }

    const promptText = ref('');
    const messages = ref<Message[]>([]); // Array para guardar histórico
    const isTyping = ref(false);
    const chatContainer = ref<HTMLElement | null>(null);

    
    onMounted(async () => {
        // Carrega dados do perfil se ainda não estiverem lá
        if (!profileStore.userId) {
            await profileStore.fetchProfileData();
        }

        messages.value.push({
            id: Date.now(),
            role: 'ai',
            content: 'Olá! Como posso ajudar você hoje? Pergunte sobre seus gastos, peça dicas ou ajuda para planejar.'
        });

    });


    const sendMessage = async () => {
        const text = promptText.value.trim();
        if (!text) return;

        messages.value.push({
            id: Date.now(),
            role: 'user',
            content: text
        });

        promptText.value = '';
        isTyping.value = true;

        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token;
            const userId = sessionData.session?.user?.id || 'anonymous';

            const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL;

            if(!webhookUrl) throw new Error("Aviso: VITE_N8N_WEBHOOK_URL não está no arquivo .env");

            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {}) 
                },
                body: JSON.stringify({
                    sessionId: userId,
                    message: text
                })
            });

            if(!response.ok) throw new Error('Falha ao comunicar com N8N');
            
            const textResponse = await response.text();
            if (!textResponse) {
                throw new Error('N8N devolveu uma resposta vazia.');
            }

            let data;
            try {
                data = JSON.parse(textResponse);
            } catch (e) {
                data = { output: textResponse };
            }

            console.log("Retorno do N8N:", data);
            
            const aiResponse = data.output || (typeof data === 'string' ? data : JSON.stringify(data, null, 2));
            
            messages.value.push({
                id: Date.now(),
                role: 'ai',
                content: aiResponse
            });

        } catch (error) {
            console.error(error);
            messages.value.push({
                id: Date.now(),
                role: 'ai',
                content: 'Desculpe, ocorreu um erro ao tentar conectar ao N8N no momento.'
            });
        } finally {
            isTyping.value = false;

            await nextTick();
                if (chatContainer.value) {
                    chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
                }
        }
    };


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
        <main class="chat-area" ref="chatContainer">
            <div class="messages-list">
                <div
                    v-for="msg in messages"
                    :key="msg.id"
                    :class="['message-wrapper',  msg.role === 'user' ? 'is-user' : 'is-ai']"
                >
                    <div class="avatar" v-if="msg.role === 'ai'">
                        <PhRobot size="20" weight="regular" />
                    </div>

                    <div class="message-bubble">
                        {{ msg.content }}
                    </div>

                    <div class="avatar" v-if="msg.role === 'user'">
                        <img v-if="profileStore.avatarUrl" :src="profileStore.avatarUrl" class="user-avatar-img" alt="User" />
                        <PhUser v-else size="20" weight="regular"/>
                    </div>
                </div>
                <div class="message-wrapper is-ai" v-if="isTyping">
                    <div class="avatar">
                        <PhRobot size="20" weight="regular"/>
                    </div>
                    <div class="message-bubble typing-indicator">
                        <span></span><span></span><span></span>
                    </div>
                </div>
            </div>
        </main>
        <footer class="input-area">
            <form class="input-wrapper" @submit.prevent="sendMessage">
                <input
                    type="text"
                    v-model="promptText"
                    placeholder="Pergunte algo sobre suas finanças..."
                    class="ai-input"
                    :disabled="isTyping"
                />
                <button type="submit" class="send-btn" :disabled="!promptText.trim() || isTyping">
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
        color: var(--text-primary);
        font-family: 'Inter', sans-serif;
    }

    .ai-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 1rem 0;
        border-bottom: 1px solid var(--border-color);
    }

    .icon-box {
        background: var(--primary-gradient, linear-gradient(135deg, #9333EA, #A855F7)); 
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
        color: var(--text-secondary);
    }

    
    .chat-area {
        flex: 1;
        overflow-y: auto;
        padding: 1.5rem 1rem;
        display: flex;
        flex-direction: column;
    }

    .chat-area::-webkit-scrollbar {
        width: 6px;
    }

    .chat-area::-webkit-scrollbar-track {
        background: transparent;
    }

    .chat-area::-webkit-scrollbar-thumb {
        background: var(--border-color);
        border-radius: 4px;
    }

    .messages-list {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        max-width: 800px;
        margin: 0 auto;
        width: 100%;
    }

    .message-wrapper {
        display: flex;
        gap: 12px;
        align-items: flex-end;
    }

    .message-wrapper.is-user {
        justify-content: flex-end;
    }

    .avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .is-ai .avatar {
        background-color: var(--bg-card);
        color: var(--primary-color);
        border: 1px solid var(--border-color);
    }

    .is-user .avatar {
        background-color: var(--primary-color);
        color: white;
        overflow: hidden;
    }

    .user-avatar-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .message-bubble {
        padding: 1rem 1.25rem;
        border-radius: 16px;
        max-width: 80%;
        font-size: 0.95rem;
        line-height: 1.5rem;
        box-shadow: 0 2px 5px rgba(0,0,0,0.05);
        word-wrap: break-word;
    }

    .is-ai .message-bubble {
        background-color: var(--bg-card);
        color: var(--text-primary);
        border-bottom-left-radius: 4px;
        border: 1px solid var(--border-color);
    }
    
    .is-user .message-bubble {
        background-color: var(--primary-color); 
        color: var(--text-inverse); 
        border-bottom-right-radius: 4px; /* Pontinha na direita! */
    }

    .typing-indicator {
        display: flex;
        gap: 4px;
        align-items: center;
        justify-content: center;
        padding: 1rem 1.5rem;
    }
    
    .typing-indicator span {
        width: 6px;
        height: 6px;
        background-color: var(--text-secondary);
        border-radius: 50%;
        animation: bounce 1.4s infinite ease-in-out both; 
    }
    
    /* Um tempo de delay diferente pra cada bolinha pular num tempo distinto */
    .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
    .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }

    @keyframes bounce {
        0%, 80%, 100% { transform: scale(0); }
        40% { transform: scale(1); }
    }

    .input-area {
        padding: 1.5rem 1rem;
        background-color: var(--bg-page);
        display: flex;
        justify-content: center;
        width: 100%;
        border-top: 1px solid var(--border-color);
    }
    
    .input-wrapper {
        display: flex;
        gap: 12px;
        width: 100%;
        max-width: 800px;
        align-items: center;
    }
    .ai-input {
        flex: 1;
        background-color: var(--bg-input); 
        border: 1px solid var(--border-color);
        padding: 1rem 1.5rem;
        border-radius: 24px;   
        color: var(--text-primary);
        font-size: 0.95rem;
        outline: none;
        transition: border-color 0.2s, box-shadow 0.2s;
    }
    .ai-input:focus {
        border-color: var(--primary-color); 
    }
    .ai-input::placeholder {
        color: var(--text-secondary);
    }
    .ai-input:disabled {
        opacity: 0.6;
    }
    .send-btn {
        background-color: var(--primary-color);
        color: var(--text-inverse);
        border: none;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: transform 0.2s, opacity 0.2s;
        flex-shrink: 0;
    }
    .send-btn:hover:not(:disabled) {
        transform: scale(1.05);
    }
    .send-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    /* Responsividade */
    @media (max-width: 640px) {
        .ai-container { height: calc(100vh - 80px); }
        .message-bubble {
            max-width: 90%;
            padding: 0.8rem 1rem;
        }
        .ai-input { padding: 0.8rem 1.2rem; }
        .send-btn { width: 42px; height: 42px; }
    }

</style>