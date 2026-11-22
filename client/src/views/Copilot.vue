<script setup lang="ts">
    import { ref, onMounted, nextTick, computed } from 'vue';
    import { storeToRefs } from 'pinia';
    import {
        PhSparkle, PhRobot, PhPaperPlaneTilt, PhUser, PhCalculator,
        PhShieldCheck, PhLockKey, PhLightning, PhCheckCircle, PhInfo
    } from '@phosphor-icons/vue';
    import { supabase } from '../services/supabase';
    import { useProfileStore } from '../stores/useProfileStore';
    import { usePiggybankStore } from '../stores/usePiggybankStore';
    import { useVaultStore } from '../stores/useVaultStore';

    const profileStore = useProfileStore();
    const piggybankStore = usePiggybankStore();
    const vaultStore = useVaultStore();
    const { isVaultUnlocked } = storeToRefs(vaultStore);

    interface Message {
        id: number;
        role: 'user' | 'ai';
        content: string;
    }

    const promptText = ref('');
    const messages = ref<Message[]>([]);
    const isTyping = ref(false);
    const chatContainer = ref<HTMLElement | null>(null);

    // Contexto Financeiro Real para alimentar a IA e o Simulador
    const monthlyIncomes = ref(0);
    const monthlyExpenses = ref(0);
    const monthlySubscriptions = ref(0);

    // Simulador de Decisão de Compra (À Vista vs Parcelado)
    const showSimulator = ref(true);
    const simForm = ref({
        itemName: 'Celular Novo',
        cashPrice: 3200,
        installmentTotalPrice: 3200,
        installments: 10,
        monthlyCdiRatePct: 0.85 // ~100% do CDI líquido mensal
    });

    const loadFinancialContext = async () => {
        try {
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

            const { data: inc } = await supabase
                .from('fin_income')
                .select('value')
                .gte('date', startOfMonth)
                .lte('date', endOfMonth)
                .eq('user_id', profileStore.userId);

            monthlyIncomes.value = (inc || []).reduce((acc: number, c: any) => acc + Number(c.value), 0);

            const { data: exp } = await supabase
                .from('fin_installment')
                .select('value')
                .gte('dueDate', startOfMonth)
                .lte('dueDate', endOfMonth);

            monthlyExpenses.value = (exp || []).reduce((acc: number, c: any) => acc + Number(c.value), 0);

            // Lê assinaturas salvas
            const rawSubs = localStorage.getItem('somma_subscriptions_v1');
            if (rawSubs) {
                const parsed = JSON.parse(rawSubs);
                monthlySubscriptions.value = (parsed || [])
                    .filter((s: any) => s.active)
                    .reduce((acc: number, s: any) => acc + (s.cycle === 'yearly' ? s.amount / 12 : s.amount), 0);
            }

            await piggybankStore.fetchPiggybanks();
        } catch (e) {
            console.error('Erro ao carregar contexto do Copilot:', e);
        }
    };

    const liquidVaultBalance = computed(() => {
        if (!isVaultUnlocked.value) return 0;
        return piggybankStore.piggybanks
            .filter(p => p.composes_balance)
            .reduce((acc, p) => acc + Number(p.current_amount), 0);
    });

    const isolatedVaultBalance = computed(() => {
        if (!isVaultUnlocked.value) return 0;
        return piggybankStore.piggybanks
            .filter(p => !p.composes_balance)
            .reduce((acc, p) => acc + Number(p.current_amount), 0);
    });

    const freeMonthlyCashFlow = computed(() => {
        return monthlyIncomes.value - monthlyExpenses.value;
    });

    // Matemática Financeira (Valor Presente Líquido das Parcelas descontado pelo CDI do Cofrinho)
    const simulationAnalysis = computed(() => {
        const cash = Number(simForm.value.cashPrice) || 0;
        const totalInst = Number(simForm.value.installmentTotalPrice) || cash;
        const n = Math.max(1, Number(simForm.value.installments) || 1);
        const r = (Number(simForm.value.monthlyCdiRatePct) || 0.85) / 100;

        const installmentVal = totalInst / n;

        // Quanto o dinheiro rende no cofrinho se você parcelar e for pagando mês a mês (NPV)
        let npvInstallments = 0;
        for (let k = 1; k <= n; k++) {
            npvInstallments += installmentVal / Math.pow(1 + r, k);
        }

        const cdiGainByInstallment = totalInst - npvInstallments;
        const interestCharged = totalInst - cash;
        const netAdvantageInstallment = cash - npvInstallments; // Se > 0, parcelar é melhor financeiramente

        const freeMargin = Math.max(1, freeMonthlyCashFlow.value);
        const marginImpactPct = Math.round((installmentVal / freeMargin) * 100);

        let verdict: 'installment' | 'cash' | 'wait' = 'installment';
        let summaryText = '';

        if (freeMonthlyCashFlow.value <= installmentVal) {
            verdict = 'wait';
            summaryText = `Cuidado: A parcela de ${formatCurrency(installmentVal)} compromete 100% da sua margem livre mensal atual (${formatCurrency(freeMonthlyCashFlow.value)}).`;
        } else if (netAdvantageInstallment >= 0) {
            verdict = 'installment';
            summaryText = `Vale mais a pena PARCELAR em ${n}x de ${formatCurrency(installmentVal)}. Mantendo os ${formatCurrency(cash)} no Cofrinho rendendo ${simForm.value.monthlyCdiRatePct}% a.m., você ganha ${formatCurrency(netAdvantageInstallment)} líquidos de vantagem!`;
        } else {
            verdict = 'cash';
            summaryText = `Vale mais a pena COMPRAR À VISTA por ${formatCurrency(cash)}. Os juros/diferença de ${formatCurrency(interestCharged)} no parcelado superam o rendimento do seu Cofrinho em ${formatCurrency(Math.abs(netAdvantageInstallment))}.`;
        }

        return {
            installmentVal,
            cdiGainByInstallment,
            interestCharged,
            netAdvantageInstallment,
            marginImpactPct,
            verdict,
            summaryText
        };
    });

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
    };

    onMounted(async () => {
        if (!profileStore.userId) {
            await profileStore.fetchProfileData();
        }
        await loadFinancialContext();

        messages.value.push({
            id: Date.now(),
            role: 'ai',
            content: 'Olá! Sou o Somma Copilot. Já carreguei seu fluxo de caixa do mês' +
                (isVaultUnlocked.value ? ' e seus saldos do Cofre Tailscale.' : ' (Cofre Tailscale isolado no momento).') +
                ' Quer simular uma compra à vista vs. parcelada ou analisar seus gastos?'
        });
    });

    const buildFinancialSnapshotPayload = () => {
        return {
            monthFlow: {
                incomes: monthlyIncomes.value,
                expenses: monthlyExpenses.value,
                freeCashFlow: freeMonthlyCashFlow.value,
                recurringSubscriptionsMonthly: monthlySubscriptions.value
            },
            tailscaleVault: {
                unlocked: isVaultUnlocked.value,
                liquidBalanceComposingMonth: isVaultUnlocked.value ? liquidVaultBalance.value : null,
                isolatedGoalsBalance: isVaultUnlocked.value ? isolatedVaultBalance.value : null,
                piggybanks: isVaultUnlocked.value
                    ? piggybankStore.piggybanks.map(p => ({
                        title: p.title,
                        current: p.current_amount,
                        target: p.target_amount,
                        composesBalance: p.composes_balance
                    }))
                    : []
            }
        };
    };

    const generateLocalCopilotAnswer = () => {
        const s = simulationAnalysis.value;
        const cash = formatCurrency(simForm.value.cashPrice);
        const inst = formatCurrency(s.installmentVal);
        const free = formatCurrency(freeMonthlyCashFlow.value);
        const vault = isVaultUnlocked.value
            ? `Você possui **${formatCurrency(liquidVaultBalance.value)}** de liquidez no Cofre Tailscale (que compõe saldo) e **${formatCurrency(isolatedVaultBalance.value)}** em metas isoladas.`
            : `*(Nota: Seu Cofre Tailscale está isolado no momento, então estou considerando apenas seu fluxo mensal de ${free}).*`;

        return [
            `📊 **Análise do Copilot para: ${simForm.value.itemName} (${cash})**`,
            ``,
            `1. **Seu Momento Atual:** Sua margem livre neste mês (Entradas - Saídas) é de **${free}**. ${vault}`,
            `2. **Impacto no Fluxo Mensal:** Uma parcela de **${inst}** (${simForm.value.installments}x) consome **${s.marginImpactPct}%** da sua sobra mensal (o limite saudável recomendado é até 20%).`,
            `3. **Matemática À Vista vs. Parcelado (CDI ${simForm.value.monthlyCdiRatePct}% a.m.):**`,
            `   • Se você parcelar e deixar o dinheiro rendendo no Cofrinho, o rendimento acumulado até o fim das parcelas será de aproximadamente **${formatCurrency(s.cdiGainByInstallment)}**.`,
            `   • Diferença/Juros cobrados no parcelamento: **${formatCurrency(s.interestCharged)}**.`,
            ``,
            `✅ **Recomendação Final:** ${s.summaryText}`
        ].join('\n');
    };

    const sendSimulatorToChat = async () => {
        const hasInterest = simForm.value.installmentTotalPrice > simForm.value.cashPrice;
        promptText.value = `Quero comprar "${simForm.value.itemName}" de ${formatCurrency(simForm.value.cashPrice)} à vista` +
            (hasInterest
                ? ` (ou ${simForm.value.installments}x totalizando ${formatCurrency(simForm.value.installmentTotalPrice)} com juros).`
                : ` (ou em ${simForm.value.installments}x sem juros).`) +
            ` Devo comprar agora? Vale mais a pena manter parcelado rendendo no cofrinho ou pagar à vista no meu caso?`;

        await sendMessage(true);
    };

    const sendQuickPrompt = async (text: string) => {
        promptText.value = text;
        await sendMessage(false);
    };

    const sendMessage = async (fromSimulator = false) => {
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

            if (!webhookUrl) {
                await new Promise(r => setTimeout(r, 550));
                messages.value.push({
                    id: Date.now(),
                    role: 'ai',
                    content: generateLocalCopilotAnswer()
                });
                return;
            }

            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    sessionId: userId,
                    message: text,
                    financialContext: buildFinancialSnapshotPayload(),
                    purchaseSimulation: fromSimulator ? {
                        ...simForm.value,
                        computed: simulationAnalysis.value
                    } : null
                })
            });

            if (!response.ok) throw new Error('Falha ao comunicar com N8N');
            
            const textResponse = await response.text();
            if (!textResponse) throw new Error('N8N devolveu uma resposta vazia.');

            let data;
            try {
                data = JSON.parse(textResponse);
            } catch {
                data = { output: textResponse };
            }

            const aiResponse = data.output || (typeof data === 'string' ? data : JSON.stringify(data, null, 2));
            
            messages.value.push({
                id: Date.now(),
                role: 'ai',
                content: aiResponse
            });

        } catch (error) {
            console.warn('Webhook n8n indisponível, usando motor matemático local do Copilot:', error);
            messages.value.push({
                id: Date.now(),
                role: 'ai',
                content: generateLocalCopilotAnswer()
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
    <div class="copilot-layout">
        <!-- Cabeçalho -->
        <header class="ai-header">
            <div class="header-left">
                <div class="icon-box">
                    <PhSparkle size="22" weight="fill"/>
                </div>
                <div class="header-titles">
                    <div class="title-row">
                        <h1>Somma Copilot IA</h1>
                        <span class="context-pill" :class="isVaultUnlocked ? 'unlocked' : 'locked'">
                            <PhShieldCheck v-if="isVaultUnlocked" size="13" weight="fill" />
                            <PhLockKey v-else size="13" weight="fill" />
                            {{ isVaultUnlocked ? 'Contexto Tailscale Vault Ativo' : 'Apenas Contexto Mensal (Cofre Isolado)' }}
                        </span>
                    </div>
                    <p>Consultor financeiro inteligente com cálculo de VPL (CDI vs. Parcelamento)</p>
                </div>
            </div>

            <button class="btn-secondary" @click="showSimulator = !showSimulator">
                <PhCalculator size="18" />
                {{ showSimulator ? 'Ocultar Simulador' : 'Simulador de Compra' }}
            </button>
        </header>

        <div class="copilot-workspace" :class="{ 'with-simulator': showSimulator }">
            <!-- COLUNA ESQUERDA: CHAT -->
            <div class="chat-column">
                <main class="chat-area" ref="chatContainer">
                    <div class="messages-list">
                        <div
                            v-for="msg in messages"
                            :key="msg.id"
                            :class="['message-wrapper', msg.role === 'user' ? 'is-user' : 'is-ai']"
                        >
                            <div class="avatar" v-if="msg.role === 'ai'">
                                <PhRobot size="19" weight="duotone" />
                            </div>

                            <div class="message-bubble">{{ msg.content }}</div>

                            <div class="avatar" v-if="msg.role === 'user'">
                                <img v-if="profileStore.avatarUrl" :src="profileStore.avatarUrl" class="user-avatar-img" alt="User" />
                                <PhUser v-else size="19" weight="regular"/>
                            </div>
                        </div>

                        <div class="message-wrapper is-ai" v-if="isTyping">
                            <div class="avatar">
                                <PhRobot size="19" weight="duotone"/>
                            </div>
                            <div class="message-bubble typing-indicator">
                                <span></span><span></span><span></span>
                            </div>
                        </div>
                    </div>
                </main>

                <!-- Sugestões Rápidas -->
                <div class="quick-prompts">
                    <button type="button" class="prompt-chip" @click="sendSimulatorToChat">
                        <PhLightning size="13" weight="fill" />
                        Devo comprar {{ simForm.itemName }} ({{ formatCurrency(simForm.cashPrice) }}) agora?
                    </button>
                    <button type="button" class="prompt-chip" @click="sendQuickPrompt('Qual é minha margem livre neste mês e quanto posso comprometer em novas parcelas?')">
                        Quanto posso comprometer em parcelas este mês?
                    </button>
                </div>

                <footer class="input-area">
                    <form class="input-wrapper" @submit.prevent="sendMessage(false)">
                        <input
                            type="text"
                            v-model="promptText"
                            placeholder="Ex: Quero comprar um celular de R$ 3.200, vale parcelar ou pagar à vista?"
                            class="ai-input"
                            :disabled="isTyping"
                        />
                        <button type="submit" class="send-btn" :disabled="!promptText.trim() || isTyping">
                            <PhPaperPlaneTilt size="19" weight="fill" />
                        </button>
                    </form>
                </footer>
            </div>

            <!-- COLUNA DIREITA: SIMULADOR DE DECISÃO DE COMPRA (À VISTA VS PARCELADO) -->
            <aside v-if="showSimulator" class="simulator-panel">
                <div class="sim-header">
                    <div class="sim-title-row">
                        <PhCalculator size="19" weight="duotone" class="sim-icon" />
                        <h3>Simulador Inteligente de Compra</h3>
                    </div>
                    <p>Compara o desconto à vista com o rendimento do seu Cofrinho (CDI) ao parcelar</p>
                </div>

                <!-- Snapshot do Usuário -->
                <div class="context-snapshot">
                    <div class="snap-item">
                        <span>Sobra Mensal</span>
                        <strong :class="freeMonthlyCashFlow >= 0 ? 'text-success' : 'text-danger'">
                            {{ formatCurrency(freeMonthlyCashFlow) }}
                        </strong>
                    </div>
                    <div class="snap-item">
                        <span>Liquidez no Cofre</span>
                        <strong>{{ isVaultUnlocked ? formatCurrency(liquidVaultBalance) : '🔒 Isolado' }}</strong>
                    </div>
                </div>

                <div class="sim-form">
                    <div class="input-group">
                        <label>O que você quer comprar?</label>
                        <input type="text" v-model="simForm.itemName" placeholder="Ex: Celular Novo" />
                    </div>

                    <div class="sim-grid-2">
                        <div class="input-group">
                            <label>Preço à Vista / Pix (R$)</label>
                            <input type="number" step="10" v-model.number="simForm.cashPrice" />
                        </div>
                        <div class="input-group">
                            <label>Total Parcelado (R$)</label>
                            <input type="number" step="10" v-model.number="simForm.installmentTotalPrice" />
                        </div>
                    </div>

                    <div class="sim-grid-2">
                        <div class="input-group">
                            <label>Nº de Parcelas</label>
                            <select v-model.number="simForm.installments">
                                <option v-for="n in [2, 3, 4, 5, 6, 8, 10, 12, 18, 24]" :key="n" :value="n">
                                    {{ n }}x de {{ formatCurrency((simForm.installmentTotalPrice || 0) / n) }}
                                </option>
                            </select>
                        </div>
                        <div class="input-group">
                            <label>Rendimento Cofrinho (% a.m.)</label>
                            <input type="number" step="0.05" v-model.number="simForm.monthlyCdiRatePct" />
                        </div>
                    </div>
                </div>

                <!-- Resultado Instantâneo VPL -->
                <div class="verdict-card" :class="simulationAnalysis.verdict">
                    <div class="verdict-top">
                        <PhCheckCircle v-if="simulationAnalysis.verdict !== 'wait'" size="18" weight="fill" />
                        <PhInfo v-else size="18" weight="fill" />
                        <strong>
                            {{
                                simulationAnalysis.verdict === 'installment'
                                    ? 'Recomendação: Parcelar e investir no Cofrinho'
                                    : simulationAnalysis.verdict === 'cash'
                                        ? 'Recomendação: Pagar à Vista (Pix)'
                                        : 'Alerta: Alto Comprometimento Mensal'
                            }}
                        </strong>
                    </div>
                    <p class="verdict-desc">{{ simulationAnalysis.summaryText }}</p>

                    <div class="verdict-metrics">
                        <div class="v-metric">
                            <span>Ganho CDI parcelando</span>
                            <strong class="text-success">+ {{ formatCurrency(simulationAnalysis.cdiGainByInstallment) }}</strong>
                        </div>
                        <div class="v-metric">
                            <span>Juros embutidos</span>
                            <strong :class="simulationAnalysis.interestCharged > 0 ? 'text-danger' : ''">
                                {{ formatCurrency(simulationAnalysis.interestCharged) }}
                            </strong>
                        </div>
                        <div class="v-metric">
                            <span>Peso na sobra do mês</span>
                            <strong>{{ simulationAnalysis.marginImpactPct }}%</strong>
                        </div>
                    </div>
                </div>

                <button type="button" class="btn-primary w-full" @click="sendSimulatorToChat">
                    <PhSparkle size="17" weight="fill" />
                    Consultar Parecer Completo da IA
                </button>
            </aside>
        </div>
    </div>
</template>

<style scoped>
    .text-success { color: var(--success-text); }
    .text-danger { color: var(--danger-text); }
    .w-full { width: 100%; }

    .copilot-layout {
        display: flex;
        flex-direction: column;
        height: calc(100vh - 115px);
        gap: 1.15rem;
    }

    .ai-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 1rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid var(--border-color);
    }

    .header-left {
        display: flex;
        align-items: center;
        gap: 0.9rem;
    }

    .icon-box {
        background: var(--primary-gradient);
        width: 42px;
        height: 42px;
        border-radius: 11px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        box-shadow: 0 4px 12px var(--primary-glow);
        flex-shrink: 0;
    }

    .title-row {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.65rem;
    }

    .header-titles h1 {
        margin: 0;
        font-size: 1.35rem;
        font-weight: 700;
        letter-spacing: -0.02em;
    }

    .header-titles p {
        margin: 2px 0 0 0;
        font-size: 0.85rem;
        color: var(--text-secondary);
    }

    .context-pill {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.72rem;
        font-weight: 600;
        padding: 2px 9px;
        border-radius: 99px;
    }

    .context-pill.unlocked {
        background: var(--success-bg);
        color: var(--success-text);
        border: 1px solid rgba(16, 185, 129, 0.25);
    }

    .context-pill.locked {
        background: rgba(245, 158, 11, 0.12);
        color: #F59E0B;
        border: 1px solid rgba(245, 158, 11, 0.25);
    }

    /* === WORKSPACE 2 COLUNAS === */
    .copilot-workspace {
        flex: 1;
        min-height: 0;
        display: grid;
        grid-template-columns: 1fr;
        gap: 1.25rem;
    }

    .copilot-workspace.with-simulator {
        grid-template-columns: minmax(0, 1.35fr) minmax(340px, 0.9fr);
    }

    .chat-column {
        display: flex;
        flex-direction: column;
        min-height: 0;
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 16px;
        overflow: hidden;
        box-shadow: var(--shadow-sm);
    }

    .chat-area {
        flex: 1;
        overflow-y: auto;
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
    }

    .messages-list {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
        width: 100%;
    }

    .message-wrapper {
        display: flex;
        gap: 10px;
        align-items: flex-end;
    }

    .message-wrapper.is-user {
        justify-content: flex-end;
    }

    .avatar {
        width: 34px;
        height: 34px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .is-ai .avatar {
        background-color: var(--primary-subtle);
        color: var(--primary-color);
        border: 1px solid rgba(99, 102, 241, 0.25);
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
        padding: 0.95rem 1.2rem;
        border-radius: 14px;
        max-width: 82%;
        font-size: 0.9rem;
        line-height: 1.55;
        white-space: pre-line;
        word-wrap: break-word;
    }

    .is-ai .message-bubble {
        background-color: var(--bg-elevated);
        color: var(--text-primary);
        border-bottom-left-radius: 4px;
        border: 1px solid var(--border-color);
    }
    
    .is-user .message-bubble {
        background: var(--primary-color);
        color: var(--text-inverse);
        border-bottom-right-radius: 4px;
    }

    .quick-prompts {
        display: flex;
        gap: 0.5rem;
        padding: 0.5rem 1.25rem;
        overflow-x: auto;
        border-top: 1px solid var(--border-subtle);
        background: var(--bg-card);
    }

    .prompt-chip {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: var(--bg-elevated);
        border: 1px solid var(--border-color);
        color: var(--text-secondary);
        font-family: inherit;
        font-size: 0.76rem;
        font-weight: 600;
        padding: 0.4rem 0.75rem;
        border-radius: 99px;
        cursor: pointer;
        white-space: nowrap;
        transition: all 0.15s ease;
    }

    .prompt-chip:hover {
        border-color: var(--primary-color);
        color: var(--primary-color);
        background: var(--primary-subtle);
    }

    .input-area {
        padding: 0.95rem 1.25rem;
        background-color: var(--bg-card);
        border-top: 1px solid var(--border-color);
    }
    
    .input-wrapper {
        display: flex;
        gap: 10px;
        width: 100%;
        align-items: center;
    }

    .ai-input {
        flex: 1;
        background-color: var(--bg-input);
        border: 1px solid var(--border-color);
        padding: 0.75rem 1.15rem;
        border-radius: 12px;
        color: var(--text-primary);
        font-size: 0.9rem;
    }

    .send-btn {
        background: var(--primary-color);
        color: var(--text-inverse);
        border: none;
        width: 42px;
        height: 42px;
        border-radius: 11px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: transform 0.15s, background-color 0.15s;
        flex-shrink: 0;
    }

    .send-btn:hover:not(:disabled) {
        background: var(--primary-hover);
        transform: translateY(-1px);
    }

    .send-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    /* === PAINEL DO SIMULADOR === */
    .simulator-panel {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 16px;
        padding: 1.35rem;
        display: flex;
        flex-direction: column;
        gap: 1.1rem;
        overflow-y: auto;
        box-shadow: var(--shadow-sm);
    }

    .sim-title-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .sim-icon {
        color: var(--primary-color);
    }

    .sim-header h3 {
        margin: 0;
        font-size: 1rem;
        font-weight: 700;
        color: var(--text-primary);
    }

    .sim-header p {
        margin: 3px 0 0 0;
        font-size: 0.78rem;
        color: var(--text-secondary);
    }

    .context-snapshot {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.65rem;
        background: var(--bg-elevated);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        padding: 0.75rem;
    }

    .snap-item {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .snap-item span {
        font-size: 0.72rem;
        color: var(--text-muted);
    }

    .snap-item strong {
        font-size: 0.925rem;
        font-weight: 700;
        font-feature-settings: "tnum";
    }

    .sim-form {
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
    }

    .sim-grid-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.75rem;
    }

    .sim-form .input-group {
        min-width: 0;
    }

    .verdict-card {
        border-radius: 12px;
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
        border: 1px solid var(--border-color);
        background: var(--bg-elevated);
    }

    .verdict-card.installment {
        border-color: rgba(99, 102, 241, 0.35);
        background: var(--primary-subtle);
    }

    .verdict-card.cash {
        border-color: rgba(16, 185, 129, 0.35);
        background: var(--success-bg);
    }

    .verdict-card.wait {
        border-color: rgba(244, 63, 94, 0.35);
        background: var(--danger-bg);
    }

    .verdict-top {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        font-size: 0.85rem;
        color: var(--text-primary);
    }

    .verdict-desc {
        margin: 0;
        font-size: 0.8rem;
        line-height: 1.45;
        color: var(--text-secondary);
    }

    .verdict-metrics {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0.5rem;
        padding-top: 0.65rem;
        border-top: 1px solid var(--border-color);
    }

    .v-metric {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .v-metric span {
        font-size: 0.68rem;
        color: var(--text-muted);
    }

    .v-metric strong {
        font-size: 0.8rem;
        font-feature-settings: "tnum";
    }

    .typing-indicator {
        display: flex;
        gap: 4px;
        align-items: center;
        padding: 0.9rem 1.2rem;
    }
    
    .typing-indicator span {
        width: 6px;
        height: 6px;
        background-color: var(--text-secondary);
        border-radius: 50%;
        animation: bounce 1.4s infinite ease-in-out both; 
    }
    
    .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
    .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }

    @keyframes bounce {
        0%, 80%, 100% { transform: scale(0); }
        40% { transform: scale(1); }
    }

    @media (max-width: 1024px) {
        .copilot-layout {
            height: auto;
        }
        .copilot-workspace.with-simulator {
            grid-template-columns: 1fr;
        }
        .chat-column {
            height: 520px;
        }
    }

    @media (max-width: 640px) {
        .verdict-metrics {
            grid-template-columns: 1fr;
            gap: 0.6rem;
        }
        .sim-row,
        .sim-compare {
            grid-template-columns: 1fr !important;
        }
        .copilot-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.75rem;
        }
    }
</style>
