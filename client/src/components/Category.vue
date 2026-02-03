<script setup lang = "ts">
    import { ref } from 'vue';
    import axios from 'axios'
    import { useRouter } from 'vue-router';
    import { PhArrowLeft, PhCheck, PhPlus } from '@phosphor-icons/vue';
    
    const router = useRouter();

    const category = ref('');
    const selectedColor = ref('#EF4444');

    const availableColors = [
        '#EF4444', // Vermelho
        '#F97316', // Laranja
        '#F59E0B', // Amarelo
        '#10B981', // Verde
        '#06B6D4', // Ciano
        '#3B82F6', // Azul
        '#6366F1', // Indigo
        '#8B5CF6', // Roxo
        '#EC4899', // Rosa
        '#64748B', // Cinza
    ];

    const goBack = () => {
        router.push('/');
    };

const handleSubmit = async () => {
    if (!category.value || !selectedColor.value) {
            alert('Por favor, preencha todos os campos obrigatórios.');
            return;
        }

        try {
            await axios.post('http://localhost:3000/new-category', {
                description: category.value,
                color: selectedColor.value
            });
            alert('Categoria adicionada com sucesso!');
        } catch (error) {
            console.error('Erro ao adicionar categoria:', error);
            alert('Ocorreu um erro ao adicionar a categoria. Tente novamente.');
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
                    <h2>Nova Categoria</h2>
                    <p class="subtitle">Adicione uma nova categoria para organizar seus gastos</p>
                </div>
            </div>

            <form @submit.prevent="handleSubmit">

                <div class="form-group">
                    <label>Nome da Categoria <span class="required">*</span></label>
                    <input 
                        type="text" 
                        v-model="category"
                        placeholder="Ex: Alimentação, Transporte..."
                        class="input-field" 
                    />
                </div>

                <div class="form-group">
                    <label>Cor da Etiqueta <span class="required">*</span></label>
                    <div class="colors-grid">
                        <div 
                            v-for="color in availableColors" 
                            :key="color" 
                            :style="{ backgroundColor: color }"
                            class="color-circle"
                            :class="{ selected: selectedColor === color }"
                            @click="selectedColor = color"
                            >
                            <PhCheck 
                                v-if="selectedColor === color" 
                                size="16" 
                                weight="bold" 
                                color="white"
                            />
                        </div>
                    </div>
                    <p class="color-preview">
                        Cor selecionada: <span :style="{ color: selectedColor, fontWeight: 'bold' }">{{ selectedColor }}</span>
                    </p>
                </div>
                <button type="submit" class="btn-primary">
                    <PhPlus size="20" weight="bold" />
                    Cadastrar Categoria
                </button>
            </form>
        </div>
    </div>
</template>

<style scoped>

    .page-container {
        display: flex;
        justify-content: center;
        background-color: #F8FAFC;
        padding: 2rem;
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
        background-color: #F8FAFC;
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

    .colors-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 8px;
    }

    .color-circle {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid transparent; /* Borda invisível para evitar pulo no layout */
    }

    .color-circle:hover {
        transform: scale(1.1);
    }

    /* Estado Selecionado */
    .color-circle.selected {
        border-color: #1E293B; /* Borda escura para indicar seleção */
        transform: scale(1.1);
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }

    .color-preview {
        font-size: 0.85rem;
        color: #64748B;
        margin-top: 8px;
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

</style>