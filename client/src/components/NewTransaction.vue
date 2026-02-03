<script setup lang="ts">    

    import { ref, onMounted } from 'vue';
    import axios from 'axios'
    import { useRouter } from 'vue-router';
    import { PhArrowLeft, PhPlus, PhWhatsappLogo } from '@phosphor-icons/vue';

    const router = useRouter();

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

    const goBack = () => {
        router.push('/');
    };

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
    <div class="page-container">
        <div class="form-card">
            
            <div class="card-header">
                <button class="back-btn" @click="goBack" title="Voltar">
                    <PhArrowLeft size="24" weight="bold" />
                </button>
                <div class="header-text">
                    <h2>Nova Compra</h2>
                    <p class="subtitle">Preencha os dados da despesa</p>
                </div>
            </div>

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

                <button type="button" class="btn-whatsapp" @click="">
                    <PhWhatsappLogo size="20" weight="bold" />
                    Cadastrar via WhatsApp
                </button>

            </form>
        </div>
    </div>
</template>

<style scoped>

    .page-container {
        display: flex;
        justify-content: center;
        padding: 2rem;
        background-color:#F8FAFC;
        min-height: 100vh;
    }

    .form-card {
        background: white;
        width: 100%;
        max-width: 480px;
        padding: 2.5rem;
        border-radius: 16px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.05);
        border: 1px solid #F1F5F9;
    }

    .card-header {
        display: flex;
        align-items: flex-start;
        gap: 1rem;
        margin-bottom: 2rem;
    }

    .header-text h2 {
        margin: 0;
        font-size: 1.5rem;
        color: #1E293B;
        font-weight: 700;
    }

    .subtitle {
        margin: 4px 0 0 0;
        color: #64748B;
        font-size: 0.9rem;
    }

    .back-btn {
        background: transparent;
        border: 1px solid #E2E8F0;
        border-radius: 8px;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: #64748B;
        transition: all 0.2s;
    }

    .back-btn:hover {
        background-color: #F1F5F9;
        color: #1E293B;
        border-color: #CBD5E1;
    }

    .form-group {
        margin-bottom: 1.5rem;
    }

    .form-group label {
        display: block;
        margin-bottom: 0.5rem;
        font-size: 0.9rem;
        font-weight: 600;
        color: #475569;
    }

    .required {
        color: #EF4444;
    }

    .input-field {
        width: 100%;
        padding: 0.75rem 1rem;
        border: 1px solid #E2E8F0;
        border-radius: 8px;
        font-size: 1rem;
        color: #1E293B;
        background-color: #F8FAFC; /* Fundo levemente cinza no input */
        transition: all 0.2s;
        outline: none;
    }

    .input-field:focus {
        background-color: white;
        border-color: #6366F1; /* Roxo foco */
        box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
    }

    .input-field::placeholder {
        color: #94A3B8;
    }

    .btn-primary {
        width: 100%;
        padding: 0.9rem;
        background: linear-gradient(135deg, #6366F1 0%, #4F46E5 100%);
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 8px;
        margin-top: 1rem;
        transition: transform 0.1s, box-shadow 0.2s;
    }

    .btn-primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);
    }

    /* Divisória "ou" */
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
        background: #E2E8F0;
        z-index: 0;
    }

    .divider span {
        background: white;
        padding: 0 10px;
        color: #94A3B8;
        font-size: 0.85rem;
        position: relative;
        z-index: 1;
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

</style>