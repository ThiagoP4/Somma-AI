<script setup lang="ts">
  import { ref, onMounted, watch, computed } from 'vue';
  import { supabase } from '../services/supabase';
  import { useFilterStore } from '../stores/useFilterStore';
  import { useProfileStore } from '../stores/useProfileStore';
  import { storeToRefs } from 'pinia';

  import {
    PhCurrencyDollar,
    PhShoppingCart,
    PhTrendUp,
    PhTrendDown,
    PhArrowRight,
    PhWhatsappLogo,
    PhCreditCard,
    PhPulse,
    PhLightning,
    PhTrophy,
    PhSparkle,
    PhCheckCircle,
    PhClock
  } from '@phosphor-icons/vue';

  import VueApexCharts from 'vue3-apexcharts';
  import type { ApexOptions } from 'apexcharts';

  const filterStore = useFilterStore();
  const profileStore = useProfileStore();
  const { selectedMonth, selectedYear, filterMode, selectedCardIds } = storeToRefs(filterStore);

  const dashboardData = ref({
    total: 0,
    count: 0,
    ticketMedio: 0,
    trend: {
      status: 'stable',
      text: 'Analisando...',
      current: 0,
      last: 0
    },
    pieChart: {
      series: [] as number[],
      labels: [] as string[],
      colors: [] as string[]
    },
    lineChart: {
      series: [] as any[],
      categories: [] as string[]
    }
  });

  const pieSeries = ref<number[]>([]);
  const cardsInfo = ref<any[]>([]);

  // Novos dados analíticos do mês selecionado
  const totalIncomesMonth = ref(0);
  const rawInstallmentsMonth = ref<any[]>([]);

  const fetchCardsInfo = async () => {
    const { data } = await supabase.from('usr_payment').select('id_payment, nickname, bank_name, closing_day');
    cardsInfo.value = data || [];
  };

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const invoicePeriodText = computed(() => {
    if (filterMode.value !== 'invoice' || selectedCardIds.value.length === 0) return '';
    
    const selectedCards = cardsInfo.value.filter(c => selectedCardIds.value.includes(c.id_payment || c.idPayment));
    if (selectedCards.length === 1) {
      const card = selectedCards[0];
      const day = card.closing_day || 1;
      const endDate = new Date(selectedYear.value, selectedMonth.value, day);
      const startDate = new Date(selectedYear.value, selectedMonth.value - 1, day + 1);
      
      return `Exibindo fatura de ${monthNames[selectedMonth.value]}: ${startDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} a ${endDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
    }
    
    return `Exibindo faturas de ${monthNames[selectedMonth.value]}`;
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  // === 1. SAÚDE DO ORÇAMENTO & TAXA DE POUPANÇA (50/30/20) ===
  const commitmentPct = computed(() => {
    if (totalIncomesMonth.value <= 0) return 0;
    return Math.min(100, Math.round((dashboardData.value.total / totalIncomesMonth.value) * 100));
  });

  const savingsRatePct = computed(() => {
    if (totalIncomesMonth.value <= 0) return 0;
    return Math.max(0, 100 - commitmentPct.value);
  });

  const freeCashAmount = computed(() => {
    return totalIncomesMonth.value - dashboardData.value.total;
  });

  // === 2. RITMO DIÁRIO (BURN RATE) & PROJEÇÃO ===
  const burnRateStats = computed(() => {
    const daysInMonth = new Date(selectedYear.value, selectedMonth.value + 1, 0).getDate();
    const now = new Date();
    const isCurrentMonth = now.getFullYear() === selectedYear.value && now.getMonth() === selectedMonth.value;
    const elapsedDays = isCurrentMonth ? Math.max(1, now.getDate()) : daysInMonth;

    const dailyAverage = dashboardData.value.total / elapsedDays;
    const projectedEndMonth = isCurrentMonth
      ? dashboardData.value.total + dailyAverage * (daysInMonth - elapsedDays)
      : dashboardData.value.total;

    const paidTotal = rawInstallmentsMonth.value
      .filter(i => i.paid)
      .reduce((acc, i) => acc + Number(i.value || 0), 0);
    const pendingTotal = rawInstallmentsMonth.value
      .filter(i => !i.paid)
      .reduce((acc, i) => acc + Number(i.value || 0), 0);

    return {
      dailyAverage,
      projectedEndMonth,
      elapsedDays,
      daysInMonth,
      paidTotal,
      pendingTotal
    };
  });

  // === 3. CONCENTRAÇÃO DE GASTOS POR CARTÃO ===
  const cardBreakdown = computed(() => {
    const map = new Map<string, { nickname: string; bank: string; total: number; count: number }>();

    rawInstallmentsMonth.value.forEach((item: any) => {
      const payment = item.fin_purchase?.usr_payment;
      const nickname = payment?.nickname || 'Outros / À Vista';
      const bank = payment?.bank_name || 'Geral';
      const prev = map.get(nickname) || { nickname, bank, total: 0, count: 0 };
      prev.total += Number(item.value || 0);
      prev.count += 1;
      map.set(nickname, prev);
    });

    const totalExp = dashboardData.value.total || 1;
    return Array.from(map.values())
      .map(c => ({
        ...c,
        percent: Math.round((c.total / totalExp) * 100)
      }))
      .sort((a, b) => b.total - a.total);
  });

  // === 4. TOP MAIORES DESPESAS DO MÊS (PARETO) ===
  const topExpenses = computed(() => {
    const totalExp = dashboardData.value.total || 1;
    return [...rawInstallmentsMonth.value]
      .map((item: any) => {
        const p = item.fin_purchase || {};
        const suffix = p.total_installments > 1 ? ` (${item.installmentNumber}/${p.total_installments}x)` : '';
        return {
          id: item.idInstallment,
          title: `${p.title || 'Despesa'}${suffix}`,
          category: p.fin_category?.description || 'Geral',
          color: p.fin_category?.color || '#6366F1',
          card: p.usr_payment?.nickname || 'Direto',
          value: Number(item.value || 0),
          paid: Boolean(item.paid),
          sharePct: Math.round((Number(item.value || 0) / totalExp) * 100)
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 4);
  });

  const pieOptions = ref<ApexOptions>({
    labels: [],
    colors: [],
    chart: { type: 'donut', fontFamily: 'Inter, sans-serif', background: 'transparent' },
    legend: { position: 'bottom', fontSize: '13px', labels: { colors: 'var(--text-secondary)' } },
    dataLabels: { enabled: false },
    stroke: { show: false },
    plotOptions: {
      pie: {
        donut: {
          size: '72%',
          labels: {
            show: true,
            name: { color: 'var(--text-secondary)' },
            value: { color: 'var(--text-primary)', fontWeight: 700 },
            total: {
              show: true,
              label: 'Total',
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              formatter: (w: any) => 'R$ ' + w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0).toFixed(2)
            }
          }
        }
      }
    }
  });

  const lineOptions = ref<ApexOptions>({
    chart: { type: 'area', toolbar: { show: false }, fontFamily: 'Inter, sans-serif', background: 'transparent' },
    stroke: { curve: 'smooth', width: 3 },
    colors: ['#6366F1'],
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.02, stops: [0, 90, 100] } },
    dataLabels: { enabled: false },
    xaxis: { 
      categories: [], 
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { style: { colors: 'var(--text-secondary)' } }
    },
    yaxis: {
      labels: { style: { colors: 'var(--text-secondary)' } }
    },
    grid: { show: true, borderColor: 'var(--border-color)', strokeDashArray: 4 },
    tooltip: { 
      theme: 'dark',
      x: { format: 'dd/MM/yyyy' }
    }
  });

  const fetchComplementaryAnalytics = async () => {
    try {
      if (!profileStore.userId) await profileStore.fetchProfileData();
      const startOfMonth = new Date(selectedYear.value, selectedMonth.value, 1).toISOString().split('T')[0];
      const endOfMonth = new Date(selectedYear.value, selectedMonth.value + 1, 0).toISOString().split('T')[0];

      const { data: incData } = await supabase
        .from('fin_income')
        .select('value')
        .gte('date', startOfMonth)
        .lte('date', endOfMonth)
        .eq('user_id', profileStore.userId);

      totalIncomesMonth.value = (incData || []).reduce((acc: number, curr: any) => acc + Number(curr.value || 0), 0);

      let instQuery = supabase
        .from('fin_installment')
        .select(`
          idInstallment,
          installmentNumber,
          value,
          dueDate,
          paid,
          fin_purchase!inner(
            title,
            total_installments,
            payment_id,
            usr_payment(nickname, bank_name, closing_day),
            fin_category(description, color)
          )
        `)
        .gte('dueDate', startOfMonth)
        .lte('dueDate', endOfMonth);

      if (filterMode.value === 'invoice' && selectedCardIds.value.length > 0) {
        instQuery = instQuery.in('fin_purchase.payment_id', selectedCardIds.value);
      }

      const { data: instData } = await instQuery;
      rawInstallmentsMonth.value = instData || [];
    } catch (e) {
      console.error('Erro ao buscar análises complementares:', e);
    }
  };

  const fetchData = async () => {
    try {
      if (cardsInfo.value.length === 0) await fetchCardsInfo();
      await fetchComplementaryAnalytics();

      const params: any = {
        p_month: selectedMonth.value + 1,
        p_year: selectedYear.value
      };

      if (filterMode.value === 'invoice') {
        if (selectedCardIds.value.length > 0) {
          params.p_card_ids = selectedCardIds.value;
        } else {
          dashboardData.value = {
            total: 0,
            count: 0,
            ticketMedio: 0,
            trend: { status: 'stable', text: 'Selecione um cartão', current: 0, last: 0 },
            pieChart: { series: [], labels: [], colors: [] },
            lineChart: { series: [], categories: [] }
          };
          pieSeries.value = [];
          return;
        }
      }

      const { data, error } = await supabase.rpc('get_dashboard_data', params);

      if (error) throw error;
      
      const apiData = data;

      if (!apiData) return;
      
      dashboardData.value = {
        total: Number(apiData.total) || 0,
        count: Number(apiData.count) || 0,
        ticketMedio: Number(apiData.ticketMedio) || 0,
        trend: {
          status: apiData.trend?.status || 'stable',
          text: apiData.trend?.text || 'Sem dados',
          current: Number(apiData.trend?.current) || 0,
          last: Number(apiData.trend?.last) || 0
        },
        pieChart: { series: [], labels: [], colors: [] },
        lineChart: { series: [], categories: [] }
      };

      if (apiData.pieChart && apiData.pieChart.series) {
        pieSeries.value = apiData.pieChart.series;
        pieOptions.value = {
          ...pieOptions.value,
          labels: apiData.pieChart.labels || [],
          colors: apiData.pieChart.colors || []
        };
      } else {
        pieSeries.value = [];
      }

      if (apiData.lineChart && apiData.lineChart.series) {
        const safeSeries = apiData.lineChart.series.map((serie: any) => ({
          ...serie,
          data: Array.isArray(serie.data) ? serie.data : []
        }));
        const hasData = safeSeries.some((s: any) => s.data && s.data.length > 0);
        if (hasData) {
          dashboardData.value.lineChart.series = safeSeries;
          lineOptions.value = {
            ...lineOptions.value,
            xaxis: { 
              ...lineOptions.value.xaxis,
              categories: apiData.lineChart.categories || []
            }
          };
        } else {
          dashboardData.value.lineChart.series = [];
        }
      }
    } catch (error) {
      console.error('Erro ao buscar dados do dashboard:', error);
    }
  };

  watch([selectedMonth, selectedYear, filterMode, selectedCardIds], () => {
    fetchData();
  }, { deep: true });

  onMounted(() => {
    fetchData();
  });
</script>

<template>
  <div class="dashboard-page">
    <header class="page-header">
      <div>
        <h1>Dashboard Financeiro</h1>
        <p v-if="!invoicePeriodText" class="subtitle">Inteligência analítica sobre seu ritmo de gastos, cartões e saúde orçamentária</p>
        <div v-else class="invoice-period-badge">
          <PhCreditCard :size="18" weight="fill" />
          <span>{{ invoicePeriodText }}</span>
        </div>
      </div>

      <button class="btn-secondary" @click="$router.push('/copilot')">
        <PhSparkle size="17" weight="fill" style="color: var(--primary-color)" />
        Pedir Diagnóstico à IA
      </button>
    </header>

    <!-- 1. LINHA DE KPIs PRINCIPAIS -->
    <section class="stats-overview">
      <div class="stat-card">
        <div class="stat-top">
          <span class="stat-label">Total de Gastos</span>
          <div class="stat-icon icon-brand">
            <PhCurrencyDollar size="22" weight="bold" />
          </div>
        </div>
        <div class="stat-bottom">
          <p class="stat-value">{{ formatCurrency(dashboardData.total) }}</p>
          <span class="stat-helper">
            {{ formatCurrency(burnRateStats.paidTotal) }} pagos • {{ formatCurrency(burnRateStats.pendingTotal) }} pendentes
          </span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-top">
          <span class="stat-label">Compras Realizadas</span>
          <div class="stat-icon icon-info">
            <PhShoppingCart size="22" weight="bold" />
          </div>
        </div>
        <div class="stat-bottom">
          <p class="stat-value">{{ dashboardData.count || 0 }} <small class="unit-lbl">lançamentos</small></p>
          <span class="stat-helper">Média de {{ formatCurrency(dashboardData.ticketMedio) }} por compra</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-top">
          <span class="stat-label">Ritmo Diário (Burn Rate)</span>
          <div class="stat-icon icon-purple">
            <PhLightning size="22" weight="bold" />
          </div>
        </div>
        <div class="stat-bottom">
          <p class="stat-value">{{ formatCurrency(burnRateStats.dailyAverage) }}<small class="unit-lbl">/dia</small></p>
          <span class="stat-helper">Projeção fim do mês: {{ formatCurrency(burnRateStats.projectedEndMonth) }}</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-top">
          <span class="stat-label">Tendência vs. Mês Anterior</span>
          <div class="stat-icon" :class="{
            'icon-danger': dashboardData.trend.status === 'up',
            'icon-success': dashboardData.trend.status === 'down',
            'icon-info': dashboardData.trend.status === 'stable'
          }">
            <PhTrendUp size="22" weight="bold" v-if="dashboardData.trend.status === 'up'" />
            <PhTrendDown size="22" weight="bold" v-else-if="dashboardData.trend.status === 'down'" />
            <PhArrowRight size="22" weight="bold" v-else />
          </div>
        </div>
        <div class="stat-bottom">
          <p class="stat-value" :class="{
            'text-danger': dashboardData.trend.status === 'up',
            'text-success': dashboardData.trend.status === 'down'
          }">{{ dashboardData.trend.text }}</p>
          <span class="stat-helper">
            Mês anterior: {{ formatCurrency(dashboardData.trend.last) }}
          </span>
        </div>
      </div>
    </section>

    <!-- 2. TERMÔMETRO DE SAÚDE ORÇAMENTÁRIA (ENTRADAS VS SAÍDAS) -->
    <section class="budget-health-card">
      <div class="health-header">
        <div class="health-title-group">
          <div class="stat-icon icon-brand" style="width: 36px; height: 36px;">
            <PhPulse size="20" weight="bold" />
          </div>
          <div>
            <h2>Termômetro de Comprometimento da Renda</h2>
            <p>Relação entre suas receitas do mês ({{ formatCurrency(totalIncomesMonth) }}) e o total de gastos</p>
          </div>
        </div>

        <div class="health-badges">
          <span class="h-badge" :class="commitmentPct <= 70 ? 'badge-good' : commitmentPct <= 90 ? 'badge-warn' : 'badge-bad'">
            {{ commitmentPct }}% da renda comprometida
          </span>
          <span class="h-badge badge-save">
            Taxa de Poupança: {{ savingsRatePct }}% ({{ formatCurrency(freeCashAmount) }} livres)
          </span>
        </div>
      </div>

      <div class="health-meter-track">
        <div
          class="health-meter-fill"
          :class="commitmentPct <= 70 ? 'fill-good' : commitmentPct <= 90 ? 'fill-warn' : 'fill-bad'"
          :style="{ width: commitmentPct + '%' }"
        ></div>
        <div class="meter-marker" style="left: 50%" title="Ideal para Custos Essenciais (50%)">
          <span>50% Essencial</span>
        </div>
        <div class="meter-marker" style="left: 80%" title="Limite Saudável Total (80%)">
          <span>80% Teto Saudável</span>
        </div>
      </div>
    </section>

    <!-- 3. GRÁFICOS APEXCHARTS (CATEGORIAS & EVOLUÇÃO) -->
    <section class="detailed-analytics">
      <div class="chart-wrapper">
        <div class="widget-header">
          <h2>Distribuição por Categoria</h2>
          <span class="widget-tag">Composição do Mês</span>
        </div>
        <div class="charts-placeholder">
          <VueApexCharts 
            v-if="pieSeries && pieSeries.length > 0"
            type="donut" 
            height="300" 
            :options="pieOptions" 
            :series="pieSeries" />
          <div v-else class="no-data-message">
            <p>Sem dados registrados neste período.</p>
          </div>
        </div>
      </div>
  
      <div class="chart-wrapper">
        <div class="widget-header">
          <h2>Curva de Acumulação de Gastos</h2>
          <span class="widget-tag">Ritmo no Tempo</span>
        </div>
        <div class="charts-placeholder">
          <VueApexCharts 
            v-if="dashboardData.lineChart && dashboardData.lineChart.series && dashboardData.lineChart.series.length > 0"
            type="area" 
            height="300" 
            :options="lineOptions" 
            :series="dashboardData.lineChart.series" />
          <div v-else class="no-data-message">
            <p>Sem dados registrados neste período.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- 4. NOVA SEÇÃO: CONCENTRAÇÃO POR CARTÃO + TOP MAIORES GASTOS (PARETO) -->
    <section class="deep-insights-grid">
      <!-- Concentração por Cartão de Crédito -->
      <div class="insight-card">
        <div class="widget-header">
          <div class="title-with-icon">
            <PhCreditCard size="19" weight="duotone" class="accent-ic" />
            <h2>Concentração por Cartão / Método</h2>
          </div>
          <span class="widget-tag">{{ cardBreakdown.length }} métodos</span>
        </div>

        <div class="card-breakdown-list" v-if="cardBreakdown.length > 0">
          <div class="cb-item" v-for="c in cardBreakdown" :key="c.nickname">
            <div class="cb-top">
              <div class="cb-info">
                <strong>{{ c.nickname }}</strong>
                <span>{{ c.bank }} • {{ c.count }} {{ c.count === 1 ? 'compra' : 'compras' }}</span>
              </div>
              <div class="cb-values">
                <strong>{{ formatCurrency(c.total) }}</strong>
                <span class="pct-pill">{{ c.percent }}%</span>
              </div>
            </div>
            <div class="cb-bar-track">
              <div class="cb-bar-fill" :style="{ width: c.percent + '%' }"></div>
            </div>
          </div>
        </div>
        <div v-else class="empty-insight">
          Nenhuma compra vinculada a cartões neste período.
        </div>
      </div>

      <!-- Top 4 Maiores Gastos (Vilões do Orçamento) -->
      <div class="insight-card">
        <div class="widget-header">
          <div class="title-with-icon">
            <PhTrophy size="19" weight="duotone" class="accent-ic" />
            <h2>Maiores Despesas do Mês (Impacto Pareto)</h2>
          </div>
          <span class="widget-tag">Top {{ topExpenses.length }}</span>
        </div>

        <div class="top-expenses-list" v-if="topExpenses.length > 0">
          <div class="te-row" v-for="(item, idx) in topExpenses" :key="item.id || idx">
            <div class="te-rank">#{{ idx + 1 }}</div>
            <div class="te-main">
              <span class="te-title">{{ item.title }}</span>
              <div class="te-meta">
                <span class="te-cat-dot" :style="{ backgroundColor: item.color }"></span>
                <span>{{ item.category }}</span>
                <span>•</span>
                <span>{{ item.card }}</span>
              </div>
            </div>
            <div class="te-right">
              <strong class="te-val">{{ formatCurrency(item.value) }}</strong>
              <span class="te-share">
                <PhCheckCircle v-if="item.paid" size="12" weight="fill" class="text-success" />
                <PhClock v-else size="12" />
                {{ item.sharePct }}% do mês
              </span>
            </div>
          </div>
        </div>
        <div v-else class="empty-insight">
          Sem despesas registradas para ranquear neste mês.
        </div>
      </div>
    </section>

    <!-- Botão de WhatsApp Flutuante -->
    <a 
      href="https://wa.me/5527997816701" 
      target="_blank" 
      class="whatsapp-float"
      title="Fale com nosso Bot"
    >
      <PhWhatsappLogo :size="28" weight="fill" />
    </a>
  </div>
</template>

<style scoped>
  .dashboard-page {
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

  .page-header h1 {
    font-size: 1.75rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text-primary);
    margin: 0 0 0.25rem 0;
  }

  .subtitle {
    margin: 0;
    color: var(--text-secondary);
    font-size: 0.925rem;
  }

  .invoice-period-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--info-bg);
    color: var(--info-color);
    padding: 0.4rem 1rem;
    border-radius: 99px;
    font-weight: 600;
    font-size: 0.85rem;
    margin-top: 0.5rem;
  }

  /* === 1. CARDS DE KPI === */
  .stats-overview {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 1.25rem;
  }

  .stat-card {
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 16px;
    padding: 1.35rem;
    box-shadow: var(--shadow-sm);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 0.9rem;
    min-width: 0;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .stat-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }

  .stat-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
  }

  .stat-label {
    font-size: 0.825rem;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .stat-icon {
    width: 40px;
    height: 40px;
    border-radius: 11px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .icon-brand {
    background: var(--primary-subtle);
    color: var(--primary-color);
  }

  .icon-info {
    background: var(--info-bg);
    color: var(--info-color);
  }

  .icon-purple {
    background: var(--purple-bg);
    color: var(--purple-color);
  }

  .icon-success {
    background: var(--success-bg);
    color: var(--success-color);
  }

  .icon-danger {
    background: var(--danger-bg);
    color: var(--danger-color);
  }

  .stat-bottom {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .stat-value {
    font-size: 1.65rem;
    font-weight: 800;
    color: var(--text-primary);
    margin: 0;
    letter-spacing: -0.02em;
    font-feature-settings: "tnum";
  }

  .unit-lbl {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .text-danger { color: var(--danger-text); }
  .text-success { color: var(--success-text); }

  .stat-helper {
    font-size: 0.76rem;
    color: var(--text-secondary);
    font-weight: 500;
  }

  /* === 2. TERMÔMETRO DE SAÚDE ORÇAMENTÁRIA === */
  .budget-health-card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 16px;
    padding: 1.5rem;
    box-shadow: var(--shadow-sm);
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .health-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .health-title-group {
    display: flex;
    align-items: center;
    gap: 0.85rem;
  }

  .health-title-group h2 {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .health-title-group p {
    margin: 2px 0 0 0;
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .health-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .h-badge {
    font-size: 0.76rem;
    font-weight: 700;
    padding: 4px 10px;
    border-radius: 99px;
  }

  .badge-good {
    background: var(--success-bg);
    color: var(--success-text);
  }

  .badge-warn {
    background: rgba(245, 158, 11, 0.14);
    color: #F59E0B;
  }

  .badge-bad {
    background: var(--danger-bg);
    color: var(--danger-text);
  }

  .badge-save {
    background: var(--primary-subtle);
    color: var(--primary-color);
  }

  .health-meter-track {
    position: relative;
    width: 100%;
    height: 12px;
    background: var(--bg-elevated);
    border-radius: 99px;
    margin-bottom: 1rem;
  }

  .health-meter-fill {
    height: 100%;
    border-radius: 99px;
    transition: width 0.4s ease;
  }

  .fill-good { background: linear-gradient(90deg, #6366F1, #10B981); }
  .fill-warn { background: linear-gradient(90deg, #6366F1, #F59E0B); }
  .fill-bad { background: linear-gradient(90deg, #F59E0B, #F43F5E); }

  .meter-marker {
    position: absolute;
    top: -3px;
    bottom: -3px;
    width: 2px;
    background: var(--text-muted);
  }

  .meter-marker span {
    position: absolute;
    top: 18px;
    transform: translateX(-50%);
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--text-muted);
    white-space: nowrap;
  }

  /* === 3. GRÁFICOS === */
  .detailed-analytics,
  .deep-insights-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 1.25rem;
  }

  .chart-wrapper,
  .insight-card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    box-shadow: var(--shadow-sm);
    padding: 1.5rem;
    border-radius: 16px;
    overflow: hidden;
    min-width: 0;
  }

  .widget-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.25rem;
    gap: 0.5rem;
  }

  .widget-header h2 {
    font-size: 1.02rem;
    font-weight: 700;
    margin: 0;
    color: var(--text-primary);
  }

  .title-with-icon {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .accent-ic {
    color: var(--primary-color);
    flex-shrink: 0;
  }

  .widget-tag {
    font-size: 0.72rem;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 6px;
    background: var(--bg-elevated);
    color: var(--text-secondary);
    border: 1px solid var(--border-color);
  }

  /* === 4. INSIGHTS PROFUNDOS (CARTÕES & PARETO) === */
  .card-breakdown-list {
    display: flex;
    flex-direction: column;
    gap: 1.1rem;
  }

  .cb-item {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }

  .cb-top {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.5rem;
  }

  .cb-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .cb-info strong {
    font-size: 0.9rem;
    color: var(--text-primary);
  }

  .cb-info span {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .cb-values {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .cb-values strong {
    font-size: 0.925rem;
    font-feature-settings: "tnum";
  }

  .pct-pill {
    font-size: 0.72rem;
    font-weight: 700;
    background: var(--primary-subtle);
    color: var(--primary-color);
    padding: 2px 7px;
    border-radius: 6px;
  }

  .cb-bar-track {
    width: 100%;
    height: 7px;
    background: var(--bg-elevated);
    border-radius: 99px;
    overflow: hidden;
  }

  .cb-bar-fill {
    height: 100%;
    background: var(--primary-gradient);
    border-radius: 99px;
    transition: width 0.3s ease;
  }

  /* Top Maiores Despesas */
  .top-expenses-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .te-row {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    padding: 0.8rem 0.95rem;
    border-radius: 12px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-color);
  }

  .te-rank {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: var(--primary-subtle);
    color: var(--primary-color);
    font-weight: 800;
    font-size: 0.78rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .te-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .te-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .te-meta {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.74rem;
    color: var(--text-secondary);
  }

  .te-cat-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .te-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    flex-shrink: 0;
  }

  .te-val {
    font-size: 0.9rem;
    font-weight: 700;
    font-feature-settings: "tnum";
  }

  .te-share {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 0.7rem;
    color: var(--text-muted);
    font-weight: 600;
  }

  .empty-insight,
  .no-data-message {
    height: 240px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    font-size: 0.875rem;
    background-color: var(--bg-hover);
    border: 1px dashed var(--border-color);
    border-radius: 12px;
  }

  @media (max-width: 1100px) {
    .stats-overview { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .detailed-analytics,
    .deep-insights-grid { grid-template-columns: minmax(0, 1fr); }
  }

  @media (max-width: 640px) {
    .stats-overview { 
      grid-template-columns: minmax(0, 1fr); 
      gap: 0.85rem;
    }
    .page-header h1 {
      font-size: 1.4rem;
    }
    .stat-value {
      font-size: 1.45rem;
    }
  }

  /* Botão de WhatsApp Flutuante */
  .whatsapp-float {
    position: fixed;
    width: 50px;
    height: 50px;
    bottom: 25px;
    right: 25px;
    background-color: #25d366;
    color: #FFF;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(37, 211, 102, 0.35);
    z-index: 1000;
    text-decoration: none;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .whatsapp-float:hover {
    transform: translateY(-3px);
    background-color: #1ed760;
    box-shadow: 0 6px 16px rgba(37, 211, 102, 0.45);
  }
</style>
