<script setup lang="ts">
    import { ref, onMounted, computed } from 'vue';
    import { storeToRefs } from 'pinia';
    import { usePiggybankStore, type Piggybank } from '../stores/usePiggybankStore';
    import { useAssetsStore } from '../stores/useAssetsStore';
    import { useVaultStore } from '../stores/useVaultStore';
    import { useAlertStore } from '../stores/useAlertStore';
    import {
        PhWallet, PhTrendUp, PhPlus, PhTrash, PhPencilSimple, PhArrowDownLeft,
        PhArrowUpRight, PhVault, PhLockKey, PhShieldCheck, PhArrowsClockwise,
        PhSparkle, PhCheckCircle, PhBank, PhLightning, PhQrCode
    } from '@phosphor-icons/vue';
    import PiggybankModal from '../components/Piggybank/PiggybankModal.vue';
    import PiggybankTransaction from '../components/Piggybank/PiggybankTransaction.vue';
    import VariableAssetsPanel from '../components/Investments/VariableAssetsPanel.vue';
    import VaultPairingModal from '../components/VaultPairingModal.vue';
    import ConfirmModal from '../components/ConfirmModal.vue';
    import { getBankLogoUrl, getBankBrandColor, findBankFromText } from '../utils/banks';

    const piggybankStore = usePiggybankStore();
    const assetsStore = useAssetsStore();
    const vaultStore = useVaultStore();
    const { showAlert } = useAlertStore();
    const { isVaultUnlocked } = storeToRefs(vaultStore);
    const isPairingModalOpen = ref(false);
    const isConfirmingDeletePiggy = ref(false);
    const piggyIdToDelete = ref<string | null>(null);

    const activeTab = ref<'cofrinhos' | 'ativos'>('cofrinhos');
    const filterType = ref<'all' | 'liquid' | 'locked' | 'maturity'>('all');

    const isCreateModalOpen = ref(false);
    const editingPiggybank = ref<Piggybank | null>(null);
    const isTransactionModalOpen = ref(false);
    const transactionData = ref({
        piggybank: null as Piggybank | null,
        type: 'deposit' as 'deposit' | 'withdraw'
    });

    const openCreateModal = () => {
        editingPiggybank.value = null;
        isCreateModalOpen.value = true;
    };

    const openEditModal = (piggy: Piggybank) => {
        editingPiggybank.value = piggy;
        isCreateModalOpen.value = true;
    };

    const closeModal = () => {
        isCreateModalOpen.value = false;
        editingPiggybank.value = null;
    };

    const openTransactionModal = (piggy: Piggybank, type: 'deposit' | 'withdraw') => {
        transactionData.value = { piggybank: piggy, type };
        isTransactionModalOpen.value = true;
    };

    const handleDelete = (id: string) => {
        piggyIdToDelete.value = id;
        isConfirmingDeletePiggy.value = true;
    };

    const executeDeletePiggy = async () => {
        if (piggyIdToDelete.value) {
            await piggybankStore.deletePiggybank(piggyIdToDelete.value);
        }
        isConfirmingDeletePiggy.value = false;
        piggyIdToDelete.value = null;
    };

    const handleRetryVault = async () => {
        if (vaultStore.simulatedOffline) {
            await vaultStore.toggleSimulatedOffline();
        } else if (vaultStore.manualStealthMode) {
            vaultStore.toggleStealthMode();
        } else {
            await vaultStore.checkTailscaleConnection();
        }
        await Promise.all([
            piggybankStore.fetchPiggybanks(),
            assetsStore.fetchAssets()
        ]);
    };

    const calculateProgress = (current: number, target: number) => {
        if (!target || target <= 0) return 100;
        const calc = (Number(current) / Number(target)) * 100;
        return calc > 100 ? 100 : Math.round(calc);
    };

    // Estado simples de atualização manual do saldo real conforme o app do banco (zero alteração automática!)
    const reconcilingId = ref<string | null>(null);
    const reconcileInputAmount = ref<number>(0);
    const syncToMonthlyProventos = ref(true);

    const startReconcile = (piggy: Piggybank) => {
        reconcilingId.value = piggy.id_piggybank;
        // Mantém exatamente o saldo atual real (nunca sugere nem soma estimativa sozinho)
        reconcileInputAmount.value = Number(piggy.current_amount || 0);
        syncToMonthlyProventos.value = true;
    };

    const getReconcileDiff = (piggy: Piggybank): number => {
        return Math.round((Number(reconcileInputAmount.value || 0) - Number(piggy.current_amount || 0)) * 100) / 100;
    };

    const confirmReconcile = async (piggy: Piggybank) => {
        const res = await piggybankStore.reconcileRealBankBalance(
            piggy.id_piggybank,
            reconcileInputAmount.value,
            null,
            syncToMonthlyProventos.value
        );
        reconcilingId.value = null;

        if (res?.proventoSync) {
            showAlert(
                `Saldo atualizado! +${formatCurrency(res.diff)} lançados em "${res.proventoSync.title}" nos Proventos do mês (Total: ${formatCurrency(res.proventoSync.totalMonthValue)}).`,
                'success'
            );
        } else {
            showAlert('Saldo real atualizado no Cofre Tailscale!', 'success');
        }
    };

    // Calcula o rendimento por dia útil (Bruto e Líquido de IR, base 252 dias úteis do Banco Central)
    const getAccountDailyYield = (piggy: Piggybank, netOfIr = true): number => {
        const amt = Number(piggy.current_amount || 0);
        if (amt <= 0) return 0;
        const dailyRate = piggybankStore.getDailyBusinessYieldRate(piggy);
        const gross = amt * dailyRate;
        if (!netOfIr) return gross;
        const irPct = piggybankStore.getEstimatedIrRatePct(piggy);
        return gross * (1 - irPct / 100);
    };

    // Calcula o rendimento mensal real (~21 dias úteis compostos, Líquido de IR)
    const getAccountMonthlyYield = (piggy: Piggybank, netOfIr = true): number => {
        const amt = Number(piggy.current_amount || 0);
        if (amt <= 0) return 0;
        const dailyRate = piggybankStore.getDailyBusinessYieldRate(piggy);
        if (dailyRate <= 0) return 0;
        const monthlyFactor = Math.pow(1 + dailyRate, 21) - 1;
        const gross = amt * monthlyFactor;
        if (!netOfIr) return gross;
        const irPct = piggybankStore.getEstimatedIrRatePct(piggy);
        return gross * (1 - irPct / 100);
    };

    const formatRateBadge = (piggy: Piggybank): string => {
        const idx = piggy.indexer || 'CDI';
        const rate = piggy.rate_value !== undefined && piggy.rate_value !== null ? Number(piggy.rate_value) : 100;
        if (idx === 'NONE') return '0% (Conta s/ remuneração)';
        if (idx === 'CDI') return `${rate}% do CDI`;
        if (idx === 'SELIC') return `${rate}% da Selic`;
        if (idx === 'PREFIXADO') return `Prefixado ${rate}% a.a.`;
        if (idx === 'IPCA') return `IPCA + ${rate}% a.a.`;
        return `${rate}% do CDI`;
    };

    const isLockedUntilMaturity = (piggy: Piggybank): boolean => {
        if (piggy.liquidity !== 'maturity' || !piggy.maturity_date) return false;
        const today = new Date().toISOString().split('T')[0] || '';
        return piggy.maturity_date > today;
    };

    const formatMaturityDate = (dateStr?: string | null): string => {
        if (!dateStr) return 'Resgate Imediato (D+0)';
        const onlyDate = dateStr.split('T')[0] || '';
        const parts = onlyDate.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return dateStr;
    };

    const getShareOfPortfolioPct = (amount: number) => {
        if (totalPatrimonio.value <= 0) return 0;
        return Math.round((Number(amount || 0) / totalPatrimonio.value) * 100);
    };

    const parseBankTitle = (piggy: Piggybank) => {
        const rawTitle = piggy.title || '';
        if (piggy.bank_name && piggy.bank_name !== 'Outro Banco') {
            const sub = rawTitle.includes('•')
                ? rawTitle.split('•').slice(1).join(' • ').trim()
                : (piggy.product_type || rawTitle);
            return {
                bankName: piggy.bank_name,
                productName: sub || piggy.product_type || 'Conta Digital'
            };
        }
        if (rawTitle.includes('•')) {
            const parts = rawTitle.split('•').map(s => s.trim());
            return {
                bankName: parts[0] || rawTitle,
                productName: parts.slice(1).join(' • ') || (piggy.product_type || 'Conta Digital')
            };
        }
        const detected = findBankFromText(rawTitle);
        if (detected) {
            return {
                bankName: detected.name,
                productName: piggy.product_type || rawTitle
            };
        }
        return {
            bankName: rawTitle,
            productName: piggy.product_type || 'Carteira Digital'
        };
    };

    onMounted(async () => {
        await Promise.all([
            piggybankStore.fetchPiggybanks(),
            assetsStore.fetchAssets()
        ]);
    });

    const totalGuardado = computed(() => {
        return piggybankStore.piggybanks
            .filter(p => p.composes_balance === true)
            .reduce((acc, curr) => acc + Number(curr.current_amount), 0);
    });

    const totalReservado = computed(() => {
        return piggybankStore.piggybanks
            .filter(p => p.composes_balance === false)
            .reduce((acc, curr) => acc + Number(curr.current_amount), 0);
    });

    const totalPatrimonio = computed(() => totalGuardado.value + totalReservado.value);

    const liquidRatioPct = computed(() => {
        if (totalPatrimonio.value <= 0) return 50;
        return Math.round((totalGuardado.value / totalPatrimonio.value) * 100);
    });

    const estimatedDailyPassiveIncome = computed(() => {
        return piggybankStore.piggybanks.reduce((acc, p) => acc + getAccountDailyYield(p), 0);
    });

    const estimatedMonthlyPassiveIncome = computed(() => {
        return piggybankStore.piggybanks.reduce((acc, p) => acc + getAccountMonthlyYield(p), 0);
    });

    const totalAutoEarnedSoFar = computed(() => {
        return piggybankStore.piggybanks.reduce((acc, p) => acc + Number(p.total_yield_earned || 0), 0);
    });

    const estimatedYearlyPassiveIncome = computed(() => {
        return estimatedMonthlyPassiveIncome.value * 12.55; // Juros compostos 12 meses
    });

    const lockedMaturityTotal = computed(() => {
        return piggybankStore.piggybanks
            .filter(p => isLockedUntilMaturity(p))
            .reduce((acc, curr) => acc + Number(curr.current_amount), 0);
    });

    const filteredPiggybanks = computed(() => {
        if (filterType.value === 'liquid') {
            return piggybankStore.piggybanks.filter(p => p.composes_balance === true);
        }
        if (filterType.value === 'locked') {
            return piggybankStore.piggybanks.filter(p => p.composes_balance === false);
        }
        if (filterType.value === 'maturity') {
            return piggybankStore.piggybanks.filter(p => p.liquidity === 'maturity');
        }
        return piggybankStore.piggybanks;
    });

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value || 0);
    };
