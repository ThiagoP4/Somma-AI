<script setup lang="ts">
    import { ref, onMounted, computed, watch } from 'vue';
    import { supabase } from '../services/supabase';
    import { PhTrash, PhFunnel, PhMicrosoftExcelLogo, PhPencilSimple, } from '@phosphor-icons/vue';
    import ListLayout from '../layouts/ListLayout.vue';
    import NewTransaction from '../components/NewTransaction.vue';
    import NewCategory from '../components/NewCategory.vue';
    import FloatingTabs from '../components/FloatingTabs.vue';
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
        } | null; // Pode ser null caso o join falhe ou não tenha categoria
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

    const toBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL'}).format(v);
    const toDate = (d: string) => {
        if (!d) return '-';
        return new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
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
        <template #header>
            <tr v-if="currentTab === 'compras'">
                <th width="35%">Descrição</th>
                <th width="15%">Valor</th>
                <th width="20%">Categoria</th>
                <th width="15%" class="text-center">Data</th>
                <th width="10%" class="text-center">Ações</th>
            </tr>
            <tr v-else-if="currentTab === 'categorias'">
                <th width="50%">Descrição da Categoria</th>
                <th width="40%">Cor Identificadora</th>
                <th width="10%" class="text-center">Ações</th>
            </tr>
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
            <tr v-for="item in registries" :key="item.idPurchase || item.idCategory" class="hover-row">
                <template v-if="currentTab === 'compras'">
                    <td> 
                        <span class="row-title">
                            {{ item.title }}
                        </span>
                    </td>
                <td class="text-right value-cell">{{ toBRL(item.value) }}</td>
                <td>
                    <div class="category-wrapper">
                    <span class="category-dot"
                    :style="{ backgroundColor: item.Category?.color || 'var(--text-muted)' }">
                    </span>{{ item.Category?.description }}
                    </div>
                    </td>
                <td> {{ toDate(item.date) }}</td>
                </template>
                <template v-else-if="currentTab === 'categorias'">
                    <td><span class="row-title">{{ item.description }}</span></td>
                    <td>
                        <div class="category-wrapper">
                            <span class="category-dot" :style="{ backgroundColor: item.color || 'var(--text-muted)' }"></span>
                            {{ item.color }}
                        </div>
                    </td>
                </template>
                <td class="text-center">
                    <div class="actions-wrapper">
                        <button class="action-btn edit-btn" @click="openEditModal(item)" title="Editar">
                            <PhPencilSimple size="18" />
                        </button>
                        <button class="action-btn" @click="deleteRegistry(item.idPurchase || item.idCategory )" title="Excluir">
                            <PhTrash size="18" />
                        </button>
                    </div>
                </td>
            </tr>
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

    .row-title { font-weight: 600; color: var(--text-primary); font-size: 0.95rem; display: block; }
    .date-text { color: var(--text-secondary); font-size: 0.85rem; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .value-cell { font-weight: 600; color: #10B981; font-feature-settings: "tnum"; font-size: 0.95rem; }
    .actions-wrapper { display: flex; justify-content: center; gap: 8px; }
    .category-wrapper { display: flex; align-items: center; gap: 8px; font-weight: 500; color: var(--text-primary); }
    .category-dot { width: 10px; height: 10px; border-radius: 50%; background-color: var(--primary-color); display: inline-block; }

    @media (max-width: 640px) {
        .badge { font-size: 0.75rem; padding: 2px 6px; }
    }

</style>