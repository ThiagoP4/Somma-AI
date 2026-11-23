<script setup lang="ts">
    import { ref, onMounted, nextTick, computed, watch } from 'vue';
    import { storeToRefs } from 'pinia';
    import {
        PhSparkle, PhRobot, PhPaperPlaneTilt, PhUser,
        PhShieldCheck, PhLockKey, PhLightning
    } from '@phosphor-icons/vue';
    import { supabase } from '../services/supabase';
    import { useProfileStore } from '../stores/useProfileStore';
    import { usePiggybankStore } from '../stores/usePiggybankStore';
    import { useAssetsStore } from '../stores/useAssetsStore';
    import { useVaultStore } from '../stores/useVaultStore';
    import { useFilterStore } from '../stores/useFilterStore';
    import { useFinanceStore } from '../stores/useFinanceStore';
    import {
        buildZeroKnowledgeDiagnostics,
        extractMentionedPurchaseImpact,
        type FutureMonthCommittedInput,
        type PostgresStatisticalMlStats
    } from '../utils/financialDiagnostics';

    const profileStore = useProfileStore();
    const piggybankStore = usePiggybankStore();
    const assetsStore = useAssetsStore();
    const vaultStore = useVaultStore();
    const filterStore = useFilterStore();
    const financeStore = useFinanceStore();
    const { isVaultUnlocked } = storeToRefs(vaultStore);
    const { selectedMonth, selectedYear } = storeToRefs(filterStore);

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

    // Contexto Financeiro Real para alimentar o Motor Zero-Knowledge (calculado localmente)
    const monthlyIncomes = ref(0);
    const monthlyExpenses = ref(0);
    const monthlyDirectExpenses = ref(0);
    const monthlyCreditCardInvoice = ref(0);
    const monthlySubscriptions = ref(0);
    const last3MonthsAvgTotalSpend = ref(0);
    const last3MonthsAvgDiscretionarySpend = ref(0);
    const next3MonthsCommitted = ref<FutureMonthCommittedInput[]>([]);
    const monthDayProgressPct = ref(50);
    const postgresMlStats = ref<PostgresStatisticalMlStats | null>(null);

    const PT_MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    const loadFinancialContext = async () => {
        try {
            const selY = selectedYear.value;
            const selM = selectedMonth.value;
            const startOfMonth = new Date(selY, selM, 1).toISOString().split('T')[0];
            const endOfMonth = new Date(selY, selM + 1, 0).toISOString().split('T')[0];

            // Progresso do mês (ex: dia 22/30 = 73.3%; se for mês passado = 100%, se futuro = 5%)
            const now = new Date();
            const daysInSelMonth = new Date(selY, selM + 1, 0).getDate();
            if (selY < now.getFullYear() || (selY === now.getFullYear() && selM < now.getMonth())) {
                monthDayProgressPct.value = 100;
            } else if (selY > now.getFullYear() || (selY === now.getFullYear() && selM > now.getMonth())) {
                monthDayProgressPct.value = 5;
            } else {
                monthDayProgressPct.value = Math.round((now.getDate() / daysInSelMonth) * 1000) / 10;
            }

            const { data: inc } = await supabase
                .from('fin_income')
                .select('value')
                .gte('date', startOfMonth)
                .lte('date', endOfMonth)
                .eq('user_id', profileStore.userId);

            monthlyIncomes.value = (inc || []).reduce((acc: number, c: any) => acc + Number(c.value), 0);

            // Busca uma janela de 7 meses (3 anteriores + atual + 3 futuros) em 1 única consulta
            const startWindow = new Date(selY, selM - 3, 1).toISOString().split('T')[0];
            const endWindow = new Date(selY, selM + 4, 0).toISOString().split('T')[0];

            const { data: allExp } = await supabase
                .from('fin_installment')
                .select('value, dueDate, installmentNumber, fin_purchase ( payment_id, total_installments, usr_payment ( id_payment, closing_day ), fin_category ( description ) )')
                .gte('dueDate', startWindow)
                .lte('dueDate', endWindow);

            let directTotal = 0;
            let creditCardTotal = 0;
            const catMap: Record<string, number> = {};

            // Mapas para os últimos 3 meses (tendência) e próximos 3 meses (compromissos futuros)
            const prevKeys: string[] = [];
            for (let offset = -3; offset <= -1; offset++) {
                const d = new Date(selY, selM + offset, 1);
                prevKeys.push(`${d.getFullYear()}-${d.getMonth()}`);
            }
            const prevTotalMap: Record<string, number> = {};
            const prevDiscretionaryMap: Record<string, number> = {};

            const futureMonths: Array<{ key: string; label: string; total: number }> = [];
            for (let offset = 1; offset <= 3; offset++) {
                const d = new Date(selY, selM + offset, 1);
                const key = `${d.getFullYear()}-${d.getMonth()}`;
                const label = `${PT_MONTH_SHORT[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`;
                futureMonths.push({ key, label, total: 0 });
            }

            const currentMonthKey = `${selY}-${selM}`;

            for (const item of (allExp || []) as any[]) {
                const val = Number(item.value || 0);
                if (!item.dueDate) continue;
                const d = new Date(item.dueDate);
                if (Number.isNaN(d.getTime())) continue;
                const key = `${d.getFullYear()}-${d.getMonth()}`;

                if (key === currentMonthKey) {
                    const isCreditCard = Boolean(item?.fin_purchase?.payment_id || item?.fin_purchase?.usr_payment);
                    if (isCreditCard) {
                        creditCardTotal += val;
                    } else {
                        directTotal += val;
                    }
                    const catName = item?.fin_purchase?.fin_category?.description || 'Outros';
                    catMap[catName] = (catMap[catName] || 0) + val;
                } else if (prevKeys.includes(key)) {
                    prevTotalMap[key] = (prevTotalMap[key] || 0) + val;
                    // Gastos avulsos/rotineiros (1x ou parcela 1) para estimar consumo típico sem duplicar parcelas antigas
                    const totalInst = Number(item?.fin_purchase?.total_installments || 1);
                    if (totalInst <= 1) {
                        prevDiscretionaryMap[key] = (prevDiscretionaryMap[key] || 0) + val;
                    }
                } else {
                    const fut = futureMonths.find(f => f.key === key);
                    if (fut) {
                        fut.total += val;
                    }
                }
            }

            monthlyDirectExpenses.value = directTotal;
            monthlyCreditCardInvoice.value = creditCardTotal;
            monthlyExpenses.value = directTotal + creditCardTotal;
            categoryTotals.value = catMap;

            const activePrevMonths = prevKeys.filter(k => (prevTotalMap[k] || 0) > 0);
            const denom = activePrevMonths.length || 1;
            last3MonthsAvgTotalSpend.value = activePrevMonths.length > 0
                ? activePrevMonths.reduce((acc, k) => acc + (prevTotalMap[k] || 0), 0) / denom
                : 0;
            last3MonthsAvgDiscretionarySpend.value = activePrevMonths.length > 0
                ? activePrevMonths.reduce((acc, k) => acc + (prevDiscretionaryMap[k] || 0), 0) / denom
                : 0;

            next3MonthsCommitted.value = futureMonths.map(f => ({
                monthLabel: f.label,
                committedInstallments: Math.round(f.total * 100) / 100
            }));

            // Lê assinaturas ativas via useFinanceStore (opt_subscription)
            await financeStore.fetchSubscriptions();
            monthlySubscriptions.value = financeStore.activeMonthlySubscriptionsTotal;

            // Tenta carregar estatística ML nativa do PostgreSQL (Mediana + Regressão Linear regr_slope + Z-Score)
            try {
                const { data: mlData, error: mlErr } = await supabase.rpc('get_user_spending_ml_stats', {
                    p_year: selY,
                    p_month: selM + 1
                });
                if (!mlErr && mlData) {
                    postgresMlStats.value = mlData as PostgresStatisticalMlStats;
                } else {
                    postgresMlStats.value = null;
                }
            } catch {
                postgresMlStats.value = null;
            }

            await Promise.all([
                piggybankStore.fetchPiggybanks(),
                assetsStore.fetchAssets()
            ]);
        } catch (e) {
            console.error('Erro ao carregar contexto do Copilot:', e);
        }
    };

    watch([selectedMonth, selectedYear, isVaultUnlocked], async () => {
        if (profileStore.userId) {
            await loadFinancialContext();
        }
    });

    const freeMonthlyCashFlow = computed(() => {
        return monthlyIncomes.value - monthlyExpenses.value;
    });

    const composingVaultBalance = computed(() => {
        if (!isVaultUnlocked.value) return 0;
        return piggybankStore.piggybanks
            .filter(p => p.composes_balance)
            .reduce((acc, p) => acc + Number(p.current_amount || 0), 0);
    });

    const isolatedLiquidReserves = computed(() => {
        if (!isVaultUnlocked.value) return null;
        return piggybankStore.piggybanks
            .filter(p => !p.composes_balance && p.liquidity !== 'maturity')
            .reduce((acc, p) => acc + Number(p.current_amount || 0), 0);
    });

    const spendableNowFree = computed(() => {
        return freeMonthlyCashFlow.value + composingVaultBalance.value;
    });

    onMounted(async () => {
        if (!profileStore.userId) {
            await profileStore.fetchProfileData();
        }
        await loadFinancialContext();

        messages.value.push({
            id: Date.now(),
            role: 'ai',
            content: 'Olá! Sou o Somma Copilot. Já carreguei seu fluxo do mês, fatura do cartão, tendência dos próximos 3 meses' +
                (isVaultUnlocked.value ? ' e seu patrimônio do Cofre Tailscale.' : ' (Cofre Tailscale isolado no momento).') +
                ' Como posso te ajudar hoje?'
        });
    });

    // Motor de Diagnóstico Local (100% Zero-Knowledge com 4 níveis de peso + tendência de consumo)
    const localDiagnostics = computed(() =>
        buildZeroKnowledgeDiagnostics({
            monthlyIncomes: monthlyIncomes.value,
            monthlyExpenses: monthlyExpenses.value,
            monthlyDirectExpenses: monthlyDirectExpenses.value,
            monthlyCreditCardInvoice: monthlyCreditCardInvoice.value,
            monthlySubscriptions: monthlySubscriptions.value,
            categoryTotals: categoryTotals.value,
            last3MonthsAvgTotalSpend: last3MonthsAvgTotalSpend.value,
            last3MonthsAvgDiscretionarySpend: last3MonthsAvgDiscretionarySpend.value,
            next3MonthsCommitted: next3MonthsCommitted.value,
            monthDayProgressPct: monthDayProgressPct.value,
            postgresMlStats: postgresMlStats.value,
            isVaultUnlocked: isVaultUnlocked.value,
            piggybanks: piggybankStore.piggybanks,
            variableAssets: assetsStore.assets,
            financialGoals: profileStore.financialGoals
        })
    );

    const buildFinancialSnapshotPayload = (userMessageText = '') => {
        const mentionedPurchaseImpact = extractMentionedPurchaseImpact(userMessageText, {
            monthlyIncomes: monthlyIncomes.value,
            freeMonthlyCashFlow: freeMonthlyCashFlow.value,
            spendableNowFree: spendableNowFree.value,
            isolatedReserves: isolatedLiquidReserves.value
        });

        return {
            ...localDiagnostics.value.anonymizedProfile,
            ...(mentionedPurchaseImpact ? { mentionedPurchaseImpact } : {})
        };
    };

    const runOfflineDiagnosticInChat = async () => {
        const diag = localDiagnostics.value;
        const p = diag.anonymizedProfile;
        const w1 = p.weight1_immediateCashAndCurrentMonth;
        const w2 = p.weight2_trendAndNext3MonthsForecast;
        const w3 = p.weight3_wealthGoalsAndInvestments;
        const w4 = p.weight4_safetyBufferContextOnly;

        const forecastLines = w2.next3MonthsForecast.length > 0
            ? w2.next3MonthsForecast.map(m =>
                `- **${m.monthLabel}:** ${m.committedPctOfIncome}% já comprometido • **tendência total: ${m.projectedTotalSpendPctOfIncome}%** da renda (sobra prevista: ${m.projectedSavingsPct}%)`
            ).join('\n')
            : '- Sem dados futuros cadastrados ainda.';

        const topCats = p.topExpenseCategoriesPct.length > 0
            ? p.topExpenseCategoriesPct.map(c => `- **${c.category}:** ${c.sharePct}%`).join('\n')
            : '- Sem despesas categorizadas neste mês.';
        const tips = diag.localInsights.length > 0
            ? diag.localInsights.map(t => `- ✅ ${t}`).join('\n')
            : '- ✅ Cadastre receitas, despesas e contas para gerar recomendações locais.';

        messages.value.push({
            id: Date.now(),
            role: 'ai',
            content: [
                `### 🛡️ Raio-X Financeiro Local (100% Offline)`,
                ``,
                `**1. Caixa & Mês Atual (Entradas × Despesas)**`,
                `- **Poupança Atual:** ${w1.savingsRatePct}% (Comprometimento: ${w1.expenseCommitmentPct}% com ${w1.monthProgressPct}% do mês decorrido)`,
                `- **Gastos Diretos:** ${w1.directExpensesSharePct}% das saídas | **Fatura de Cartão:** ${w1.creditCardInvoiceSharePct}% (${w1.creditCardToIncomePct}% da renda)`,
                ``,
                `**2. Tendência de Consumo & Próximos 3 Meses**`,
                `- **Projeção de fechamento deste mês:** ~${w2.currentMonthProjectedCommitmentPct}% da renda` +
                    (w2.vsLast3MonthsAvgSpendPct !== null ? ` (${w2.vsLast3MonthsAvgSpendPct >= 0 ? '+' : ''}${w2.vsLast3MonthsAvgSpendPct}% vs. média dos últimos 3 meses)` : ''),
                forecastLines,
                ``,
                `**3. Patrimônio & Reserva**`,
                w3.vaultConnected
                    ? `- **Carteira:** ${w3.fixedIncomePct}% Renda Fixa / ${w3.variableIncomeAndCryptoPct}% Variável & Cripto` + (w3.cryptoShareOfWealthPct > 0 ? ` (Cripto: ${w3.cryptoShareOfWealthPct}%)` : '')
                    : `- Cofre Tailscale isolado no momento.`,
                w4.emergencyRunwayMonths !== null
                    ? `- **Colchão de Emergência:** ${w4.emergencyRunwayMonths} meses de custo de vida (mantido separado de compras do mês)`
                    : ``,
                ``,
                `**📌 Maiores Categorias do Mês (%)**`,
                topCats,
                ``,
                `**💡 Diagnóstico & Próximos Passos**`,
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
        const w1 = p.weight1_immediateCashAndCurrentMonth;
        const w2 = p.weight2_trendAndNext3MonthsForecast;
        const impact = extractMentionedPurchaseImpact(userText, {
            monthlyIncomes: monthlyIncomes.value,
            freeMonthlyCashFlow: freeMonthlyCashFlow.value,
            spendableNowFree: spendableNowFree.value,
            isolatedReserves: isolatedLiquidReserves.value
        });

        const lines: string[] = [
            `### 🛡️ Resposta do Motor Local (Offline)`,
            ``
        ];

        if (impact) {
            lines.push(
                `**📌 Impacto da compra mencionada (R$ ${impact.detectedAmountBrl.toFixed(2)} em ${impact.detectedInstallments}x):**`,
                `- **Na sobra livre do mês:** ${impact.shareOfMonthlyFreeCashFlowPct ?? 'N/A'}% (${impact.fitsInMonthlyFreeCashFlow ? 'cabe na sobra mensal ✅' : 'ultrapassa sua sobra mensal ⚠️'})`,
                `- **No saldo disponível agora:** ${impact.shareOfSpendableNowPct ?? 'N/A'}% (${impact.fitsInSpendableNow ? 'cabe no saldo disponível ✅' : 'aperta seu saldo disponível ⚠️'})`
            );
        }

        lines.push(
            `- **Mês atual:** poupança de ${w1.savingsRatePct}% (projeção de fechamento: ${w2.currentMonthProjectedCommitmentPct}% da renda)`,
            ...diag.localInsights.map(t => `- ✅ ${t}`)
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
                    sessionId: 'anonymous-zero-knowledge',
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
                            {{ isVaultUnlocked ? 'Cofre Conectado' : 'Apenas Fluxo Mensal' }}
                        </span>
                        <span class="context-pill privacy">
                            <PhShieldCheck size="13" weight="fill" />
                            Privacidade Zero-Knowledge
                        </span>
                    </div>
                    <p>Consultor financeiro privado — seus saldos e bancos nunca saem do aparelho</p>
                </div>
            </div>
        </header>

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
                    <button type="button" class="prompt-chip offline-chip" @click="runOfflineDiagnosticInChat">
                        <PhShieldCheck size="14" weight="fill" />
                        Raio-X Offline
                    </button>
                    <button type="button" class="prompt-chip" @click="sendQuickPrompt('Quero comprar um produto de R$ 300 em 3x, vale a pena agora?')">
                        <PhLightning size="13" weight="fill" />
                        Posso comprar algo de R$ 300?
                    </button>
                    <button type="button" class="prompt-chip" @click="sendQuickPrompt('Analise meus gastos diretos vs. fatura do cartão e como posso economizar melhor.')">
                        Analisar fatura e gastos
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

    .context-pill.privacy {
        background: rgba(99, 102, 241, 0.12);
        color: var(--primary-color);
        border: 1px solid rgba(99, 102, 241, 0.28);
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

    .prompt-chip.offline-chip {
        background: rgba(16, 185, 129, 0.12);
        border-color: rgba(16, 185, 129, 0.35);
        color: #10B981;
    }

    .prompt-chip.offline-chip:hover {
        background: rgba(16, 185, 129, 0.2);
        border-color: #10B981;
        color: #34D399;
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
        .chat-column {
            height: 520px;
        }
    }
</style>