</script>

<template>
    <div class="investments-container">
        <header class="page-header">
            <div>
                <div class="header-title-row">
                    <h1>Carteira Digital & Investimentos</h1>
                    <span class="vault-status-badge" :class="isVaultUnlocked ? 'unlocked' : 'locked'">
                        <PhShieldCheck v-if="isVaultUnlocked" size="14" weight="fill" />
                        <PhLockKey v-else size="14" weight="fill" />
                        {{ isVaultUnlocked ? 'Tailscale Vault Conectado' : 'Cofre Isolado (Fora da VPN)' }}
                    </span>
                    <span
                        v-if="isVaultUnlocked"
                        class="bcb-live-badge"
                        :title="piggybankStore.marketRates.source === 'bcb-live' ? 'Taxa de referência sincronizada ao vivo com o Banco Central do Brasil' : 'Taxa de referência CDI / IPCA'"
                    >
                        <PhBank size="13" weight="fill" />
                        BCB CDI {{ piggybankStore.marketRates.cdiAnnualPct.toFixed(2).replace('.', ',') }}% a.a.
                    </span>
                </div>
                <p class="subtitle">Saldos em bancos, caixinhas RDB, CDBs, LCI/LCA, indexadores (CDI / Prefixado / IPCA+) e vencimentos</p>
            </div>
            <div class="header-actions" v-if="activeTab === 'cofrinhos' && isVaultUnlocked">
                <button class="btn-primary" @click="openCreateModal">
                    <PhPlus size="16" weight="bold" />
                    Nova Conta / Aplicação
                </button>
            </div>
        </header>

        <!-- Barra Superior: Abas + Filtros Rápidos -->
        <div class="nav-toolbar">
            <div class="tabs-bar">
                <button
                    class="tab-btn"
                    :class="{ active: activeTab === 'cofrinhos' }"
                    @click="activeTab = 'cofrinhos'"
                >
                    <PhWallet size="18" :weight="activeTab === 'cofrinhos' ? 'fill' : 'regular'" />
                    <span>Contas & Caixinhas ({{ piggybankStore.piggybanks.length }})</span>
                </button>
                <button
                    class="tab-btn"
                    :class="{ active: activeTab === 'ativos' }"
                    @click="activeTab = 'ativos'"
                >
                    <PhTrendUp size="18" :weight="activeTab === 'ativos' ? 'bold' : 'regular'" />
                    <span>Renda Variável & Cripto ({{ assetsStore.assets.length }})</span>
                </button>
            </div>

            <div class="sub-filters" v-if="activeTab === 'cofrinhos' && isVaultUnlocked && piggybankStore.piggybanks.length > 0">
                <button
                    class="filter-chip"
                    :class="{ active: filterType === 'all' }"
                    @click="filterType = 'all'"
                >
                    Todas ({{ piggybankStore.piggybanks.length }})
                </button>
                <button
                    class="filter-chip"
                    :class="{ active: filterType === 'liquid' }"
                    @click="filterType = 'liquid'"
                >
                    Giro Mensal (Compõe Saldo)
                </button>
                <button
                    class="filter-chip"
                    :class="{ active: filterType === 'locked' }"
                    @click="filterType = 'locked'"
                >
                    Reservas & CDBs Isolados
                </button>
                <button
                    class="filter-chip"
                    :class="{ active: filterType === 'maturity' }"
                    @click="filterType = 'maturity'"
                >
                    Com Vencimento Travado
                </button>
            </div>
        </div>

        <div v-if="activeTab === 'cofrinhos'" class="tab-content">
            <!-- ESTADO BLOQUEADO: FORA DA VPN TAILSCALE (Arquitetura A Zero-Trust) -->
            <div v-if="!isVaultUnlocked" class="vault-locked-panel">
                <div class="vault-locked-glow"></div>
                <div class="vault-locked-icon">
                    <PhLockKey size="32" weight="duotone" />
                </div>
                <h2>Carteira Bancária Isolada via Tailscale</h2>
                <p>
                    Por segurança <strong>Zero-Trust (Arquitetura Dual-DB)</strong>, seus saldos em bancos, CDBs e caixinhas ficam isolados no PostgreSQL do seu servidor Oracle e não trafegam fora da sua VPN Tailscale.
                </p>

                <div class="locked-masked-preview">
                    <div class="masked-box">
                        <span>Patrimônio em Bancos</span>
                        <strong>R$ •••••••</strong>
                    </div>
                    <div class="masked-box">
                        <span>Rendimento Passivo</span>
                        <strong>+ R$ •••••/mês</strong>
                    </div>
                </div>

                <div class="locked-actions" style="display: flex; flex-wrap: wrap; gap: 0.75rem; justify-content: center;">
                    <button class="btn-primary" @click="isPairingModalOpen = true">
                        <PhQrCode size="17" weight="bold" />
                        Desbloquear via Celular (QR / RAM)
                    </button>
                    <button class="btn-secondary" @click="handleRetryVault">
                        <PhArrowsClockwise size="17" weight="bold" />
                        {{
                            vaultStore.simulatedOffline
                                ? 'Reconectar Tailscale VPN (Simulação)'
                                : vaultStore.manualStealthMode
                                    ? 'Desativar Modo Furtivo'
                                    : 'Verificar Conexão Tailscale'
                        }}
                    </button>
                </div>
            </div>

            <!-- ESTADO DESBLOQUEADO: CONECTADO NA TAILSCALE VPN -->
            <template v-else>
                <!-- 1. HERO PORTFOLIO BANNER + 2 BOLSOS -->
                <section class="wealth-overview-grid">
                    <!-- Card Principal: Patrimônio Acumulado & Barra de Alocação -->
                    <div class="wealth-hero-card">
                        <div class="hero-ambient"></div>
                        <div class="wealth-hero-top">
                            <div>
                                <span class="hero-eyebrow">Patrimônio Consolidado em Bancos</span>
                                <h2 class="hero-total-val">{{ formatCurrency(totalPatrimonio) }}</h2>
                            </div>
                            <div class="yield-pills-stack">
                                <div class="yield-pill" title="Soma dos rendimentos por dia útil (base 252 dias úteis BCB)">
                                    <PhSparkle size="14" weight="fill" />
                                    <span>+{{ formatCurrency(estimatedDailyPassiveIncome) }}/dia útil • +{{ formatCurrency(estimatedMonthlyPassiveIncome) }}/mês</span>
                                </div>
                                <div v-if="totalAutoEarnedSoFar > 0" class="auto-credited-pill">
                                    <PhCheckCircle size="13" weight="fill" />
                                    <span>+{{ formatCurrency(totalAutoEarnedSoFar) }} já creditados automaticamente no saldo</span>
                                </div>
                            </div>
                        </div>

                        <!-- Barra de Divisão Liquidez vs Reserva Isolada -->
                        <div class="allocation-block">
                            <div class="alloc-labels">
                                <span class="alloc-item">
                                    <i class="dot dot-emerald"></i>
                                    Giro / Compõe Saldo ({{ liquidRatioPct }}%)
                                </span>
                                <span class="alloc-item">
                                    <i class="dot dot-indigo"></i>
                                    Investido / Reserva Isolada ({{ totalPatrimonio > 0 ? 100 - liquidRatioPct : 50 }}%)
                                </span>
                            </div>
                            <div class="alloc-track">
                                <div class="alloc-fill-emerald" :style="{ width: liquidRatioPct + '%' }"></div>
                            </div>
                        </div>

                        <div class="hero-footer-stats">
                            <div class="hf-item">
                                <span>Travado até Vencimento (LCI/CDB)</span>
                                <strong>{{ formatCurrency(lockedMaturityTotal) }}</strong>
                            </div>
                            <div class="hf-item">
                                <span>Projeção de Juros (12 meses)</span>
                                <strong class="text-success">+ {{ formatCurrency(estimatedYearlyPassiveIncome) }}/ano</strong>
                            </div>
                        </div>
                    </div>

                    <!-- Coluna Direita: Os 2 Bolsos (Liquidez vs. Isolado) -->
                    <div class="wealth-split-stack">
                        <div class="split-card">
                            <div class="split-top">
                                <div class="split-icon icon-emerald">
                                    <PhVault size="20" weight="duotone" />
                                </div>
                                <div class="split-info">
                                    <span class="split-lbl">Disponível em Conta (Compõe Saldo)</span>
                                    <h3 class="split-val">{{ formatCurrency(totalGuardado) }}</h3>
                                </div>
                            </div>
                            <p class="split-desc">Soma automaticamente ao seu Saldo Disponível na Visão Geral</p>
                        </div>

                        <div class="split-card">
                            <div class="split-top">
                                <div class="split-icon icon-indigo">
                                    <PhLockKey size="20" weight="duotone" />
                                </div>
                                <div class="split-info">
                                    <span class="split-lbl">Patrimônio Reservado (CDB / LCI / Caixinhas)</span>
                                    <h3 class="split-val">{{ formatCurrency(totalReservado) }}</h3>
                                </div>
                            </div>
                            <p class="split-desc">Capital protegido fora do orçamento operacional do mês</p>
                        </div>
                    </div>
                </section>

                <!-- 2. GRID DE CONTAS & APLICAÇÕES BANCÁRIAS -->
                <div v-if="piggybankStore.isLoading" class="loading-box">
                    Sincronizando carteira bancária via túnel Tailscale...
                </div>

                <div v-else-if="filteredPiggybanks.length > 0" class="piggybanks-grid">
                    <div
                        v-for="piggy in filteredPiggybanks"
                        :key="piggy.id_piggybank"
                        class="piggy-card"
                        :class="piggy.composes_balance ? 'card-liquid' : 'card-isolated'"
                        :style="{ borderTop: `3px solid ${getBankBrandColor(piggy.bank_name || piggy.title)}` }"
                    >
                        <!-- Cabeçalho do Banco / Produto -->
                        <div class="piggy-header">
                            <div class="piggy-title-area">
                                <img
                                    v-if="getBankLogoUrl(piggy.bank_name || piggy.title)"
                                    :src="getBankLogoUrl(piggy.bank_name || piggy.title) ?? undefined"
                                    :alt="piggy.title"
                                    class="bank-logo-box"
                                />
                                <div v-else class="piggy-icon" :class="piggy.composes_balance ? 'icon-emerald' : 'icon-indigo'">
                                    <PhBank weight="duotone" size="22" />
                                </div>

                                <div class="piggy-title-stack">
                                    <span class="piggy-title">{{ parseBankTitle(piggy).bankName }}</span>
                                    <span class="product-subtitle">{{ parseBankTitle(piggy).productName }}</span>
                                </div>
                            </div>
                            <div class="piggy-header-actions">
                                <button class="icon-btn edit-btn" @click="openEditModal(piggy)" title="Editar conta/aplicação">
                                    <PhPencilSimple size="16" />
                                </button>
                                <button class="icon-btn delete-btn" @click="handleDelete(piggy.id_piggybank)" title="Excluir conta/aplicação">
                                    <PhTrash size="16" />
                                </button>
                            </div>
                        </div>

                        <!-- Badges Técnicas da Aplicação: Indexador/Taxa + Liquidez + Compõe Saldo -->
                        <div class="financial-badges-row">
                            <span class="fin-badge badge-rate">
                                <PhTrendUp size="12" weight="bold" />
                                {{ formatRateBadge(piggy) }}
                            </span>

                            <span
                                class="fin-badge"
                                :class="piggy.liquidity === 'maturity' ? 'badge-locked-date' : 'badge-daily'"
                            >
                                <PhLockKey v-if="piggy.liquidity === 'maturity'" size="12" weight="fill" />
                                <PhLightning v-else size="12" weight="fill" />
                                {{
                                    piggy.liquidity === 'maturity'
                                        ? `Trava: ${formatMaturityDate(piggy.maturity_date)}`
                                        : 'Liquidez Diária'
                                }}
                            </span>

                            <span
                                class="fin-badge"
                                :class="
                                    piggybankStore.isTaxExemptProduct(piggy)
                                        ? 'badge-composes'
                                        : (piggybankStore.hasCalibratedTaxRate(piggy) ? 'badge-calibrated' : 'badge-daily')
                                "
                                :title="
                                    piggybankStore.hasCalibratedTaxRate(piggy)
                                        ? 'Alíquota efetiva (IR + IOF) aprendida e calibrada pelas suas conciliações'
                                        : 'Estimativa padrão pela tabela regressiva de IR'
                                "
                            >
                                {{
                                    piggybankStore.isTaxExemptProduct(piggy)
                                        ? 'Isento de IR'
                                        : (piggybankStore.hasCalibratedTaxRate(piggy)
                                            ? `🎯 IR/IOF Calibrado: ${piggybankStore.getEstimatedIrRatePct(piggy).toFixed(1).replace('.', ',')}%`
                                            : `IR ~${piggybankStore.getEstimatedIrRatePct(piggy).toString().replace('.', ',')}%`)
                                }}
                            </span>

                            <span class="fin-badge" :class="piggy.composes_balance ? 'badge-composes' : 'badge-isolated'">
                                {{ piggy.composes_balance ? 'Compõe Saldo' : 'Reserva Isolada' }}
                            </span>
                        </div>

                        <!-- Valor Principal & Barra de Alocação / Meta -->
                        <div class="piggy-balance-area">
                            <div class="amount-row">
                                <h3 class="piggy-amount">{{ formatCurrency(piggy.current_amount) }}</h3>
                                <span
                                    v-if="Number(piggy.target_amount) > 0"
                                    class="pct-ring"
                                    :class="{ completed: calculateProgress(piggy.current_amount, piggy.target_amount) >= 100 }"
                                >
                                    <PhCheckCircle v-if="calculateProgress(piggy.current_amount, piggy.target_amount) >= 100" size="13" weight="fill" />
                                    {{ calculateProgress(piggy.current_amount, piggy.target_amount) }}% da meta
                                </span>
                                <span v-else class="pct-ring">
                                    {{ getShareOfPortfolioPct(piggy.current_amount) }}% da carteira
                                </span>
                            </div>

                            <!-- Barra de Progresso -->
                            <div class="progress-bar">
                                <div
                                    class="progress-fill"
                                    :style="{
                                        width: (Number(piggy.target_amount) > 0
                                            ? calculateProgress(piggy.current_amount, piggy.target_amount)
                                            : getShareOfPortfolioPct(piggy.current_amount)) + '%',
                                        backgroundColor: getBankBrandColor(piggy.bank_name || piggy.title)
                                    }"
                                ></div>
                            </div>

                            <!-- Quadro Técnico de 3 Colunas (Líquido de IR) -->
                            <div class="piggy-metrics-box">
                                <div class="pm-col">
                                    <span class="pm-lbl">{{ Number(piggy.target_amount) > 0 ? 'Alvo / Meta' : 'Vencimento' }}</span>
                                    <strong class="pm-val">
                                        {{
                                            Number(piggy.target_amount) > 0
                                                ? formatCurrency(piggy.target_amount)
                                                : (piggy.liquidity === 'maturity' ? formatMaturityDate(piggy.maturity_date) : 'Livre (D+0)')
                                        }}
                                    </strong>
                                </div>
                                <div class="pm-col">
                                    <span class="pm-lbl">Líquido / Dia Útil</span>
                                    <strong class="pm-val text-success" :title="`Bruto: +${formatCurrency(getAccountDailyYield(piggy, false))}/dia`">
                                        +{{ formatCurrency(getAccountDailyYield(piggy, true)) }}/dia
                                    </strong>
                                </div>
                                <div class="pm-col align-right">
                                    <span class="pm-lbl">Líquido / Mês</span>
                                    <strong class="pm-val text-success" :title="`Bruto: +${formatCurrency(getAccountMonthlyYield(piggy, false))}/mês`">
                                        +{{ formatCurrency(getAccountMonthlyYield(piggy, true)) }}/mês
                                    </strong>
                                </div>
                            </div>

                            <!-- Atualização Simples de Saldo Real conforme o App do Banco -->
                            <div class="reconcile-section">
                                <template v-if="reconcilingId === piggy.id_piggybank">
                                    <div class="reconcile-inline-box">
                                        <label>Saldo real agora no app do {{ parseBankTitle(piggy).bankName }} (R$):</label>
                                        <div class="reconcile-input-row">
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                v-model.number="reconcileInputAmount"
                                                @keyup.enter="confirmReconcile(piggy)"
                                            />
                                            <button class="btn-reconcile-confirm" @click="confirmReconcile(piggy)">
                                                Salvar
                                            </button>
                                            <button class="btn-reconcile-cancel" @click="reconcilingId = null">
                                                ✕
                                            </button>
                                        </div>

                                        <div v-if="getReconcileDiff(piggy) > 0" class="calibration-learned-preview">
                                            Rendimento real detectado: <strong>+{{ formatCurrency(getReconcileDiff(piggy)) }}</strong>
                                        </div>

                                        <label v-if="getReconcileDiff(piggy) > 0" class="proventos-sync-checkbox">
                                            <input type="checkbox" v-model="syncToMonthlyProventos" />
                                            <span>Somar <strong>+{{ formatCurrency(getReconcileDiff(piggy)) }}</strong> nos <strong>Proventos</strong> deste mês</span>
                                        </label>
                                    </div>
                                </template>

                                <template v-else>
                                    <div class="yield-footer-row">
                                        <span v-if="Number(piggy.total_yield_earned) > 0" class="earned-tag">
                                            <PhSparkle size="12" weight="fill" />
                                            Rendimentos registrados: <strong>+{{ formatCurrency(Number(piggy.total_yield_earned)) }}</strong>
                                        </span>
                                        <span v-else class="earned-tag muted">
                                            Projeção apenas informativa
                                        </span>
                                        <button
                                            type="button"
                                            class="btn-quick-reconcile"
                                            @click="startReconcile(piggy)"
                                            title="Informe o saldo real que aparece no app do banco para atualizar"
                                        >
                                            <PhArrowsClockwise size="12" weight="bold" />
                                            Atualizar Saldo do Banco
                                        </button>
                                    </div>
                                </template>
                            </div>
                        </div>

                        <!-- Botões de Ação (Resgate bloqueado se estiver travado até a data de validade) -->
                        <div class="piggy-buttons">
                            <button class="btn-action deposit" @click="openTransactionModal(piggy, 'deposit')">
                                <PhArrowDownLeft size="16" weight="bold" />
                                <span>Aportar</span>
                            </button>
                            <button
                                class="btn-action withdraw"
                                :class="{ 'is-locked-maturity': isLockedUntilMaturity(piggy) }"
                                :disabled="isLockedUntilMaturity(piggy)"
                                @click="openTransactionModal(piggy, 'withdraw')"
                                :title="isLockedUntilMaturity(piggy) ? `Resgate travado até o vencimento em ${formatMaturityDate(piggy.maturity_date)}` : 'Resgatar valor'"
                            >
                                <PhLockKey v-if="isLockedUntilMaturity(piggy)" size="15" weight="fill" />
                                <PhArrowUpRight v-else size="16" weight="bold" />
                                <span>{{ isLockedUntilMaturity(piggy) ? `Até ${formatMaturityDate(piggy.maturity_date)}` : 'Resgatar' }}</span>
                            </button>
                        </div>
                    </div>

                    <!-- Card Fantasma "+ Adicionar Conta / Aplicação" -->
                    <button type="button" class="add-piggy-ghost" @click="openCreateModal">
                        <div class="ghost-circle">
                            <PhPlus size="22" weight="bold" />
                        </div>
                        <strong>Adicionar Conta ou Aplicação</strong>
                        <span>Cadastre saldos em bancos, CDBs, RDBs, LCI/LCA prefixadas ou pós-fixadas no seu Cofre Tailscale</span>
                    </button>
                </div>

                <div v-else class="empty-vault-card">
                    <div class="ghost-circle" style="margin-bottom: 0.5rem;">
                        <PhWallet size="26" weight="duotone" />
                    </div>
                    <h3>Sua Carteira Digital Tailscale está pronta</h3>
                    <p>Adicione suas contas bancárias, caixinhas RDB ou CDBs com seus respectivos indexadores (CDI, Prefixado, IPCA+) e prazos de vencimento.</p>
                    <button class="btn-primary" @click="openCreateModal" style="margin-top: 0.5rem;">
                        <PhPlus size="16" weight="bold" /> Cadastrar Primeira Conta
                    </button>
                </div>
            </template>
        </div>

        <!-- ABA 2: RENDA VARIÁVEL & CRIPTO -->
        <div v-if="activeTab === 'ativos'" class="tab-content">
            <div v-if="!isVaultUnlocked" class="vault-locked-panel">
                <div class="vault-locked-glow"></div>
                <div class="vault-locked-icon">
                    <PhLockKey size="32" weight="duotone" />
                </div>
                <h2>Carteira de Renda Variável & Cripto Isolada</h2>
                <p>
                    Por segurança <strong>Zero-Trust (Arquitetura Dual-DB)</strong>, suas posições em Ações, FIIs, ETFs e Criptoativos ficam isoladas no PostgreSQL da sua VPS Oracle via Tailscale.
                </p>
                <div class="locked-actions" style="display: flex; flex-wrap: wrap; gap: 0.75rem; justify-content: center;">
                    <button class="btn-primary" @click="isPairingModalOpen = true">
                        <PhQrCode size="17" weight="bold" />
                        Desbloquear via Celular (QR / RAM)
                    </button>
                    <button class="btn-secondary" @click="handleRetryVault">
                        <PhArrowsClockwise size="17" weight="bold" />
                        Verificar Conexão Tailscale
                    </button>
                </div>
            </div>
            <VariableAssetsPanel v-else />
        </div>  
    </div>

    <VaultPairingModal
        v-if="isPairingModalOpen"
        initialMode="receive"
        @close="isPairingModalOpen = false"
    />

    <PiggybankModal 
        v-if="isCreateModalOpen" 
        :piggybankToEdit="editingPiggybank"
        @close="closeModal" 
    />
    
    <PiggybankTransaction 
        v-if="isTransactionModalOpen && transactionData.piggybank" 
        :piggybank="transactionData.piggybank" 
        :type="transactionData.type" 
        @close="isTransactionModalOpen = false" 
    />

    <ConfirmModal
        :isOpen="isConfirmingDeletePiggy"
        title="Excluir Conta / Aplicação?"
        message="Tem certeza que deseja excluir esta conta ou aplicação da sua carteira no Cofre Tailscale?"
        @confirm="executeDeletePiggy"
        @cancel="isConfirmingDeletePiggy = false"
    />
