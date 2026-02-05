<script setup lang = "ts">
    import { ref } from 'vue';
    import axios from 'axios'
    import { PhCheck, PhPlus } from '@phosphor-icons/vue';
    import FormLayout from '../layouts/FormLayout.vue';

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
    <FormLayout title="Nova Categoria" subtitle="Adicione uma nova categoria para organizar seus gastos">
        
        <form @submit.prevent="handleSubmit" class="category-form">
            <div class="form-body-grid">
                
                <div class="form-group">
                    <label>Nome da Categoria <span class="required">*</span></label>
                    <input type="text" v-model="category" class="input-field" placeholder="Ex: Alimentação..." />
                </div>

                <div class="form-group">
                    <label>Cor da Etiqueta <span class="required">*</span></label>
                    <div class="colors-grid">
                        <div v-for="color in availableColors" :key="color" 
                             :style="{ backgroundColor: color }" class="color-circle"
                             :class="{ selected: selectedColor === color }"
                             @click="selectedColor = color">
                            <PhCheck v-if="selectedColor === color" size="16" weight="bold" color="white" />
                        </div>
                    </div>
                    <p class="color-preview">
                        Cor selecionada: <span :style="{ color: selectedColor, fontWeight: 'bold' }">{{ selectedColor }}</span>
                    </p>
                </div>

            </div>

            <button type="submit" class="btn-primary">
                <PhPlus size="20" weight="bold" /> Cadastrar Categoria
            </button>
        </form>

    </FormLayout>
</template>
<style scoped>
    /* Estilos Específicos desta tela */
    .colors-grid { display: flex; flex-wrap: wrap; gap: 12px; }
    .color-circle { width: 30px; height: 30px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; border: 2px solid transparent; transition: transform 0.2s; }
    .color-circle:hover { transform: scale(1.1); }
    .color-circle.selected { border-color: var(--text-primary); transform: scale(1.1); }

    .form-group {
    margin-bottom: 2.5rem; 
    }

    .btn-primary {
        margin-top: 10rem;
    }

    .color-preview { 
        font-size: 0.85rem; 
        color: var(--text-secondary);
        margin-top: 8px; 
    }

</style>