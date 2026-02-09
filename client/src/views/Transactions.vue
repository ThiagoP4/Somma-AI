<script setup lang="ts">
    import { ref, onMounted } from 'vue';
    import { useRouter } from 'vue-router';
    import { supabase } from '../services/supabase';
    import { PhTrash } from '@phosphor-icons/vue';
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
            @addNew="router.push('/new-transaction')"
        >
    <template #header>
        <tr>
            <th width="40%">Descrição</th>
            <th width="20%">Categoria</th>
            <th width="15%" class="text-right">Valor</th>
            <th width="15%" class="text-center">Data</th>
            <th width="10%" class="text-center">Ações</th>
        </tr>
    </template>

    <template #body>
        <tr v-for="item in transactions" :key="item.idPurchase" class="hover-row">
            <td> 
                <span class="row-title">
                    {{ item.title }}
                </span>
            </td>
            <td>
                <div class="category-wrapper">
                   <span class="category-dot"
                   :style="{ backgroundColor: item.Category?.color || 'var(--text-muted)' }">
                </span>{{ item.Category?.description }}
                </div>
                </td>
            <td class="text-right value-cell">{{ toBRL(item.value) }}</td>
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