</template>

<style scoped>
    .text-success { color: var(--success-text); }
    .text-primary { color: var(--primary-color); }

    .investments-container {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 1rem;
    }

    .header-title-row {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.75rem;
        margin-bottom: 0.25rem;
    }

    .page-header h1 {
        font-size: 1.75rem;
        font-weight: 700;
        letter-spacing: -0.02em;
        margin: 0;
        color: var(--text-primary);
    }

    .vault-status-badge {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 0.75rem;
        font-weight: 600;
        padding: 3px 10px;
        border-radius: 99px;
    }

    .vault-status-badge.unlocked {
        background: var(--success-bg);
        color: var(--success-text);
        border: 1px solid rgba(16, 185, 129, 0.25);
    }

    .vault-status-badge.locked {
        background: rgba(245, 158, 11, 0.12);
        color: #F59E0B;
        border: 1px solid rgba(245, 158, 11, 0.25);
    }

    .bcb-live-badge {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 0.74rem;
        font-weight: 600;
        padding: 3px 10px;
        border-radius: 99px;
        background: var(--primary-subtle);
        color: var(--primary-color);
        border: 1px solid rgba(99, 102, 241, 0.25);
        font-feature-settings: "tnum";
    }

    .yield-pills-stack {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 0.4rem;
    }

    .auto-credited-pill {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.72rem;
        font-weight: 600;
        color: var(--success-text);
        opacity: 0.9;
    }

    .reconcile-section {
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
    }

    .pending-yield-alert {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.4rem;
        background: var(--success-bg);
        border: 1px solid rgba(16, 185, 129, 0.28);
        color: var(--success-text);
        padding: 0.45rem 0.65rem;
        border-radius: 9px;
        font-size: 0.72rem;
    }

    .py-info {
        display: flex;
        align-items: center;
        gap: 5px;
    }

    .py-info small {
        opacity: 0.8;
    }

    .py-actions {
        display: flex;
        gap: 4px;
    }

    .btn-py-apply,
    .btn-py-sync {
        border: none;
        border-radius: 6px;
        padding: 3px 7px;
        font-size: 0.68rem;
        font-weight: 700;
        cursor: pointer;
        font-family: inherit;
    }

    .btn-py-apply {
        background: #10B981;
        color: #052E16;
    }

    .btn-py-sync {
        background: rgba(255, 255, 255, 0.12);
        color: var(--text-primary);
    }

    .yield-footer-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.5rem;
        padding-top: 0.15rem;
    }

    .earned-tag {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.72rem;
        color: var(--success-text);
    }

    .earned-tag.muted {
        color: var(--text-muted);
    }

    .btn-quick-reconcile {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: var(--bg-elevated);
        border: 1px solid var(--border-color);
        color: var(--text-secondary);
        font-family: inherit;
        font-size: 0.68rem;
        font-weight: 600;
        padding: 3px 8px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .btn-quick-reconcile:hover {
        color: var(--primary-color);
        border-color: var(--primary-color);
        background: var(--primary-subtle);
    }

    .reconcile-inline-box {
        background: var(--bg-elevated);
        border: 1px solid var(--primary-color);
        border-radius: 10px;
        padding: 0.65rem 0.75rem;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
    }

    .reconcile-inline-box label {
        font-size: 0.73rem;
        font-weight: 600;
        color: var(--text-primary);
    }

    .reconcile-inline-box small {
        font-size: 0.66rem;
        color: var(--text-muted);
        line-height: 1.35;
    }

    .reconcile-input-row {
        display: flex;
        gap: 0.4rem;
    }

    .reconcile-input-row input {
        flex: 1;
        min-width: 0;
        padding: 0.35rem 0.6rem;
        font-size: 0.85rem;
        font-weight: 700;
    }

    .btn-reconcile-confirm {
        background: var(--primary-color);
        color: white;
        border: none;
        border-radius: 7px;
        padding: 0 0.75rem;
        font-size: 0.75rem;
        font-weight: 700;
        cursor: pointer;
        font-family: inherit;
    }

    .btn-reconcile-cancel {
        background: transparent;
        color: var(--text-muted);
        border: 1px solid var(--border-color);
        border-radius: 7px;
        padding: 0 0.5rem;
        font-size: 0.75rem;
        cursor: pointer;
    }

    .subtitle {
        margin: 0;
        color: var(--text-secondary);
        font-size: 0.925rem;
    }

    /* === BARRA DE NAVEGAÇÃO & FILTROS === */
    .nav-toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 1rem;
    }

    .tabs-bar {
        display: inline-flex;
        background-color: var(--bg-card);
        border: 1px solid var(--border-color);
        padding: 4px;
        border-radius: 12px;
        gap: 4px;
    }

    .tab-btn { 
        background: transparent;
        border: none;
        color: var(--text-secondary);
        font-size: 0.875rem;
        font-weight: 500;
        font-family: inherit;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        cursor: pointer;
        padding: 0.5rem 1rem;
        border-radius: 8px;
        transition: all 0.15s ease;
    }

    .tab-btn:hover {
        color: var(--text-primary);
        background-color: var(--bg-hover);
    }

    .tab-btn.active {
        background-color: var(--primary-subtle);
        color: var(--primary-color);
        font-weight: 600;
    }

    .sub-filters {
        display: flex;
        gap: 0.45rem;
        flex-wrap: wrap;
    }

    .filter-chip {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        color: var(--text-secondary);
        font-family: inherit;
        font-size: 0.78rem;
        font-weight: 600;
        padding: 0.4rem 0.85rem;
        border-radius: 99px;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .filter-chip:hover {
        color: var(--text-primary);
        border-color: var(--text-muted);
    }

    .filter-chip.active {
        background: var(--primary-color);
        border-color: var(--primary-color);
        color: white;
    }

    .tab-content {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    /* === 1. HERO PORTFOLIO BANNER + 2 BOLSOS === */
    .wealth-overview-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr);
        gap: 1.25rem;
    }

    .wealth-hero-card {
        position: relative;
        overflow: hidden;
        background: var(--card-highlight-bg);
        border: 1px solid var(--card-highlight-border);
        border-radius: 18px;
        padding: 1.75rem;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 1.35rem;
        box-shadow: var(--shadow-sm);
    }

    .hero-ambient {
        position: absolute;
        top: -90px;
        right: -60px;
        width: 280px;
        height: 280px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(99, 102, 241, 0.2) 0%, transparent 70%);
        pointer-events: none;
    }

    .wealth-hero-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        flex-wrap: wrap;
        gap: 1rem;
        position: relative;
        z-index: 1;
    }

    .hero-eyebrow {
        display: block;
        font-size: 0.78rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--card-highlight-title);
        margin-bottom: 0.35rem;
    }

    .hero-total-val {
        margin: 0;
        font-size: 2.45rem;
        font-weight: 800;
        letter-spacing: -0.03em;
        color: var(--card-highlight-text);
        font-feature-settings: "tnum";
    }

    .yield-pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: var(--success-bg);
        color: var(--success-text);
        border: 1px solid rgba(16, 185, 129, 0.28);
        padding: 5px 11px;
        border-radius: 99px;
        font-size: 0.76rem;
        font-weight: 700;
        font-feature-settings: "tnum";
    }

    .allocation-block {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        position: relative;
        z-index: 1;
    }

    .alloc-labels {
        display: flex;
        justify-content: space-between;
        font-size: 0.76rem;
        font-weight: 600;
        color: var(--text-secondary);
    }

    .alloc-item {
        display: inline-flex;
        align-items: center;
        gap: 6px;
    }

    .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        display: inline-block;
    }

    .dot-emerald { background: #10B981; }
    .dot-indigo { background: #6366F1; }

    .alloc-track {
        width: 100%;
        height: 9px;
        border-radius: 99px;
        background: #6366F1;
        overflow: hidden;
    }

    .alloc-fill-emerald {
        height: 100%;
        background: #10B981;
        transition: width 0.4s ease;
    }

    .hero-footer-stats {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
        padding-top: 1rem;
        border-top: 1px solid var(--border-color);
        position: relative;
        z-index: 1;
    }

    .hf-item {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .hf-item span {
        font-size: 0.72rem;
        color: var(--text-secondary);
    }

    .hf-item strong {
        font-size: 0.875rem;
        color: var(--text-primary);
        font-feature-settings: "tnum";
    }

    /* Coluna Direita do Topo */
    .wealth-split-stack {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .split-card {
        flex: 1;
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 16px;
        padding: 1.25rem 1.4rem;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 0.5rem;
        box-shadow: var(--shadow-sm);
    }

    .split-top {
        display: flex;
        align-items: center;
        gap: 0.9rem;
    }

    .split-icon {
        width: 42px;
        height: 42px;
        border-radius: 11px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .icon-emerald {
        background: var(--success-bg);
        color: var(--success-text);
    }

    .icon-indigo {
        background: var(--primary-subtle);
        color: var(--primary-color);
    }

    .split-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .split-lbl {
        font-size: 0.78rem;
        font-weight: 600;
        color: var(--text-secondary);
    }

    .split-val {
        margin: 0;
        font-size: 1.45rem;
        font-weight: 800;
        color: var(--text-primary);
        letter-spacing: -0.02em;
        font-feature-settings: "tnum";
    }

    .split-desc {
        margin: 0;
        font-size: 0.75rem;
        color: var(--text-muted);
    }

    /* === 2. GRID DE CONTAS & CAIXINHAS === */
    .piggybanks-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 330px), 1fr));
        gap: 1.25rem;
    }

    .piggy-card {
        background-color: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 16px;
        padding: 1.4rem 1.5rem;
        box-shadow: var(--shadow-sm);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 1.15rem;
        transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
    }

    .piggy-card:hover {
        transform: translateY(-3px);
        box-shadow: var(--shadow-md);
    }

    .piggy-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
    }

    .piggy-title-area {
        display: flex;
        align-items: center;
        gap: 0.85rem;
    }

    .piggy-icon {
        width: 44px;
        height: 44px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .bank-logo-box {
        width: 44px;
        height: 44px;
        border-radius: 12px;
        object-fit: contain;
        background: white;
        padding: 3px;
        flex-shrink: 0;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
    }

    .piggy-title-stack {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .piggy-title {
        font-weight: 700;
        color: var(--text-primary);
        font-size: 1.05rem;
    }

    .product-subtitle {
        font-size: 0.78rem;
        color: var(--text-secondary);
        font-weight: 500;
    }

    /* Badges Técnicas (Indexador + Liquidez + Saldo) */
    .financial-badges-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
    }

    .fin-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.68rem;
        font-weight: 700;
        padding: 3px 8px;
        border-radius: 6px;
        letter-spacing: 0.01em;
    }

    .badge-rate {
        background: var(--primary-subtle);
        color: var(--primary-color);
        border: 1px solid rgba(99, 102, 241, 0.22);
    }

    .badge-daily {
        background: var(--bg-elevated);
        color: var(--text-secondary);
        border: 1px solid var(--border-color);
    }

    .badge-calibrated {
        background: rgba(16, 185, 129, 0.14);
        color: var(--success-text);
        border: 1px solid rgba(16, 185, 129, 0.35);
    }

    .tax-calibration-panel {
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
        padding-top: 0.35rem;
        border-top: 1px dashed var(--border-color);
    }

    .tax-mode-pills {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
    }

    .tax-pill {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        color: var(--text-secondary);
        font-family: inherit;
        font-size: 0.66rem;
        font-weight: 600;
        padding: 3px 7px;
        border-radius: 6px;
        cursor: pointer;
    }

    .tax-pill.active {
        background: var(--primary-subtle);
        color: var(--primary-color);
        border-color: var(--primary-color);
    }

    .tax-brl-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.4rem;
    }

    .tax-brl-grid span,
    .tax-pct-row span {
        display: block;
        font-size: 0.66rem;
        color: var(--text-secondary);
        margin-bottom: 2px;
    }

    .tax-brl-grid input,
    .tax-pct-row input {
        width: 100%;
        padding: 0.3rem 0.5rem;
        font-size: 0.78rem;
    }

    .tax-pct-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
    }

    .tax-pct-row input {
        max-width: 90px;
    }

    .calibration-learned-preview {
        background: var(--success-bg);
        color: var(--success-text);
        border: 1px solid rgba(16, 185, 129, 0.28);
        padding: 4px 8px;
        border-radius: 6px;
        font-size: 0.68rem;
        line-height: 1.35;
    }

    .proventos-sync-checkbox {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        padding-top: 0.4rem;
        margin-top: 0.15rem;
        border-top: 1px dashed var(--border-color);
        font-size: 0.7rem !important;
        font-weight: 500 !important;
        color: var(--text-secondary) !important;
        cursor: pointer;
    }

    .proventos-sync-checkbox input[type="checkbox"] {
        width: 15px;
        height: 15px;
        accent-color: #10B981;
        cursor: pointer;
        flex-shrink: 0;
    }

    .badge-locked-date {
        background: rgba(245, 158, 11, 0.14);
        color: #F59E0B;
        border: 1px solid rgba(245, 158, 11, 0.28);
    }

    .badge-composes {
        background: var(--success-bg);
        color: var(--success-text);
    }

    .badge-isolated {
        background: var(--bg-elevated);
        color: var(--text-muted);
    }

    .piggy-header-actions {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .icon-btn {
        background: transparent;
        border: none;
        color: var(--text-muted);
        width: 30px;
        height: 30px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.15s;
    }

    .icon-btn.edit-btn:hover {
        color: var(--primary-color);
        background: var(--primary-subtle);
    }

    .icon-btn.delete-btn:hover {
        color: var(--danger-color);
        background: var(--danger-bg);
    }

    .piggy-balance-area {
        display: flex;
        flex-direction: column;
        gap: 0.7rem;
    }

    .amount-row {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
    }

    .piggy-amount {
        font-size: 1.75rem;
        font-weight: 800;
        color: var(--text-primary);
        margin: 0;
        letter-spacing: -0.025em;
        font-feature-settings: "tnum";
    }

    .pct-ring {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: var(--bg-elevated);
        border: 1px solid var(--border-color);
        color: var(--text-primary);
        font-weight: 700;
        font-size: 0.74rem;
        padding: 3px 9px;
        border-radius: 99px;
        font-feature-settings: "tnum";
    }

    .pct-ring.completed {
        background: var(--success-bg);
        color: var(--success-text);
        border-color: rgba(16, 185, 129, 0.3);
    }

    .progress-bar {
        width: 100%;
        height: 7px;
        background-color: var(--bg-elevated);
        border-radius: 99px;
        overflow: hidden;
    }

    .progress-fill {
        height: 100%;
        border-radius: 99px;
        transition: width 0.35s ease;
    }

    .piggy-metrics-box {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 0.5rem;
        background: var(--bg-elevated);
        border: 1px solid var(--border-color);
        border-radius: 11px;
        padding: 0.65rem 0.8rem;
    }

    .pm-col {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .pm-col.align-right {
        text-align: right;
    }

    .pm-lbl {
        font-size: 0.68rem;
        color: var(--text-muted);
        font-weight: 500;
    }

    .pm-val {
        font-size: 0.78rem;
        font-weight: 700;
        color: var(--text-primary);
        font-feature-settings: "tnum";
    }

    .piggy-buttons {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.65rem;
    }

    .btn-action {
        height: 38px;
        border-radius: 10px;
        font-family: inherit;
        font-size: 0.825rem;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .btn-action.deposit {
        background: var(--primary-subtle);
        color: var(--primary-color);
        border: 1px solid rgba(99, 102, 241, 0.28);
    }

    .btn-action.deposit:hover {
        background: var(--primary-color);
        color: white;
    }

    .btn-action.withdraw {
        background: transparent;
        color: var(--text-secondary);
        border: 1px solid var(--border-color);
    }

    .btn-action.withdraw:hover:not(:disabled) {
        background: var(--bg-hover);
        color: var(--text-primary);
        border-color: var(--text-muted);
    }

    .btn-action.withdraw.is-locked-maturity {
        background: rgba(245, 158, 11, 0.08);
        border-color: rgba(245, 158, 11, 0.25);
        color: #F59E0B;
        cursor: not-allowed;
        font-size: 0.76rem;
    }

    /* Card Fantasma "+ Adicionar Conta / Aplicação" */
    .add-piggy-ghost {
        background: transparent;
        border: 1.5px dashed var(--border-color);
        border-radius: 16px;
        padding: 2rem 1.5rem;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        gap: 0.5rem;
        cursor: pointer;
        color: var(--text-secondary);
        font-family: inherit;
        min-height: 240px;
        transition: all 0.18s ease;
    }

    .add-piggy-ghost:hover {
        border-color: var(--primary-color);
        background: var(--primary-subtle);
        color: var(--text-primary);
    }

    .ghost-circle {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: var(--bg-elevated);
        border: 1px solid var(--border-color);
        color: var(--primary-color);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 0.25rem;
    }

    .add-piggy-ghost strong {
        font-size: 0.95rem;
        color: var(--text-primary);
    }

    .add-piggy-ghost span {
        font-size: 0.78rem;
        color: var(--text-secondary);
        max-width: 240px;
        line-height: 1.45;
    }

    .empty-vault-card {
        background: var(--bg-card);
        border: 1px dashed var(--border-color);
        border-radius: 18px;
        padding: 3.5rem 2rem;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 0.5rem;
    }

    .empty-vault-card h3 {
        margin: 0;
        font-size: 1.2rem;
        color: var(--text-primary);
    }

    .empty-vault-card p {
        margin: 0;
        color: var(--text-secondary);
        max-width: 440px;
        font-size: 0.9rem;
    }

    /* === PAINEL COFRE BLOQUEADO (ZERO-TRUST) === */
    .vault-locked-panel {
        position: relative;
        overflow: hidden;
        background-color: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 18px;
        padding: 3.5rem 2rem;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 1rem;
        box-shadow: var(--shadow-sm);
    }

    .vault-locked-glow {
        position: absolute;
        top: -80px;
        width: 320px;
        height: 220px;
        background: radial-gradient(circle, rgba(245, 158, 11, 0.12) 0%, transparent 70%);
        pointer-events: none;
    }

    .vault-locked-icon {
        width: 64px;
        height: 64px;
        border-radius: 16px;
        background: rgba(245, 158, 11, 0.12);
        border: 1px solid rgba(245, 158, 11, 0.25);
        color: #F59E0B;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .vault-locked-panel h2 {
        margin: 0.25rem 0 0 0;
        font-size: 1.35rem;
        font-weight: 700;
        color: var(--text-primary);
    }

    .vault-locked-panel p {
        margin: 0;
        max-width: 520px;
        font-size: 0.925rem;
        line-height: 1.55;
        color: var(--text-secondary);
    }

    .locked-masked-preview {
        display: flex;
        gap: 1rem;
        margin: 0.75rem 0;
        flex-wrap: wrap;
        justify-content: center;
    }

    .masked-box {
        background: var(--bg-elevated);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        padding: 0.85rem 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        min-width: 180px;
    }

    .masked-box span {
        font-size: 0.75rem;
        color: var(--text-muted);
    }

    .masked-box strong {
        font-size: 1.25rem;
        color: var(--text-secondary);
        letter-spacing: 0.08em;
        filter: blur(1.5px);
        user-select: none;
    }

    /* === ABA CARTEIRA DE ATIVOS === */
    .assets-roadmap-card {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 18px;
        padding: 2rem;
        display: flex;
        flex-direction: column;
        gap: 1.75rem;
        box-shadow: var(--shadow-sm);
    }

    .roadmap-top {
        display: flex;
        align-items: center;
        gap: 1.25rem;
        flex-wrap: wrap;
    }

    .roadmap-top h3 {
        margin: 0 0 0.25rem 0;
        font-size: 1.25rem;
        color: var(--text-primary);
    }

    .roadmap-top p {
        margin: 0;
        font-size: 0.9rem;
        color: var(--text-secondary);
    }

    .asset-classes-preview {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 1rem;
    }

    .asset-preview-item {
        background: var(--bg-elevated);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        padding: 1.15rem;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
    }

    .asset-preview-item strong {
        font-size: 0.925rem;
        color: var(--text-primary);
    }

    .asset-preview-item span {
        font-size: 0.78rem;
        color: var(--text-secondary);
    }

    @media (max-width: 960px) {
        .wealth-overview-grid,
        .asset-classes-preview {
            grid-template-columns: 1fr;
        }
    }

    @media (max-width: 640px) {
        .page-header h1 {
            font-size: 1.35rem;
        }
        .hero-total-val {
            font-size: 1.8rem;
        }
        .wealth-hero-card {
            padding: 1.2rem;
        }
        .hero-footer-stats {
            grid-template-columns: 1fr;
            gap: 0.75rem;
        }
        .yield-pill {
            white-space: normal;
            line-height: 1.35;
            border-radius: 12px;
        }
        .piggy-card {
            padding: 1.1rem;
        }
        .piggy-amount {
            font-size: 1.45rem;
        }
        .piggy-metrics-box {
            grid-template-columns: 1fr;
            gap: 0.55rem;
        }
        .pm-col {
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
        }
        .pm-col.align-right {
            text-align: left;
        }
        .yield-footer-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
        }
        .btn-quick-reconcile {
            width: 100%;
            justify-content: center;
            padding: 0.45rem 0.75rem;
        }
        .tabs-bar {
            width: 100%;
            flex-wrap: wrap;
        }
        .tab-btn {
            flex: 1 1 auto;
            justify-content: center;
            font-size: 0.78rem;
            padding: 0.55rem 0.6rem;
        }
        .yield-pills-stack {
            align-items: flex-start;
        }
        .icon-btn {
            width: 36px;
            height: 36px;
        }
    }
</style>
