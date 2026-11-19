<script setup lang="ts">
  import { ref, onMounted, watch, computed } from 'vue';
  import { supabase } from '../services/supabase';
  import { useFilterStore } from '../stores/useFilterStore';
  import { storeToRefs } from 'pinia';

  import {
    PhCurrencyDollar,
    PhShoppingCart,
    PhTrendUp,
    PhChartLine,
    PhTrendDown,
    PhArrowRight,
    PhWhatsappLogo,
    PhCreditCard
  } from '@phosphor-icons/vue'

  import VueApexCharts from 'vue3-apexcharts'
  import type { ApexOptions } from 'apexcharts'

  const filterStore = useFilterStore();
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

  const fetchCardsInfo = async () => {
    const { data } = await supabase.from('usr_payment').select('idPayment, nickname, closing_day');
    cardsInfo.value = data || [];
  };

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const invoicePeriodText = computed(() => {
    if (filterMode.value !== 'invoice' || selectedCardIds.value.length === 0) return '';
    
    const selectedCards = cardsInfo.value.filter(c => selectedCardIds.value.includes(c.idPayment));
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

  const fetchData = async () => {
    try {
      if (cardsInfo.value.length === 0) await fetchCardsInfo();
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
        <p v-if="!invoicePeriodText" class="subtitle">Análise completa dos seus gastos e tendências de consumo</p>
        <div v-else class="invoice-period-badge">
          <PhCreditCard :size="18" weight="fill" />
          <span>{{ invoicePeriodText }}</span>
        </div>
      </div>
    </header>

    <section class="stats-overview">
      <!-- Total de Gastos -->
      <div class="stat-card">
        <div class="stat-top">
          <span class="stat-label">Total de Gastos</span>
          <div class="stat-icon icon-brand">
            <PhCurrencyDollar size="22" weight="bold" />
          </div>
        </div>
        <div class="stat-bottom">
          <p class="stat-value">{{ formatCurrency(dashboardData.total) }}</p>
        </div>
      </div>

      <!-- Compras Realizadas -->
      <div class="stat-card">
        <div class="stat-top">
          <span class="stat-label">Compras Realizadas</span>
          <div class="stat-icon icon-info">
            <PhShoppingCart size="22" weight="bold" />
          </div>
        </div>
        <div class="stat-bottom">
          <p class="stat-value">{{ dashboardData.count || 0 }}</p>
        </div>
      </div>

      <!-- Média por Compra -->
      <div class="stat-card">
        <div class="stat-top">
          <span class="stat-label">Média por Compra</span>
          <div class="stat-icon icon-purple">
            <PhChartLine size="22" weight="bold" />
          </div>
        </div>
        <div class="stat-bottom">
          <p class="stat-value">{{ formatCurrency(dashboardData.ticketMedio) }}</p>
        </div>
      </div>

      <!-- Tendência de Consumo -->
      <div class="stat-card">
        <div class="stat-top">
          <span class="stat-label">Tendência de Consumo</span>
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

    <section class="detailed-analytics">
      <div class="chart-wrapper">
        <h2>Gastos por Categoria</h2>
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
        <h2>Evolução de Gastos</h2>
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
    font-size: 0.95rem;
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

  /* === CARDS DE KPI (Mesma linguagem da Home) === */
  .stats-overview {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
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
    gap: 1rem;
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
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .stat-icon {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .icon-brand {
    background: hsla(24, 85%, 52%, 0.12);
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
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
    letter-spacing: -0.02em;
    font-feature-settings: "tnum";
  }

  .text-danger { color: var(--danger-color); }
  .text-success { color: var(--success-color); }

  .stat-helper {
    font-size: 0.78rem;
    color: var(--text-secondary);
    font-weight: 500;
  }

  /* === GRÁFICOS === */
  .detailed-analytics {
    display: grid;
    grid-template-columns: 1fr 1fr; 
    gap: 1.25rem;
  }

  .chart-wrapper {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    box-shadow: var(--shadow-sm);
    padding: 1.5rem;
    border-radius: 16px;
    overflow: hidden; 
    width: 100%;
  }
  
  .chart-wrapper h2 {
    font-size: 1.05rem;
    font-weight: 600;
    margin: 0 0 1.25rem 0;
    color: var(--text-primary);
  }

  .no-data-message {
    height: 280px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    font-size: 0.9rem;
    background-color: var(--bg-hover);
    border: 1px dashed var(--border-color);
    border-radius: 12px;
  }

  @media (max-width: 1024px) {
    .stats-overview { grid-template-columns: repeat(2, 1fr); }
    .detailed-analytics { grid-template-columns: 1fr; }
  }

  @media (max-width: 640px) {
    .stats-overview { 
      grid-template-columns: 1fr; 
      gap: 0.85rem;
    }
    .detailed-analytics { 
      grid-template-columns: 1fr;
      gap: 1rem;
    }
    .page-header h1 {
      font-size: 1.4rem;
    }
    .stat-value {
      font-size: 1.45rem;
    }
    .stat-card {
      padding: 1.15rem;
    }
    .chart-wrapper {
      padding: 1.15rem;
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

  @media (max-width: 768px) {
    .whatsapp-float {
      width: 45px;
      height: 45px;
      bottom: 20px;
      right: 20px;
    }
  }
</style>
