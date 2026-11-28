<script setup lang="ts">
    import { ref, computed } from 'vue';
    import {
        PhMagnifyingGlass, PhCaretDown, PhShieldCheck, PhSparkle,
        PhCreditCard, PhPiggyBank, PhHeart, PhWhatsappLogo, PhRobot
    } from '@phosphor-icons/vue';

    interface FaqItem {
        id: string;
        category: 'vault' | 'cards' | 'ai' | 'couple';
        question: string;
        answer: string;
    }

    const searchQuery = ref('');
    const activeCategory = ref<'all' | 'vault' | 'cards' | 'ai' | 'couple'>('all');
    const openFaqId = ref<string | null>('faq-3');

    const categories = [
        { id: 'all', label: 'Todos os Tópicos', icon: PhSparkle },
        { id: 'cards', label: 'Faturas & Cartões', icon: PhCreditCard },
        { id: 'ai', label: 'Copilot IA & VPL', icon: PhRobot },
        { id: 'couple', label: 'Modo Casal & Cofrinhos', icon: PhHeart },
        { id: 'vault', label: 'Privacidade & Segurança', icon: PhShieldCheck },
    ] as const;

    const faqs: FaqItem[] = [
        {
            id: 'faq-3',
            category: 'cards',
            question: 'Qual a diferença entre o filtro "Por Mês" e "Por Fatura" na barra superior?',
            answer: 'No modo "Por Mês", o Somma exibe todos os gastos e receitas do dia 1º ao último dia do mês calendário. Já no modo "Por Fatura", o sistema calcula automaticamente a janela de compras com base no "Dia de Fechamento" configurado em cada cartão de crédito (ex: compras feitas entre 26 do mês anterior e 25 do mês atual).'
        },
        {
            id: 'faq-4',
            category: 'ai',
            question: 'Como o Simulador do Copilot decide entre comprar à vista ou parcelado?',
            answer: 'O motor matemático calcula o Valor Presente Líquido (VPL) das parcelas descontado pela taxa mensal líquida do seu Cofrinho (padrão 0,85% a.m., ~100% do CDI líquido). Se a compra não tem juros (ou se os juros são menores que o rendimento composto do dinheiro guardado no cofrinho durante o período), parcelar gera ganho financeiro líquido — desde que a parcela não ultrapasse 20% da sua sobra mensal.'
        },
        {
            id: 'faq-5',
            category: 'couple',
            question: 'O que significa a opção "Compõe o saldo?" ao criar um Cofrinho?',
            answer: 'Cofrinhos marcados com "Compõe o saldo" representam reservas de liquidez imediata (ex: dinheiro na conta corrente remunerada pronto para uso) e são somados ao seu Saldo Disponível na Visão Geral. Cofrinhos desmarcados funcionam como "Metas Isoladas" (ex: Troca de Carro, Viagem), protegendo aquele dinheiro para que você não conte com ele no orçamento do mês.'
        },
        {
            id: 'faq-6',
            category: 'couple',
            question: 'Como funciona a Divisão Proporcional no Modo Casal?',
            answer: 'Em vez de dividir as contas da casa 50% para cada um (o que pesa mais para quem ganha menos), a divisão proporcional calcula o peso da renda de cada parceiro na renda total do casal. Se você ganha 60% da renda total da casa, sua cota justa nas despesas compartilhadas será de 60%, garantindo que ambos comprometam o mesmo percentual do próprio salário.'
        },
        {
            id: 'faq-1',
            category: 'vault',
            question: 'Como ocultar rapidamente meus valores em locais públicos ou no trabalho?',
            answer: 'Basta clicar no ícone de olho na barra superior (ou usar o atalho Alt+P no teclado). Todos os saldos, gráficos e valores da tela ficam desfocados instantaneamente até você clicar novamente.'
        },
        {
            id: 'faq-2',
            category: 'vault',
            question: 'Como funciona o login por Digital / Face ID no celular?',
            answer: 'Em Configurações, você pode ativar o login biométrico neste aparelho. Sua digital é validada diretamente pelo chip de segurança do seu telefone (WebAuthn / Android BiometricPrompt) e nunca sai do dispositivo, protegendo o acesso ao app estilo Nubank e Inter.'
        }
    ];

    const filteredFaqs = computed(() => {
        return faqs.filter(item => {
            if (activeCategory.value !== 'all' && item.category !== activeCategory.value) {
                return false;
            }
            if (searchQuery.value.trim()) {
                const q = searchQuery.value.trim().toLowerCase();
                return item.question.toLowerCase().includes(q) || item.answer.toLowerCase().includes(q);
            }
            return true;
        });
    });

    const toggleFaq = (id: string) => {
        openFaqId.value = openFaqId.value === id ? null : id;
    };
