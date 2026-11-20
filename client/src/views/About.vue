<script setup lang="ts">
    import {
        PhShieldCheck, PhSparkle, PhDatabase, PhCode, PhLockKey,
        PhChartLineUp, PhGithubLogo, PhCheckCircle, PhCpu
    } from '@phosphor-icons/vue';
    import logoUrl from '../assets/somma-logo.svg';

    const architecturePillars = [
        {
            icon: PhShieldCheck,
            title: 'Zero-Trust Tailscale Vault',
            description: 'Arquitetura Dual-DB que separa os gastos cotidianos (Supabase Cloud) do seu patrimônio bancário e cofrinhos, acessíveis exclusivamente dentro da sua rede mesh Tailscale (100.64.0.0/10).'
        },
        {
            icon: PhSparkle,
            title: 'Copilot IA & Motor VPL',
            description: 'Assistente integrado ao n8n e motor matemático de Valor Presente Líquido que cruza sua sobra mensal com o rendimento líquido do CDI para decidir entre compras à vista ou parceladas.'
        },
        {
            icon: PhChartLineUp,
            title: 'Inteligência de Faturas & Casal',
            description: 'Acompanhamento por ciclo real de fechamento de cada cartão, controle de assinaturas recorrentes, termômetro 50/30/20 e divisão proporcional justa no Modo Casal.'
        }
    ];

    const techStack = [
        { name: 'Vue 3 + TypeScript', role: 'Composition API & Tipagem Estrita', badge: 'Frontend' },
        { name: 'Pinia Stores', role: 'Gerenciamento de Estado Reativo', badge: 'State' },
        { name: 'Supabase (PostgreSQL)', role: 'Autenticação JWT, RLS & Cloud Sync', badge: 'Cloud DB' },
        { name: 'Tailscale Mesh VPN', role: 'Túnel Criptografado WireGuard (.ts.net)', badge: 'Zero-Trust' },
        { name: 'n8n Workflow Engine', role: 'Orquestração de Agentes LLM & Webhooks', badge: 'AI Agent' },
        { name: 'ApexCharts & Capacitor', role: 'Visualização Analítica & Build Híbrido Android', badge: 'UI / Mobile' }
    ];

    const changelog = [
        {
            version: 'v2.4.0',
            date: 'Novembro 2026',
            title: 'Tailscale Zero-Trust Vault & Cartões 3D',
            items: [
                'Implementação da Arquitetura Dual-DB com micro-servidor Node.js restrito à sub-rede CGNAT do Tailscale.',
                'Inspeção interativa de cartões de crédito em 3D com giro de 180° e resumo da fatura no verso.',
                'Novo Simulador de Decisão de Compra (À Vista vs. Parcelado) com cálculo de VPL descontado pelo CDI.',
                'Lançamento dos módulos de Assinaturas Recorrentes, Modo Casal Proporcional e Design System Obsidian Indigo.'
            ]
        },
        {
            version: 'v1.0.0',
            date: '2026',
            title: 'Fundação Somma AI',
            items: [
                'Controle de compras parceladas, entradas mensais e categorização customizada integrada ao Supabase.',
                'Integração inicial com bot de WhatsApp (WAHA) e fluxos automatizados no n8n.'
            ]
        }
    ];
</script>

