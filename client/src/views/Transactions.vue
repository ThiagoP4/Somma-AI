<script setup lang="ts">
    import { ref, onMounted, computed } from 'vue';
    import { useRouter } from 'vue-router';
    import { supabase } from '../services/supabase';
    import { PhTrash, PhFunnel, PhMicrosoftExcelLogo } from '@phosphor-icons/vue';
    import ListLayout from '../layouts/ListLayout.vue';

    interface Transaction {
        idPurchase: number;
        title: string;
        value: number;
        date: string;
        Category: {
            description: string;
            color: string;
        } | null; // Pode ser null caso o join falhe ou não tenha categoria
    }
    
    const router = useRouter();
    const transactions = ref<Transaction[]>([]);
    const loading = ref(true);
    const showFilter = ref(false);

    const totalValue = computed(() => {
        return transactions.value.reduce((acc, item) => acc + item.value, 0);
    });

    const fetchTransactions = async () => {
        loading.value = true;
        try {
            const { data, error } = await supabase
            .from('Purchase')
            .select('*, Category(description, color)')
            .order('date', { ascending: false })

            if(error) throw error;
            transactions.value = data || [];
        } catch (error) { console.error(error); }
        finally { loading.value = false; }
    };
    const deleteTransaction = async (id: number) => {
        if (!confirm('Excluir Compra')) return
        try {
            console.log('Tentando excluir ID:', id);
           const { error } = await supabase.from('Purchase').delete().eq('idPurchase', id);
            if (error) throw error;
            fetchTransactions();
        } catch (e) { alert('Erro ao excluir') }
    };

    const toBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL'}).format(v);
    const toDate = (d: string) => {
        if (!d) return '-';
        return new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    };

    onMounted(fetchTransactions);
    
</script>

<template>
    <ListLayout 
        title="Minhas Compras" 
        buttonText="Nova Compra"
        :loading="loading"
        :items="transactions"
        :totalValue="totalValue"
        @addNew="router.push('/new-transaction')"
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
        <tr>
            <th width="35%">Descrição</th>
            <th width="15%">Valor</th>
            <th width="20%">Categoria</th>
            <th width="15%" class="text-center">Data</th>
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
                    <button class="btn-apply" @click="fetchTransactions()">Filtrar</button>
                </div>
            </div>
        </div>
    </template>

    <template #body>
        <tr v-for="item in transactions" :key="item.idPurchase" class="hover-row">
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
            <td class="text-center">
                <div class="actions-wrapper">
                    <button class="action-btn" @click="deleteTransaction(item.idPurchase)" title="Excluir">
                        <PhTrash size="18" />
                    </button>
                </div>
            </td>
        </tr>
    </template>

</ListLayout>

</template>

<style scoped>

    .row-title {
        font-weight: 600;
        color: var(--text-primary);
        font-size: 0.95rem;
        display: block;
    }

    .date-text {
        color: var(--text-secondary);
        font-size: 0.85rem;
    }

    .btn-active {
        background-color: var(--bg-page);
        color: var(--primary-color);
        border-color: var(--primary-color);
    }

    .filter-card {
        background-color: var(--bg-card);
        padding: 1.5rem;
        border-radius: 8px;
        margin-bottom: 1rem;
        border: 1px solid var(--border-color);
        animation: fadeIn 0.2s ease-out;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }

    .filter-row {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
        margin-bottom: 1rem;
    }

    .input-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        flex: 1;
        min-width: 200px;
    }

    .input-group label {
        font-size: 0.85rem;
        color: var(--text-secondary);
        font-weight: 500;
    }

    .input-group input,
    .input-group select {
        padding: 0.6rem;
        border: 1px solid var(--border-color);
        border-radius: 6px;
        background-color: var(--bg-input); /* Importante para o tema escuro */
        color: var(--text-primary);
        outline: none;
    }

    .input-group input:focus,
    .input-group select:focus {
        border-color: var(--primary-color);
    }

    .filter-footer {
        display: flex;
        justify-content: flex-end;
        gap: 1rem;
        border-top: 1px solid var(--border-color);
        padding-top: 1rem;
    }

    .btn-apply {
        background-color: var(--primary-color);
        color: #fff;
        border: none;
        padding: 0.6rem 1.2rem;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 500;
    }

    .btn-clean {
        background: transparent;
        border: none;
        color: var(--text-secondary);
        cursor: pointer;
    }
    .btn-clean:hover { text-decoration: underline; }

    .category-wrapper {
        display: flex;
        align-items: center;
        gap: 8px; /* Espaço entre bolinha e texto */
        font-weight: 500; /* Peso da fonte igual da imagem */
        color: var(--text-primary);
    }

    .category-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%; /* Faz virar bolinha */
        background-color: var(--primary-color); /* Ou coloque uma cor fixa ex: #3B82F6 */
        display: inline-block;
    }

    .value-cell {
        font-weight: 600;
        color: #10B981;
        font-feature-settings: "tnum";
        font-size: 0.95rem;
    }

    .actions-wrapper {
        display: flex;
        justify-content: center;
        gap: 8px;
    }

    .action-btn {
        background: transparent;
        border: 1px solid var(--border-color); /* Borda cinza suave */
        border-radius: 6px;
        width: 32px;  /* Tamanho fixo para ficar quadrado */
        height: 32px;
        cursor: pointer;
        color: #EF4444; /* Ícone vermelho */
        
        /* Centralizar o ícone */
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
    }

    .action-btn:hover {
        background-color: rgba(239, 68, 68, 0.1); /* Fundo vermelho suave */
        color: #EF4444; /* Vermelho erro */
    }

    .btn-secondary {
        display: flex;
        align-items: center;
        gap: 8px;
        justify-content: center;
        background-color: var(--bg-card);
        color: var(--text-secondary);
        border: 1px solid var(--border-color);
        padding: 0.8rem 1rem;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 500;
        transition: all 0.2s;
        height: 42px;
    }

    .btn-secondary:hover {
        background-color: var(--bg-page);
        color: var(--text-primary);
        border-color: var(--text-secondary);
    }


    .description-cell {
        font-weight: 500;
        color: var(--text-primary);
    }

    .text-right {
        text-align: right;
    }

    .text-center {
        text-align: center;
    }

    @media (max-width: 640px) {
        .badge {
            font-size: 0.75rem;
            padding: 2px 6px;
        }
    }
    
</style>