</script>

<template>
    <div class="help-page">
        <!-- Hero de Busca -->
        <header class="help-hero">
            <div class="hero-glow"></div>
            <span class="hero-pill">Suporte & Documentação</span>
            <h1>Central de Ajuda Somma AI</h1>
            <p>Aprenda a organizar seus ciclos de fatura, planejar reservas nos cofrinhos e tomar decisões melhores com o Copilot IA</p>

            <div class="search-box">
                <PhMagnifyingGlass size="20" class="search-icon" />
                <input
                    type="text"
                    v-model="searchQuery"
                    placeholder="Pesquisar dúvida (ex: Fatura, Cofrinho, CDI, Modo Casal)..."
                />
            </div>
        </header>

        <!-- Guias Rápidos (3 Cards) -->
        <section class="quick-guides">
            <div class="guide-card">
                <div class="guide-icon icon-indigo">
                    <PhCreditCard size="22" weight="duotone" />
                </div>
                <h3>1. Controle por Ciclo de Fatura</h3>
                <p>Alterne entre o calendário do mês e o ciclo real de fechamento de cada cartão de crédito no seletor de data do topo.</p>
            </div>

            <div class="guide-card">
                <div class="guide-icon icon-green">
                    <PhPiggyBank size="22" weight="duotone" />
                </div>
                <h3>2. Liquidez vs. Metas Isoladas</h3>
                <p>Separe o dinheiro que compõe o giro do mês das reservas intocáveis de médio e longo prazo na aba Investimentos.</p>
            </div>

            <div class="guide-card">
                <div class="guide-icon icon-purple">
                    <PhSparkle size="22" weight="duotone" />
                </div>
                <h3>3. Consultoria com VPL</h3>
                <p>Use o Simulador no Copilot IA antes de qualquer compra grande para descobrir se vale mais pagar no Pix ou parcelar no cartão.</p>
            </div>
        </section>

        <!-- Filtros de Categoria + Accordion FAQ -->
        <section class="faq-section">
            <div class="category-pills">
                <button
                    v-for="cat in categories"
                    :key="cat.id"
                    type="button"
                    class="cat-pill"
                    :class="{ active: activeCategory === cat.id }"
                    @click="activeCategory = cat.id"
                >
                    <component :is="cat.icon" size="16" :weight="activeCategory === cat.id ? 'fill' : 'regular'" />
                    <span>{{ cat.label }}</span>
                </button>
            </div>

            <div class="faq-list" v-if="filteredFaqs.length > 0">
                <div
                    v-for="faq in filteredFaqs"
                    :key="faq.id"
                    class="faq-item"
                    :class="{ open: openFaqId === faq.id }"
                >
                    <button type="button" class="faq-question" @click="toggleFaq(faq.id)">
                        <span>{{ faq.question }}</span>
                        <PhCaretDown size="18" class="faq-caret" />
                    </button>
                    <div class="faq-answer" v-if="openFaqId === faq.id">
                        <p>{{ faq.answer }}</p>
                    </div>
                </div>
            </div>

            <div v-else class="empty-state">
                Nenhuma resposta encontrada para "{{ searchQuery }}".
            </div>
        </section>

        <!-- Rodapé de Contato / Assistência -->
        <footer class="support-banner">
            <div class="banner-left">
                <h3>Ainda precisa de ajuda com suas finanças?</h3>
                <p>Converse diretamente com o Somma Copilot IA ou chame nosso bot integrado no WhatsApp.</p>
            </div>
            <div class="banner-actions">
                <button class="btn-secondary" @click="$router.push('/copilot')">
                    <PhRobot size="18" /> Abrir Copilot IA
                </button>
                <a href="https://wa.me/5527997816701" target="_blank" class="btn-primary whatsapp-btn">
                    <PhWhatsappLogo size="18" weight="fill" /> Bot no WhatsApp
                </a>
            </div>
        </footer>
    </div>
</template>

