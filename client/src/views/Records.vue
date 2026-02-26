<script setup lang="ts">
    import { ref, onMounted, computed, watch } from 'vue';
    import { supabase } from '../services/supabase';
    import { PhFunnel, PhMicrosoftExcelLogo } from '@phosphor-icons/vue';
    import ListLayout from '../layouts/ListLayout.vue';
    import NewTransaction from '../components/NewTransaction.vue';
    import NewCategory from '../components/NewCategory.vue';
    import FloatingTabs from '../components/FloatingTabs.vue';
    import TransactionList from '../components/TransactionsList.vue';
    import CategoryGrid from '../components/CategoryGrid.vue';
    import { useTabsSwipe } from '../composables/useTabsSwipe';
    import { useDateStore } from '../stores/useDateStore';
    import { storeToRefs } from 'pinia';
    import { useAlertStore } from '../stores/useAlertStore';

    const { showAlert } = useAlertStore();

    interface Registry {
        idPurchase: number;
        title: string;
        value: number;
        date: string;
        Category: {
            description: string;
            color: string;
        } | null; 
    }

    const registries = ref<any[]>([]);
    const loading = ref(true);
    const showFilter = ref(false);
    const isModalOpen = ref(false);
    const isCategoryModalOpen = ref(false);
    const registryToEdit = ref<Registry | null>(null);
    const dateStore = useDateStore();
    const { selectedMonth, selectedYear } = storeToRefs(dateStore);
    

    const touchArea = ref<HTMLElement | null>(null);
    const { tabs, currentTab: currentTab, moveTab: moveTab } = useTabsSwipe(['compras', 'entradas', 'categorias'], touchArea);
    
    
    watch([currentTab, selectedMonth, selectedYear], () => {
        fetchRegistries();
    });

    const totalValue = computed(() => {
        if(currentTab.value === 'categorias') return 0; 
        return registries.value.reduce((acc, item) => acc + item.value, 0);
    });

    const openEditModal = (item: Registry) => {
        registryToEdit.value = item; // Passa os dados da linha clicada
        if(currentTab.value === 'categorias') {
            isCategoryModalOpen.value = true;
            return;
        } else {
            isModalOpen.value = true;     // Abre o modal de edição de compra
        }
    };

    const openNewModal = () => {
        if(currentTab.value === 'categorias') {
            isCategoryModalOpen.value = true;
            return;
        } else {
            registryToEdit.value = null; // Limpa qualquer dado antigo
            isModalOpen.value = true;     // Abre o modal de nova compra
        }
    };

    const fetchRegistries = async () => {
        loading.value = true;
        try {
            const startDate = new Date(selectedYear.value, selectedMonth.value - 1, 1).toISOString().split('T')[0];
            const endDate = new Date(selectedYear.value, selectedMonth.value, 0).toISOString().split('T')[0];
            if (currentTab.value === 'categorias') {
                const { data, error } = await supabase
                    .from('Category')
                    .select('*, Purchase(value)') // Faz join para somar valores por categoria
                    .gte('Purchase.date', startDate)
                    .lte('Purchase.date', endDate);
                    if (error) throw error;
                // Transforma os dados para o formato esperado pela tabela
                    registries.value = (data || []).map((cat: any) => {
                     const listaCompras = cat.Purchase || []; 
            
                    return {
                        idCategory: cat.idCategory,
                        description: cat.description || '',
                        color: cat.color || '#cccccc',
                        value: Array.isArray(listaCompras) 
                            ? listaCompras.reduce((acc: number, p: any) => acc + (p.value || 0), 0) 
                            : 0,
                    };
                });
                return; // Para a execução aqui se for categoria
            }
            const { data, error } = await supabase
            .from('Purchase')
            .select('*, Category(description, color)')
            .order('date', { ascending: false })

            if(error) throw error;
            registries.value = data || [];
        } catch (error) { 
            console.error(error);
            showAlert('Erro ao carregar registros', 'error');
         }
        finally { loading.value = false; }
    };

    const deleteRegistry = async (id: number) => {
        const msg = currentTab.value === 'categorias' ? 'Excluir Categoria (todas as compras associadas também serão excluídas)' : currentTab.value === 'compras' ? 'Excluir Compra' : 'Excluir Entrada';
        if (!confirm(`Deseja realmente ${msg}?`)) return
        try {
            const table = currentTab.value === 'categorias' ? 'Category' : 'Purchase';
            const columnId = table === 'Category' ? 'idCategory' : 'idPurchase';
            const { error } = await supabase.from(table).delete().eq(columnId, id);
            if (error) throw error;
            showAlert('Registro excluído com sucesso', 'success');
            fetchRegistries();
        } catch (e) { showAlert('Erro ao excluir', 'error'); }
    };


    onMounted(fetchRegistries);
    
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

        <template #actions>
            <button 
                class="btn-secondary"
                @click="showFilter = !showFilter" 
                :class="{ 'btn-active': showFilter }"
            >
                <PhFunnel size="18" /> Filtrar
            </button>
            <button class="btn-secondary">
                <PhMicrosoftExcelLogo size="18" /> Excel
            </button>
        </template>
        <template #filters v-if="showFilter">
            <div class="filter-card">
                <div class="filter-row">
                    <div class="input-group">
                        <label>Buscar</label>
                        <input type="text" placeholder="Digite para buscar..." />
                    </div>
                    <div class="input-group">
                        <label>Categoria</label>
                        <select>
                            <option value="">Todas</option>
                            <option value="alimentacao">Alimentação</option>
                        </select> 
                    </div>
                    <div class="input-group">
                        <label>Data</label>
                        <input type="date" />
                    </div>
                    <div class="filter-footer">
                        <button class="btn-clean" @click="showFilter = false">Limpar</button>
                        <button class="btn-apply" @click="fetchRegistries()">Filtrar</button>
                    </div>
                </div>
            </div>
        </template>

       <template #body>
            <TransactionList 
                v-if="currentTab === 'compras' || currentTab === 'entradas'" 
                :items="registries" 
                :currentTab="currentTab"
                @edit="openEditModal"
                @delete="deleteRegistry"
            />

            <CategoryGrid 
                v-else-if="currentTab === 'categorias'" 
                :items="registries"
                @delete="deleteRegistry"
            />
        </template>

        </ListLayout>
        <FloatingTabs :tabs="tabs" :currentTab="currentTab" @move="moveTab" @select="currentTab = $event" />
        <NewTransaction 
            v-if="isModalOpen" 
            :transactionData="registryToEdit"
            @close="isModalOpen = false" 
            @saved="fetchRegistries" />

        <NewCategory 
            v-if="isCategoryModalOpen"
            :categoryData="registryToEdit" 
            @close="isCategoryModalOpen = false" 
            @saved="fetchRegistries" />
            
    </div>
</template>

<style scoped>


</style>