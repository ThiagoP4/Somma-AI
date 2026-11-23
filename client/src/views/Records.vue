<script setup lang="ts">
    import { ref, onMounted, computed, watch } from 'vue';
    import { supabase } from '../services/supabase';
    import { PhFunnel, PhMicrosoftExcelLogo, PhCreditCard } from '@phosphor-icons/vue';
    import * as XLSX from 'xlsx';
    import ListLayout from '../layouts/ListLayout.vue';
    import NewTransaction from '../components/NewTransaction.vue';
    import NewCategory from '../components/NewCategory.vue';
    import FloatingTabs from '../components/FloatingTabs.vue';
    import TransactionList from '../components/TransactionsList.vue';
    import CategoryGrid from '../components/CategoryGrid.vue';
    import { useTabsSwipe } from '../composables/useTabsSwipe';
    import { useAlertStore } from '../stores/useAlertStore';
    import { useFilterStore } from '../stores/useFilterStore';
    import { useProfileStore } from '../stores/useProfileStore';
    import { storeToRefs } from 'pinia';

    const { showAlert } = useAlertStore();
    const profileStore = useProfileStore();

    interface Registry {
        idPurchase?: number;
        idIncome?: number;
        idCategory?: number;
        title: string;
        description?: string;
        value: number;
        date: string;
        paid?: boolean;
        fin_category: {
            description: string;
            color: string;
        } | null; 
        categoryId?: number;
        payment_id?: number;
        payment?: {
            nickname: string;
            bank_name?: string;
            closing_day?: number;
        } | null;
    }

    const registries = ref<any[]>([]);
    const loading = ref(true);

    const filterStore = useFilterStore();
    const { monthNames } = filterStore;
    const { selectedMonth, selectedYear, filterMode, selectedCardIds } = storeToRefs(filterStore);

    const invoicePeriodText = computed(() => {
        if (filterMode.value !== 'invoice' || selectedCardIds.value.length === 0) return '';
        
        const selectedCards = profileStore.myCards.filter((c: any) =>
            selectedCardIds.value.includes(c.id_payment || c.idPayment)
        );
        if (selectedCards.length === 1) {
            const card = selectedCards[0];
            const day = card.closing_day || 1;
            const endDate = new Date(selectedYear.value, selectedMonth.value, day);
            const startDate = new Date(selectedYear.value, selectedMonth.value - 1, day + 1);
            
            return `Exibindo fatura de ${monthNames[selectedMonth.value]} (${card.nickname}): ${startDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} a ${endDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
        }
        
        return `Exibindo faturas de ${monthNames[selectedMonth.value]} (${selectedCards.length} cartões)`;
    });

    const showFilter = ref(false);
    const isModalOpen = ref(false);
    const isCategoryModalOpen = ref(false);
    const registryToEdit = ref<Registry | null>(null);
    
    // Filtros locais reativos
    const search = ref('');
    const searchCategory = ref<number | string>('');
    const searchData = ref('');
    const searchStatus = ref<'all' | 'paid' | 'pending'>('all');

    const categories = ref<any[]>([]);

    const fetchCategories = async () => {
        try {
            const { data, error } = await supabase
                .from('fin_category')
                .select('*')
                .order('description', { ascending: true });
            if (error) throw error;
            categories.value = data || [];
        } catch (error) {
            console.error(error);
            showAlert('Erro ao carregar categorias', 'error');
        }
    };

    const touchArea = ref<HTMLElement | null>(null);
    const { tabs, currentTab, moveTab } = useTabsSwipe(['compras', 'entradas', 'categorias'], touchArea);

    watch([currentTab, selectedMonth, selectedYear, filterMode, selectedCardIds], () => {
        fetchRegistries();
    }, { deep: true });

    // Computed que aplica os filtros de Busca, Categoria, Data e Status em tempo real!
    const filteredRegistries = computed(() => {
        return registries.value.filter((item: any) => {
            // 1. Filtro por texto (Título ou Descrição da Categoria)
            if (search.value.trim()) {
                const q = search.value.trim().toLowerCase();
                const textToMatch = `${item.title || ''} ${item.description || ''} ${item.fin_category?.description || ''} ${item.payment?.nickname || ''}`.toLowerCase();
                if (!textToMatch.includes(q)) return false;
            }

            // 2. Filtro por Categoria (apenas em compras e entradas)
            if (searchCategory.value !== '' && currentTab.value !== 'categorias') {
                const catId = Number(searchCategory.value);
                const itemCatId = Number(item.categoryId ?? item.fin_category?.idCategory);
                const selectedCatObj = categories.value.find(c => c.idCategory === catId);
                const matchesId = itemCatId === catId;
                const matchesName = selectedCatObj && item.fin_category?.description === selectedCatObj.description;
                if (!matchesId && !matchesName) return false;
            }

            // 3. Filtro por Data exata (YYYY-MM-DD)
            if (searchData.value && currentTab.value !== 'categorias') {
                const itemDateOnly = (item.date || '').split('T')[0];
                if (itemDateOnly !== searchData.value) return false;
            }

            // 4. Filtro por Status (Pago vs Pendente em Compras)
            if (currentTab.value === 'compras' && searchStatus.value !== 'all') {
                if (searchStatus.value === 'paid' && !item.paid) return false;
                if (searchStatus.value === 'pending' && item.paid) return false;
            }

            return true;
        });
    });

    const activeFiltersCount = computed(() => {
        let count = 0;
        if (search.value.trim()) count++;
        if (searchCategory.value !== '') count++;
        if (searchData.value) count++;
        if (searchStatus.value !== 'all') count++;
        return count;
    });

    const clearFilters = () => {
        search.value = '';
        searchCategory.value = '';
        searchData.value = '';
        searchStatus.value = 'all';
    };

    const exportToExcel = () => {
        if (filteredRegistries.value.length === 0) {
            showAlert('Não há registros na lista atual para exportar.', 'warning');
            return;
        }
        try {
            const rows = filteredRegistries.value.map((item: any) => ({
                Descrição: item.title || item.description || '',
                Categoria: item.fin_category?.description || (item.type || 'Geral'),
                Método: item.payment?.nickname || '-',
                Data: item.date ? new Date(item.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-',
                Status: currentTab.value === 'compras' ? (item.paid ? 'Efetivado' : 'Pendente') : 'Recebido',
                Valor: Number(item.value || 0)
            }));

            const worksheet = XLSX.utils.json_to_sheet(rows);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, currentTab.value.toUpperCase());
            XLSX.writeFile(workbook, `Somma_${currentTab.value}_${monthNames[selectedMonth.value]}_${selectedYear.value}.xlsx`);
            showAlert('Planilha Excel exportada com sucesso!', 'success');
        } catch (err) {
            console.error('Erro ao exportar Excel:', err);
            showAlert('Erro ao gerar planilha Excel.', 'error');
        }
    };

    const totalValue = computed(() => {
        if (currentTab.value === 'categorias') return 0;
        
        if (currentTab.value === 'entradas') {
            return filteredRegistries.value.reduce((acc, item) => acc + (item.value || 0), 0);
        }

        return filteredRegistries.value.reduce((acc, item) => {
            return item.paid ? acc + (item.value || 0) : acc;
        }, 0);
    });

    const openEditModal = (item: Registry) => {
        registryToEdit.value = item;
        if (currentTab.value === 'categorias') {
            isCategoryModalOpen.value = true;
            return;
        } else {
            isModalOpen.value = true;
        }
    };

    const openNewModal = () => {
        if (currentTab.value === 'categorias') {
            registryToEdit.value = null;
            isCategoryModalOpen.value = true;
            return;
        } else {
            registryToEdit.value = null;
            isModalOpen.value = true;
        }
    };

    const togglePaymentStatus = async (item: any) => {
        if (currentTab.value === 'entradas' || currentTab.value === 'categorias') return;
        
        const newStatus = !item.paid;
        
        try {
            const { error } = await supabase
                .from('fin_installment')
                .update({ paid: newStatus })
                .eq('idInstallment', item.idInstallment);

            if (error) throw error;

            item.paid = newStatus;
            if (item.paid === true) {
                showAlert('Status atualizado para Efetivado', 'success');
            } else {
                showAlert('Status atualizado para Pendente', 'success');
            }
        } catch (error) {
            console.error(error);
            showAlert('Erro ao atualizar status', 'error');
        }
    };

    const fetchRegistries = async () => {
        loading.value = true;
        try {
            if (profileStore.myCards.length === 0) {
                await profileStore.fetchProfileData();
            }
            const startDate = new Date(selectedYear.value, selectedMonth.value, 1).toISOString().split('T')[0];
            const endDate = new Date(selectedYear.value, selectedMonth.value + 1, 0).toISOString().split('T')[0];

            // 1. ABA CATEGORIAS
            if (currentTab.value === 'categorias') {
                const { data, error } = await supabase
                    .from('fin_category')
                    .select('*, fin_purchase(value)')
                    .gte('fin_purchase.date', startDate)
                    .lte('fin_purchase.date', endDate);
                
                if (error) throw error;
                registries.value = (data || []).map((cat: any) => ({
                    idCategory: cat.idCategory,
                    description: cat.description || '',
                    color: cat.color || '#cccccc',
                    type: cat.type,
                    value: (cat.fin_purchase || []).reduce((acc: number, p: any) => acc + (p.value || 0), 0),
                }));
                return;
            }

            // 2. ABA ENTRADAS
            if (currentTab.value === 'entradas') {
                const { data, error } = await supabase
                    .from('fin_income')
                    .select('*, fin_category(description, color)')
                    .order('date', { ascending: false })
                    .gte('date', startDate)
                    .lte('date', endDate);
                
                if (error) throw error;
                registries.value = data || [];
                return;
            }

            // 3. ABA COMPRAS
            if (currentTab.value === 'compras') {
                if (filterMode.value === 'invoice' && selectedCardIds.value.length === 0) {
                    registries.value = [];
                    loading.value = false;
                    return;
                }

                let query = supabase.from('fin_installment').select(`
                    idInstallment,
                    installmentNumber,
                    value,
                    dueDate,
                    paid,
                    purchaseId,
                    fin_purchase!inner(
                        title, 
                        value, 
                        date, 
                        total_installments,
                        categoryId,
                        payment_id,
                        usr_payment(nickname, bank_name, closing_day),
                        fin_category(description, color)
                    )
                `);

                if (filterMode.value === 'invoice') {
                    query = query.in('fin_purchase.payment_id', selectedCardIds.value);
                    const safeStart = new Date(selectedYear.value, selectedMonth.value - 1, 1).toISOString().split('T')[0];
                    const safeEnd = new Date(selectedYear.value, selectedMonth.value + 1, 15).toISOString().split('T')[0];
                    query = query.gte('dueDate', safeStart).lte('dueDate', safeEnd);
                } else {
                    query = query.gte('dueDate', startDate).lte('dueDate', endDate);
                }

                const { data, error } = await query.order('dueDate', { ascending: false });
                if (error) throw error;

                let result = (data || []).map((item: any) => {
                    const sufixo = item.fin_purchase.total_installments > 1
                        ? `(${item.installmentNumber}/${item.fin_purchase.total_installments}x)`
                        : '';

                    return {
                        idPurchase: item.purchaseId,
                        idInstallment: item.idInstallment,
                        title: `${item.fin_purchase.title} ${sufixo}`.trim(),
                        value: item.value,
                        date: item.dueDate,
                        paid: item.paid,
                        fin_category: item.fin_purchase.fin_category,
                        categoryId: item.fin_purchase.categoryId,
                        payment_id: item.fin_purchase.payment_id,
                        payment: item.fin_purchase.usr_payment
                    };
                });

                if (filterMode.value === 'invoice') {
                    registries.value = result.filter(item => {
                        const closingDay = item.payment?.closing_day || 1;
                        const closingDate = new Date(selectedYear.value, selectedMonth.value, closingDay);
                        const startDateCycle = new Date(selectedYear.value, selectedMonth.value - 1, closingDay + 1);
                        const itemDate = new Date(item.date);
                        return itemDate >= startDateCycle && itemDate <= closingDate;
                    });
                } else {
                    registries.value = result;
                }
            }
        } catch (error) {
            console.error(error);
            showAlert('Erro ao carregar registros', 'error');
        } finally {
            loading.value = false;
        }
    };

    const deleteRegistry = async (id: number) => {
        try {
            let table = '';
            let columnId = '';
            if (currentTab.value === 'categorias') {
                table = 'fin_category';
                columnId = 'idCategory';
            } else if (currentTab.value === 'compras') {
                table = 'fin_purchase';
                columnId = 'idPurchase';
            } else {
                table = 'fin_income';
                columnId = 'idIncome';
            }
            const { error } = await supabase.from(table).delete().eq(columnId, id);
            if (error) throw error;
            showAlert('Registro excluído com sucesso', 'success');
            fetchRegistries();
        } catch {
            showAlert('Erro ao excluir', 'error');
        }
    };

    onMounted(() => {
        fetchCategories();
        fetchRegistries();
    });
</script>

<template>
    <div ref="touchArea">
        <ListLayout
            :title="currentTab === 'compras' ? 'Minhas Compras' : currentTab === 'entradas' ? 'Entradas' : currentTab === 'categorias' ? 'Categorias' : ''"
            :buttonText="currentTab === 'compras' ? 'Nova Compra' : currentTab === 'entradas' ? 'Nova Entrada' : currentTab === 'categorias' ? 'Nova Categoria' : ''"
            :loading="loading"
            :items="registries"
            :totalValue="currentTab === 'categorias' ? 0 : totalValue"
            @addNew="openNewModal"
        >
            <template #header v-if="invoicePeriodText">
                <div class="invoice-period-badge">
                    <PhCreditCard :size="18" weight="fill" />
                    <span>{{ invoicePeriodText }}</span>
                </div>
            </template>

            <template #actions>
                <button 
                    class="btn-secondary"
                    @click="showFilter = !showFilter" 
                    :class="{ 'btn-active': showFilter || activeFiltersCount > 0 }"
                >
                    <PhFunnel size="18" />
                    <span>Filtrar</span>
                    <span v-if="activeFiltersCount > 0" class="filter-count-pill">{{ activeFiltersCount }}</span>
                </button>
                <button class="btn-secondary" @click="exportToExcel">
                    <PhMicrosoftExcelLogo size="18" /> Excel
                </button>
            </template>

            <template #filters v-if="showFilter">
                <div class="filter-card">
                    <div class="filter-row">
                        <div class="input-group">
                            <label>Buscar por nome ou cartão</label>
                            <input type="text" placeholder="Ex: Uber, Nubank, Supermercado..." v-model="search" />
                        </div>
                        <div class="input-group" v-if="currentTab !== 'categorias'">
                            <label>Categoria</label>
                            <select v-model="searchCategory">
                                <option value="">Todas as categorias</option>
                                <option v-for="category in categories" :key="category.idCategory" :value="category.idCategory">
                                    {{ category.description }}
                                </option>
                            </select> 
                        </div>
                        <div class="input-group" v-if="currentTab === 'compras'">
                            <label>Status</label>
                            <select v-model="searchStatus">
                                <option value="all">Todos (Pagos + Pendentes)</option>
                                <option value="paid">Apenas Efetivados</option>
                                <option value="pending">Apenas Pendentes</option>
                            </select>
                        </div>
                        <div class="input-group" v-if="currentTab !== 'categorias'">
                            <label>Data específica</label>
                            <input type="date" v-model="searchData"/>
                        </div>
                    </div>
                    <div class="filter-footer">
                        <button type="button" class="btn-clean" @click="clearFilters">Limpar filtros</button>
                        <button type="button" class="btn-apply" @click="showFilter = false">Concluir</button>
                    </div>
                </div>
            </template>

            <template #body>
                <TransactionList 
                    v-if="currentTab === 'compras' || currentTab === 'entradas'" 
                    :items="filteredRegistries" 
                    :currentTab="currentTab"
                    @edit="openEditModal"
                    @delete="deleteRegistry"
                    @toggle-paid="togglePaymentStatus"
                />

                <CategoryGrid 
                    v-else-if="currentTab === 'categorias'" 
                    :items="filteredRegistries"
                    @add="openNewModal"
                    @delete="deleteRegistry"
                />
            </template>
        </ListLayout>

        <FloatingTabs :tabs="tabs" :currentTab="currentTab" @move="moveTab" @select="currentTab = $event" />

        <NewTransaction 
            v-if="isModalOpen" 
            :transactionData="registryToEdit"
            :type="currentTab"
            @close="isModalOpen = false" 
            @saved="fetchRegistries"
        />

        <NewCategory 
            v-if="isCategoryModalOpen"
            :categoryData="registryToEdit" 
            @close="isCategoryModalOpen = false" 
            @saved="() => { fetchCategories(); fetchRegistries(); }"
        />
    </div>
</template>

<style scoped>
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
        border: 1px solid rgba(56, 189, 248, 0.25);
        margin-bottom: 1rem;
    }

    .filter-count-pill {
        background: var(--primary-color);
        color: white;
        font-size: 0.7rem;
        font-weight: 700;
        padding: 1px 6px;
        border-radius: 99px;
    }
</style>