<style scoped>
    .help-page {
        display: flex;
        flex-direction: column;
        gap: 1.75rem;
    }

    .help-hero {
        position: relative;
        overflow: hidden;
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 18px;
        padding: 2.5rem 2rem;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        box-shadow: var(--shadow-sm);
    }

    .hero-glow {
        position: absolute;
        top: -100px;
        width: 420px;
        height: 260px;
        background: radial-gradient(circle, rgba(99, 102, 241, 0.16) 0%, transparent 70%);
        pointer-events: none;
    }

    .hero-pill {
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        padding: 4px 12px;
        border-radius: 99px;
        background: var(--primary-subtle);
        color: var(--primary-color);
        border: 1px solid rgba(99, 102, 241, 0.25);
        margin-bottom: 0.85rem;
    }

    .help-hero h1 {
        margin: 0 0 0.5rem 0;
        font-size: 2rem;
        font-weight: 800;
        letter-spacing: -0.03em;
        color: var(--text-primary);
    }

    .help-hero p {
        margin: 0 0 1.75rem 0;
        color: var(--text-secondary);
        max-width: 580px;
        font-size: 0.95rem;
        line-height: 1.5;
    }

    .search-box {
        position: relative;
        width: 100%;
        max-width: 540px;
        display: flex;
        align-items: center;
    }

    .search-icon {
        position: absolute;
        left: 16px;
        color: var(--text-muted);
        pointer-events: none;
    }

    .search-box input {
        width: 100%;
        height: 48px;
        padding: 0 1.25rem 0 46px;
        border-radius: 12px;
        background: var(--bg-elevated);
        border: 1px solid var(--border-color);
        color: var(--text-primary);
        font-size: 0.925rem;
    }

    .search-box input:focus {
        border-color: var(--primary-color);
        background: var(--bg-card);
    }

    /* === GUIAS RÁPIDOS === */
    .quick-guides {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 1.25rem;
    }

    .guide-card {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 16px;
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
        box-shadow: var(--shadow-sm);
    }

    .guide-icon {
        width: 42px;
        height: 42px;
        border-radius: 11px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 0.25rem;
    }

    .icon-indigo { background: var(--primary-subtle); color: var(--primary-color); }
    .icon-green { background: var(--success-bg); color: var(--success-text); }
    .icon-purple { background: var(--purple-bg); color: var(--purple-color); }

    .guide-card h3 {
        margin: 0;
        font-size: 1rem;
        font-weight: 700;
        color: var(--text-primary);
    }

    .guide-card p {
        margin: 0;
        font-size: 0.85rem;
        line-height: 1.55;
        color: var(--text-secondary);
    }

    .guide-card code {
        background: var(--bg-elevated);
        border: 1px solid var(--border-color);
        padding: 2px 6px;
        border-radius: 5px;
        font-size: 0.78rem;
        color: var(--primary-color);
    }

    /* === FAQ ACCORDION === */
    .faq-section {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
    }

    .category-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
    }

    .cat-pill {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        padding: 0.5rem 1rem;
        border-radius: 10px;
        border: 1px solid var(--border-color);
        background: var(--bg-card);
        color: var(--text-secondary);
        font-family: inherit;
        font-size: 0.825rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .cat-pill:hover {
        color: var(--text-primary);
        background: var(--bg-hover);
    }

    .cat-pill.active {
        background: var(--primary-subtle);
        color: var(--primary-color);
        border-color: rgba(99, 102, 241, 0.35);
    }

    .faq-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .faq-item {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 14px;
        overflow: hidden;
        transition: border-color 0.15s ease;
    }

    .faq-item.open {
        border-color: rgba(99, 102, 241, 0.4);
    }

    .faq-question {
        width: 100%;
        background: transparent;
        border: none;
        padding: 1.15rem 1.35rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        text-align: left;
        font-family: inherit;
        font-size: 0.95rem;
        font-weight: 600;
        color: var(--text-primary);
        cursor: pointer;
    }

    .faq-caret {
        color: var(--text-secondary);
        transition: transform 0.2s ease;
        flex-shrink: 0;
    }

    .faq-item.open .faq-caret {
        transform: rotate(180deg);
        color: var(--primary-color);
    }

    .faq-answer {
        padding: 0 1.35rem 1.25rem;
        border-top: 1px solid var(--border-subtle);
    }

    .faq-answer p {
        margin: 0.85rem 0 0 0;
        font-size: 0.88rem;
        line-height: 1.65;
        color: var(--text-secondary);
    }

    /* === BANNER SUPORTE === */
    .support-banner {
        background: var(--card-highlight-bg);
        border: 1px solid var(--card-highlight-border);
        border-radius: 16px;
        padding: 1.75rem 2rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 1.25rem;
    }

    .banner-left h3 {
        margin: 0 0 0.25rem 0;
        font-size: 1.1rem;
        font-weight: 700;
        color: var(--text-primary);
    }

    .banner-left p {
        margin: 0;
        font-size: 0.875rem;
        color: var(--text-secondary);
    }

    .banner-actions {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
    }

    .whatsapp-btn {
        text-decoration: none;
    }

    @media (max-width: 960px) {
        .quick-guides {
            grid-template-columns: 1fr;
        }
    }
</style>
