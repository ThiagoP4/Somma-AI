<script setup lang="ts">    

    import { ref, onMounted } from 'vue';
    import axios from 'axios'
    import { PhPlus, PhWhatsappLogo } from '@phosphor-icons/vue';
    import FormLayout from '../layouts/FormLayout.vue';

    const description = ref('');
    const value = ref('');
    const categoryId = ref('');
    const date = ref(new Date().toISOString().split('T')[0]); // Data de hoje
    const categories = ref<any[]>([]);

    onMounted(async () => {
        try {
            const response = await axios.get('http://localhost:3000/categories');
            categories.value = response.data;
        } catch (error) {
            console.error('Erro ao carregar categorias:', error);
        }
    });

    const handleSubmit = async () => {
        if (!description.value || !value.value || !categoryId.value || !date.value) {
            alert('Por favor, preencha todos os campos obrigatórios.');
            return;
        }

        try {
            await axios.post('http://localhost:3000/purchase', {
                description: description.value,
                value: parseFloat(value.value),
                categoryId: categoryId.value,
                date: date.value
            });
            alert('Compra adicionada com sucesso!');
        } catch (error) {
            console.error('Erro ao adicionar compra:', error);
            alert('Ocorreu um erro ao adicionar a compra. Tente novamente.');
        }
    };

</script>

<template>
    <FormLayout title="Nova Compra" subtitle="Preencha os dados da despesa">
        
        <form @submit.prevent="handleSubmit">

            <div class="form-group">
                <label>Descrição <span class="required">*</span></label>
                <input 
                    type="text" 
                    v-model="description"
                    placeholder="Ex: Supermercado, Uber..."
                    class="input-field" 
                />
            </div>

            <div class="form-group">
                <label>Valor (R$) <span class="required">*</span></label>
                <input 
                    type="number" 
                    v-model.number="value"
                    step="0.01"
                    placeholder="0.00"
                    class="input-field" 
                />
            </div>

            <div class="form-group">
                <label>Categoria <span class="required">*</span></label>
                <div class="select-wrapper">
                    <select v-model="categoryId" class="input-field">
                        <option value="" disabled selected>Selecione...</option>
                        <option v-for="cat in categories" :key="cat.idCategory" :value="cat.idCategory">
                            {{ cat.description }}
                        </option>
                    </select>
                </div>
            </div>

            <div class="form-group">
                <label>Data <span class="required">*</span></label>
                <input 
                    type="date" 
                    v-model="date"
                    class="input-field" 
                />
            </div>  

            <button type="submit" class="btn-primary">
                <PhPlus size="20" weight="bold" />
                Adicionar Compra
            </button>

            <div class="divider">
                <span>ou</span>
            </div>

            <button type="button" class="btn-whatsapp">
                <PhWhatsappLogo size="20" weight="bold" />
                Cadastrar via WhatsApp
            </button>

        </form>

    </FormLayout>
</template>

<style scoped>
    .required {
        color: #EF4444;
    }

    .divider {
        text-align: center;
        margin: 1.5rem 0;
        position: relative;
    }

    .divider::before {
        content: "";
        position: absolute;
        top: 50%;
        left: 0;
        right: 0;
        height: 1px;
        background: var(--border-color); /* Variável de borda */
        z-index: 0;
    }

    .divider span {
        background: var(--bg-card); /* Fundo do card (branco ou dark) para não cortar a linha */
        padding: 0 10px;
        color: var(--text-secondary); /* Texto secundário */
        font-size: 0.85rem;
        position: relative;
        z-index: 1;
    }

    .btn-primary {
        margin-top: 1.5rem;
    }

    /* Botão WhatsApp */
    .btn-whatsapp {
        width: 100%;
        padding: 0.9rem;
        background-color: #ECFDF5;
        color: #059669;
        border: 1px solid #10B981;
        border-radius: 8px;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 8px;
        transition: background 0.2s;
    }

    .btn-whatsapp:hover {
        background-color: #D1FAE5;
    }

    /* Ajuste para não ficar um bloco branco cegante no Dark Mode */
    /* Se o corpo tiver a classe .dark (via css global), podemos ajustar aqui */
    :global(.dark) .btn-whatsapp {
        background-color: transparent;
        color: #34D399;
        border-color: #059669;
    }
    :global(.dark) .btn-whatsapp:hover {
        background-color: rgba(16, 185, 129, 0.1);
    }

    @media (max-width: 640px) {
        /* Reduz espaço do botão principal */
        .btn-primary {
            margin-top: 1rem;
        }

        /* Reduz o espaço do "ou" */
        .divider {
            margin: 1rem 0;
        }
        
        /* Botão do WhatsApp mais compacto */
        .btn-whatsapp {
            padding: 0.75rem;
            font-size: 0.95rem;
        }
    }

</style>