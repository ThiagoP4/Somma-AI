<script setup lang="ts">
    import { ref, onMounted, nextTick, computed } from 'vue';
    import { storeToRefs } from 'pinia';
    import {
        PhSparkle, PhRobot, PhPaperPlaneTilt, PhUser,
        PhShieldCheck, PhLockKey, PhLightning, PhEye, PhEyeSlash
    } from '@phosphor-icons/vue';
    import { supabase } from '../services/supabase';
    import { useProfileStore } from '../stores/useProfileStore';
    import { usePiggybankStore } from '../stores/usePiggybankStore';
    import { useAssetsStore } from '../stores/useAssetsStore';
    import { useVaultStore } from '../stores/useVaultStore';
    import {
        buildZeroKnowledgeDiagnostics,
        extractMentionedPurchaseImpact
    } from '../utils/financialDiagnostics';

    const profileStore = useProfileStore();
    const piggybankStore = usePiggybankStore();
    const assetsStore = useAssetsStore();
    const vaultStore = useVaultStore();
    const { isVaultUnlocked } = storeToRefs(vaultStore);

    // Chave de Privacidade Máxima (ON por padrão!): envia apenas percentuais/índices anonimizados para a IA externa
    const maxPrivacyMode = ref(true);
    const showPayloadPreview = ref(false);
    const categoryTotals = ref<Record<string, number>>({});

    interface Message {
        id: number;
        role: 'user' | 'ai';
        content: string;
    }

    const promptText = ref('');
    const messages = ref<Message[]>([]);
    const isTyping = ref(false);
    const chatContainer = ref<HTMLElement | null>(null);

    // Contexto Financeiro Real para alimentar a IA e o Diagnóstico Local
    const monthlyIncomes = ref(0);
    const monthlyExpenses = ref(0);
    const monthlySubscriptions = ref(0);

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
                .select('value, fin_purchase ( fin_category ( description ) )')
                .gte('dueDate', startOfMonth)
                .lte('dueDate', endOfMonth);

            monthlyExpenses.value = (exp || []).reduce((acc: number, c: any) => acc + Number(c.value), 0);

            const catMap: Record<string, number> = {};
            for (const item of (exp || []) as any[]) {
                const catName = item?.fin_purchase?.fin_category?.description || 'Outros';
                catMap[catName] = (catMap[catName] || 0) + Number(item.value || 0);
            }
            categoryTotals.value = catMap;

            // Lê assinaturas salvas
            const rawSubs = localStorage.getItem('somma_subscriptions_v1');
            if (rawSubs) {
                const parsed = JSON.parse(rawSubs);
                monthlySubscriptions.value = (parsed || [])
                    .filter((s: any) => s.active)
                    .reduce((acc: number, s: any) => acc + (s.cycle === 'yearly' ? s.amount / 12 : s.amount), 0);
            }

            await Promise.all([
                piggybankStore.fetchPiggybanks(),
                assetsStore.fetchAssets()
            ]);
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

    // Motor de Diagnóstico Local (calcula percentuais anonimizados + insights 100% offline no aparelho)
    const localDiagnostics = computed(() =>
        buildZeroKnowledgeDiagnostics({
            monthlyIncomes: monthlyIncomes.value,
            monthlyExpenses: monthlyExpenses.value,
            monthlySubscriptions: monthlySubscriptions.value,
            categoryTotals: categoryTotals.value,
            isVaultUnlocked: isVaultUnlocked.value,
            piggybanks: piggybankStore.piggybanks,
            variableAssets: assetsStore.assets
        })
    );

    const buildFinancialSnapshotPayload = (userMessageText = '') => {
        if (maxPrivacyMode.value) {
            // MODO PRIVACIDADE MÁXIMA: envia APENAS percentuais e índices anonimizados (0 reais de saldo, 0 nomes de bancos!)
            // Se o usuário mencionou um valor na pergunta (ex: "produto de 300 reais"), anexa o impacto percentual local desse valor.
            const dailyLiquid = isVaultUnlocked.value
                ? piggybankStore.piggybanks
                    .filter(p => p.liquidity !== 'maturity')
                    .reduce((acc, p) => acc + Number(p.current_amount || 0), 0)
                : null;

            const mentionedPurchaseImpact = extractMentionedPurchaseImpact(userMessageText, {
                monthlyIncomes: monthlyIncomes.value,
                freeMonthlyCashFlow: freeMonthlyCashFlow.value,
                dailyLiquidReserve: dailyLiquid
            });

            return {
                ...localDiagnostics.value.anonymizedProfile,
                ...(mentionedPurchaseImpact ? { mentionedPurchaseImpact } : {})
            };
        }
        return {
            privacyMode: 'full-values',
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

    const previewPayloadJson = computed(() => JSON.stringify(buildFinancialSnapshotPayload(promptText.value), null, 2));

    const runOfflineDiagnosticInChat = async () => {
        const diag = localDiagnostics.value;
        const p = diag.anonymizedProfile;
        const topCats = p.topExpenseCategoriesPct.length > 0
            ? p.topExpenseCategoriesPct.map(c => `• ${c.category}: ${c.sharePct}%`).join('\n')
            : '• Sem despesas categorizadas neste mês.';
        const tips = diag.localInsights.length > 0
            ? diag.localInsights.map(t => `✅ ${t}`).join('\n')
            : '✅ Cadastre receitas, despesas e contas para gerar recomendações locais.';

        messages.value.push({
            id: Date.now(),
            role: 'ai',
            content: [
                `🛡️ **Raio-X Financeiro Local (100% Offline — Nenhum dado enviado à nuvem)**`,
                ``,
                `• **Taxa de Poupança:** ${p.monthlyCashflowRatios.savingsRatePct}% (Comprometimento: ${p.monthlyCashflowRatios.expenseCommitmentPct}%)`,
                `• **Saúde do Fluxo:** ${p.monthlyCashflowRatios.healthStatus.toUpperCase()}`,
                p.portfolioAllocationPct.vaultConnected
                    ? `• **Carteira:** ${p.portfolioAllocationPct.fixedIncomePct}% Renda Fixa / ${p.portfolioAllocationPct.variableIncomeAndCryptoPct}% Variável & Cripto`
                    : `• **Carteira:** Cofre Tailscale isolado`,
                p.portfolioAllocationPct.emergencyRunwayMonths !== null
                    ? `• **Fôlego de Reserva (Liquidez Diária):** ${p.portfolioAllocationPct.emergencyRunwayMonths} meses de custo de vida`
                    : ``,
                ``,
                `📌 **Maiores Categorias do Mês (%):**`,
                topCats,
                ``,
                `💡 **Diagnóstico & Próximos Passos:**`,
                tips
            ].filter(Boolean).join('\n')
        });

        await nextTick();
        if (chatContainer.value) {
            chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
        }
    };

    const generateLocalCopilotAnswer = (userText = '') => {
        const diag = localDiagnostics.value;
        const p = diag.anonymizedProfile;
        const dailyLiquid = isVaultUnlocked.value
            ? piggybankStore.piggybanks
                .filter(b => b.liquidity !== 'maturity')
                .reduce((acc, b) => acc + Number(b.current_amount || 0), 0)
            : null;
        const impact = extractMentionedPurchaseImpact(userText, {
            monthlyIncomes: monthlyIncomes.value,
            freeMonthlyCashFlow: freeMonthlyCashFlow.value,
            dailyLiquidReserve: dailyLiquid
        });

        const lines: string[] = [
            `🛡️ **Resposta do Motor Local (Offline)**`,
            ``
        ];

        if (impact) {
            lines.push(
                `📌 **Impacto da compra mencionada (${impact.detectedInstallments}x):**`,
                `• Peso na sobra livre do mês: **${impact.shareOfMonthlyFreeCashFlowPct ?? 'N/A'}%** (${impact.fitsInMonthlyFreeCashFlow ? 'Cabe na sobra mensal ✅' : 'Ultrapassa sua sobra mensal ⚠️'})`,
                impact.shareOfDailyLiquidityPct !== null ? `• Peso na sua liquidez diária: **${impact.shareOfDailyLiquidityPct}%**` : ``
            );
        }

        lines.push(
            `• **Taxa de Poupança do Mês:** ${p.monthlyCashflowRatios.savingsRatePct}% (Saúde: ${p.monthlyCashflowRatios.healthStatus.toUpperCase()})`,
            ...diag.localInsights.map(t => `✅ ${t}`)
        );

        return lines.filter(Boolean).join('\n');
    };

    const escapeHtml = (raw: string): string =>
        raw
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

    const formatInlineMarkdown = (escapedLine: string): string =>
        escapedLine
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>');

    const renderMarkdown = (raw: string): string => {
        const lines = raw.replace(/\r\n/g, '\n').split('\n');
        const htmlParts: string[] = [];
        let listType: 'ul' | 'ol' | null = null;

        const closeList = () => {
            if (listType) {
                htmlParts.push(`</${listType}>`);
                listType = null;
            }
        };

        for (const rawLine of lines) {
            const trimmed = rawLine.trim();

            if (!trimmed) {
                closeList();
                continue;
            }

            const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
            if (headingMatch) {
                closeList();
                const level = headingMatch[1]!.length <= 2 ? 'h3' : 'h4';
                htmlParts.push(`<${level}>${formatInlineMarkdown(escapeHtml(headingMatch[2]!))}</${level}>`);
                continue;
            }

            const ulMatch = trimmed.match(/^[-*•]\s+(.+)$/);
            if (ulMatch) {
                if (listType !== 'ul') {
                    closeList();
                    listType = 'ul';
                    htmlParts.push('<ul>');
                }
                htmlParts.push(`<li>${formatInlineMarkdown(escapeHtml(ulMatch[1]!))}</li>`);
                continue;
            }

            const olMatch = trimmed.match(/^\d+\.\s+(.+)$/);
            if (olMatch) {
                if (listType !== 'ol') {
                    closeList();
                    listType = 'ol';
                    htmlParts.push('<ol>');
                }
                htmlParts.push(`<li>${formatInlineMarkdown(escapeHtml(olMatch[1]!))}</li>`);
                continue;
            }

            closeList();
            htmlParts.push(`<p>${formatInlineMarkdown(escapeHtml(trimmed))}</p>`);
        }

        closeList();
        return htmlParts.join('');
    };

    const sendQuickPrompt = async (text: string) => {
        promptText.value = text;
        await sendMessage();
    };

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

            if (!webhookUrl) {
                await new Promise(r => setTimeout(r, 450));
                messages.value.push({
                    id: Date.now(),
                    role: 'ai',
                    content: generateLocalCopilotAnswer(text)
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
                    sessionId: maxPrivacyMode.value ? 'anonymous-zero-knowledge' : userId,
                    message: text,
                    financialContext: buildFinancialSnapshotPayload(text)
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
                content: generateLocalCopilotAnswer(text)
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
                    <p>Consultor financeiro privado com diagnósticos locais e análise anonimizada</p>
                </div>
            </div>

            <div class="header-right-actions">
                <button class="btn-secondary" @click="runOfflineDiagnosticInChat">
                    <PhShieldCheck size="17" weight="duotone" />
                    Raio-X Offline
                </button>
            </div>
        </header>

        <!-- Barra de Privacidade Máxima (Zero-Knowledge Prompting) + Preview do JSON -->
        <div class="privacy-bar">
            <div class="privacy-bar-top">
                <label class="privacy-toggle-label">
                    <input type="checkbox" v-model="maxPrivacyMode" />
                    <span>
                        <strong>🛡️ Privacidade Máxima na IA</strong> —
                        {{
                            maxPrivacyMode
                                ? 'Ativada: envia apenas percentuais e índices anonimizados (0 reais, 0 bancos, 0 nomes)'
                                : 'Desativada: envia valores completos do fluxo mensal'
                        }}
                    </span>
                </label>

                <button
                    type="button"
                    class="btn-preview-json"
                    @click="showPayloadPreview = !showPayloadPreview"
                >
                    <PhEyeSlash v-if="showPayloadPreview" size="14" />
                    <PhEye v-else size="14" />
                    {{ showPayloadPreview ? 'Ocultar JSON' : 'Ver JSON enviado à IA' }}
                </button>
            </div>

            <pre v-if="showPayloadPreview" class="json-preview-box">{{ previewPayloadJson }}</pre>
        </div>

        <div class="copilot-workspace">
            <!-- CHAT FULL-WIDTH -->
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

                            <div v-if="msg.role === 'ai'" class="message-bubble markdown-body" v-html="renderMarkdown(msg.content)"></div>
                            <div v-else class="message-bubble">{{ msg.content }}</div>

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
                    <button type="button" class="prompt-chip" @click="sendQuickPrompt('Quero comprar um produto de R$ 300, vale a pena agora com meu momento atual?')">
                        <PhLightning size="13" weight="fill" />
                        Posso comprar algo de R$ 300 agora?
                    </button>
                    <button type="button" class="prompt-chip" @click="sendQuickPrompt('Como posso economizar melhor nas minhas maiores categorias e balancear minha carteira?')">
                        Como economizar e investir melhor?
                    </button>
                </div>

                <footer class="input-area">
                    <form class="input-wrapper" @submit.prevent="sendMessage()">
                        <input
                            type="text"
                            v-model="promptText"
                            placeholder="Ex: Quero comprar algo de 300 reais em 3x, vale a pena?"
                            class="ai-input"
                            :disabled="isTyping"
                        />
                        <button type="submit" class="send-btn" :disabled="!promptText.trim() || isTyping">
                            <PhPaperPlaneTilt size="19" weight="fill" />
                        </button>
                    </form>
                </footer>
            </div>
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
        word-wrap: break-word;
    }

    .is-ai .message-bubble {
        background-color: var(--bg-elevated);
        color: var(--text-primary);
        border-bottom-left-radius: 4px;
        border: 1px solid var(--border-color);
    }

    .markdown-body :deep(p) {
        margin: 0 0 0.65rem 0;
    }

    .markdown-body :deep(p:last-child),
    .markdown-body :deep(ul:last-child),
    .markdown-body :deep(ol:last-child) {
        margin-bottom: 0;
    }

    .markdown-body :deep(h3),
    .markdown-body :deep(h4) {
        margin: 0.75rem 0 0.4rem 0;
        font-size: 0.95rem;
        font-weight: 700;
        color: var(--text-primary);
    }

    .markdown-body :deep(h3:first-child),
    .markdown-body :deep(h4:first-child) {
        margin-top: 0;
    }

    .markdown-body :deep(ul),
    .markdown-body :deep(ol) {
        margin: 0.35rem 0 0.65rem 0;
        padding-left: 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
    }

    .markdown-body :deep(li) {
        line-height: 1.5;
    }

    .markdown-body :deep(strong) {
        color: var(--text-primary);
        font-weight: 700;
    }

    .markdown-body :deep(code) {
        background: rgba(99, 102, 241, 0.14);
        color: var(--primary-color);
        padding: 0.1rem 0.38rem;
        border-radius: 5px;
        font-size: 0.82rem;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    
    .is-user .message-bubble {
        background: var(--primary-color);
        color: var(--text-inverse);
        border-bottom-right-radius: 4px;
        white-space: pre-line;
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

    .header-right-actions {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        flex-wrap: wrap;
    }

    .privacy-bar {
        background: var(--bg-card);
        border: 1px solid rgba(16, 185, 129, 0.3);
        border-radius: 13px;
        padding: 0.7rem 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
    }

    .privacy-bar-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.65rem;
    }

    .privacy-toggle-label {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        font-size: 0.8rem;
        color: var(--text-secondary);
        cursor: pointer;
    }

    .privacy-toggle-label strong {
        color: var(--success-text);
    }

    .privacy-toggle-label input[type="checkbox"] {
        width: 16px;
        height: 16px;
        accent-color: #10B981;
        cursor: pointer;
        flex-shrink: 0;
    }

    .btn-preview-json {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: var(--bg-elevated);
        border: 1px solid var(--border-color);
        color: var(--text-primary);
        font-family: inherit;
        font-size: 0.74rem;
        font-weight: 600;
        padding: 0.35rem 0.75rem;
        border-radius: 8px;
        cursor: pointer;
    }

    .btn-preview-json:hover {
        border-color: var(--primary-color);
        color: var(--primary-color);
    }

    .json-preview-box {
        margin: 0;
        padding: 0.85rem 1rem;
        border-radius: 10px;
        background: #090A0F;
        border: 1px solid var(--border-color);
        color: #A5B4FC;
        font-size: 0.74rem;
        line-height: 1.45;
        max-height: 220px;
        overflow: auto;
        white-space: pre-wrap;
        word-break: break-word;
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