<template>
    <div class="about-page">
        <!-- Hero Brand Card -->
        <section class="about-hero">
            <div class="hero-ambient"></div>
            <div class="brand-identity">
                <img :src="logoUrl" alt="Somma AI Logo" class="about-logo" />
                <div class="brand-titles">
                    <div class="title-line">
                        <h1>Somma</h1>
                        <span class="ai-badge">AI</span>
                        <span class="version-pill">v2.4.0 • Obsidian Edition</span>
                    </div>
                    <p class="tagline">
                        Plataforma de inteligência financeira pessoal com arquitetura híbrida Zero-Trust e suporte à decisão por IA.
                    </p>
                </div>
            </div>
        </section>

        <!-- 3 Pilares da Arquitetura -->
        <section class="pillars-grid">
            <div class="pillar-card" v-for="pillar in architecturePillars" :key="pillar.title">
                <div class="pillar-icon">
                    <component :is="pillar.icon" size="22" weight="duotone" />
                </div>
                <h3>{{ pillar.title }}</h3>
                <p>{{ pillar.description }}</p>
            </div>
        </section>

        <!-- Diagrama Visual da Arquitetura Dual-DB + Stack Técnica -->
        <div class="about-two-cols">
            <!-- Stack Tecnológica -->
            <section class="info-card">
                <div class="card-header">
                    <PhCode size="20" weight="duotone" class="header-ic" />
                    <h2>Stack Tecnológica</h2>
                </div>
                <div class="stack-list">
                    <div class="stack-row" v-for="tech in techStack" :key="tech.name">
                        <div class="stack-meta">
                            <strong>{{ tech.name }}</strong>
                            <span>{{ tech.role }}</span>
                        </div>
                        <span class="stack-badge">{{ tech.badge }}</span>
                    </div>
                </div>
            </section>

            <!-- Segurança & Fluxo de Dados -->
            <section class="info-card">
                <div class="card-header">
                    <PhLockKey size="20" weight="duotone" class="header-ic" />
                    <h2>Modelo de Privacidade Dual-DB</h2>
                </div>

                <div class="security-layers">
                    <div class="sec-layer">
                        <div class="layer-icon cloud">
                            <PhDatabase size="18" weight="duotone" />
                        </div>
                        <div class="layer-text">
                            <strong>Camada 1 — Nuvem Pública (Supabase RLS)</strong>
                            <p>Armazena apenas o fluxo operacional do mês (compras, parcelas e categorias) protegido por Row Level Security.</p>
                        </div>
                    </div>

                    <div class="sec-layer">
                        <div class="layer-icon vault">
                            <PhShieldCheck size="18" weight="duotone" />
                        </div>
                        <div class="layer-text">
                            <strong>Camada 2 — Cofre Privado (Tailscale Mesh)</strong>
                            <p>Saldos bancários e reservas patrimoniais trafegam exclusivamente via túnel WireGuard privado (.ts.net), invisíveis na internet pública.</p>
                        </div>
                    </div>

                    <div class="sec-layer">
                        <div class="layer-icon ai">
                            <PhCpu size="18" weight="duotone" />
                        </div>
                        <div class="layer-text">
                            <strong>Camada 3 — Inteligência Contextual (n8n + VPL)</strong>
                            <p>O Copilot processa snapshots matemáticos em tempo real sem expor credenciais bancárias a terceiros.</p>
                        </div>
                    </div>
                </div>
            </section>
        </div>

        <!-- Histórico de Versões / Changelog -->
        <section class="info-card">
            <div class="card-header">
                <PhCheckCircle size="20" weight="duotone" class="header-ic" />
                <h2>Notas de Lançamento (Changelog)</h2>
            </div>

            <div class="changelog-timeline">
                <div class="release-block" v-for="rel in changelog" :key="rel.version">
                    <div class="release-meta">
                        <span class="rel-version">{{ rel.version }}</span>
                        <span class="rel-date">{{ rel.date }}</span>
                    </div>
                    <div class="release-body">
                        <h3>{{ rel.title }}</h3>
                        <ul>
                            <li v-for="(item, idx) in rel.items" :key="idx">{{ item }}</li>
                        </ul>
                    </div>
                </div>
            </div>
        </section>

        <!-- Rodapé Autor / GitHub -->
        <footer class="about-footer">
            <span>Desenvolvido por <strong>Thiago Silva</strong> • Somma AI Financial Workspace</span>
            <a href="https://github.com/ThiagoP4/Somma-AI" target="_blank" class="github-link">
                <PhGithubLogo size="18" weight="fill" /> Repositório Oficial
            </a>
        </footer>
    </div>
</template>

<style scoped>
    .about-page {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .about-hero {
        position: relative;
        overflow: hidden;
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 18px;
        padding: 2.25rem;
        box-shadow: var(--shadow-sm);
    }

    .hero-ambient {
        position: absolute;
        top: -90px;
        left: -60px;
        width: 340px;
        height: 340px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(99, 102, 241, 0.16) 0%, transparent 70%);
        pointer-events: none;
    }

    .brand-identity {
        position: relative;
        z-index: 1;
        display: flex;
        align-items: center;
        gap: 1.5rem;
        flex-wrap: wrap;
    }

    .about-logo {
        width: 68px;
        height: 68px;
        object-fit: contain;
        flex-shrink: 0;
        filter: drop-shadow(0 8px 20px var(--primary-glow));
    }

    .brand-titles {
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
        flex: 1;
        min-width: 240px;
    }

    .title-line {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.6rem;
    }

    .title-line h1 {
        margin: 0;
        font-size: 2rem;
        font-weight: 800;
        letter-spacing: -0.03em;
        color: var(--text-primary);
    }

    .ai-badge {
        font-size: 0.78rem;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 7px;
        background: var(--primary-gradient);
        color: white;
    }

    .version-pill {
        font-size: 0.75rem;
        font-weight: 600;
        padding: 3px 10px;
        border-radius: 99px;
        background: var(--bg-elevated);
        color: var(--text-secondary);
        border: 1px solid var(--border-color);
    }

    .tagline {
        margin: 0;
        font-size: 0.95rem;
        color: var(--text-secondary);
        line-height: 1.5;
        max-width: 680px;
    }

    /* === PILARES === */
    .pillars-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 1.25rem;
    }

    .pillar-card {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 16px;
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
        box-shadow: var(--shadow-sm);
    }

    .pillar-icon {
        width: 42px;
        height: 42px;
        border-radius: 11px;
        background: var(--primary-subtle);
        color: var(--primary-color);
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .pillar-card h3 {
        margin: 0;
        font-size: 1.02rem;
        font-weight: 700;
        color: var(--text-primary);
    }

    .pillar-card p {
        margin: 0;
        font-size: 0.85rem;
        line-height: 1.6;
        color: var(--text-secondary);
    }

    /* === DUAS COLUNAS: STACK & SEGURANÇA === */
    .about-two-cols {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: 1.25rem;
    }

    .info-card {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 16px;
        padding: 1.6rem;
        box-shadow: var(--shadow-sm);
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
    }

    .card-header {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding-bottom: 0.9rem;
        border-bottom: 1px solid var(--border-subtle);
    }

    .header-ic {
        color: var(--primary-color);
    }

    .card-header h2 {
        margin: 0;
        font-size: 1.05rem;
        font-weight: 700;
        color: var(--text-primary);
    }

    .stack-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .stack-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.65rem 0.9rem;
        border-radius: 10px;
        background: var(--bg-elevated);
        border: 1px solid var(--border-color);
        gap: 0.75rem;
    }

    .stack-meta {
        display: flex;
        flex-direction: column;
        gap: 1px;
    }

    .stack-meta strong {
        font-size: 0.875rem;
        color: var(--text-primary);
    }

    .stack-meta span {
        font-size: 0.75rem;
        color: var(--text-secondary);
    }

    .stack-badge {
        font-size: 0.7rem;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 6px;
        background: var(--primary-subtle);
        color: var(--primary-color);
        white-space: nowrap;
    }

    .security-layers {
        display: flex;
        flex-direction: column;
        gap: 0.95rem;
    }

    .sec-layer {
        display: flex;
        align-items: flex-start;
        gap: 0.9rem;
        padding: 0.9rem 1rem;
        border-radius: 12px;
        background: var(--bg-elevated);
        border: 1px solid var(--border-color);
    }

    .layer-icon {
        width: 36px;
        height: 36px;
        border-radius: 9px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .layer-icon.cloud { background: var(--info-bg); color: var(--info-color); }
    .layer-icon.vault { background: var(--success-bg); color: var(--success-text); }
    .layer-icon.ai { background: var(--purple-bg); color: var(--purple-color); }

    .layer-text {
        display: flex;
        flex-direction: column;
        gap: 3px;
    }

    .layer-text strong {
        font-size: 0.875rem;
        color: var(--text-primary);
    }

    .layer-text p {
        margin: 0;
        font-size: 0.8rem;
        line-height: 1.5;
        color: var(--text-secondary);
    }

    /* === CHANGELOG === */
    .changelog-timeline {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
    }

    .release-block {
        display: grid;
        grid-template-columns: 140px 1fr;
        gap: 1.25rem;
        padding-bottom: 1.25rem;
        border-bottom: 1px solid var(--border-subtle);
    }

    .release-block:last-child {
        border-bottom: none;
        padding-bottom: 0;
    }

    .release-meta {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .rel-version {
        display: inline-block;
        align-self: flex-start;
        font-size: 0.78rem;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 6px;
        background: var(--primary-subtle);
        color: var(--primary-color);
    }

    .rel-date {
        font-size: 0.75rem;
        color: var(--text-muted);
    }

    .release-body h3 {
        margin: 0 0 0.5rem 0;
        font-size: 0.95rem;
        font-weight: 700;
        color: var(--text-primary);
    }

    .release-body ul {
        margin: 0;
        padding-left: 1.15rem;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
    }

    .release-body li {
        font-size: 0.84rem;
        color: var(--text-secondary);
        line-height: 1.5;
    }

    .about-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 1rem;
        padding: 1rem 0.25rem;
        font-size: 0.825rem;
        color: var(--text-secondary);
    }

    .github-link {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: var(--text-primary);
        text-decoration: none;
        font-weight: 600;
        padding: 0.45rem 0.9rem;
        border-radius: 9px;
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        transition: all 0.15s ease;
    }

    .github-link:hover {
        border-color: var(--primary-color);
        color: var(--primary-color);
    }

    @media (max-width: 960px) {
        .pillars-grid,
        .about-two-cols {
            grid-template-columns: 1fr;
        }
        .release-block {
            grid-template-columns: 1fr;
            gap: 0.5rem;
        }
    }
</style>
