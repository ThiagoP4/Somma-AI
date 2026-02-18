<script setup lang = "ts">
    import { ref, onMounted } from 'vue';
    import { supabase } from '../services/supabase';
    import { PhCheck, PhPlus, PhPencilSimple } from '@phosphor-icons/vue';
    import FormLayout from '../layouts/FormLayout.vue';
    import { useAlertStore } from '../stores/useAlertStore';

    const { showAlert } = useAlertStore();

    const props = defineProps<{ categoryData?: any }>();
    const emit = defineEmits(['close', 'saved']);

    const category = ref('');
    const selectedColor = ref('#B91C1C');

    const availableColors = [
        '#B91C1C', // Vermelho
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

    onMounted(() => {
        if (props.categoryData) {
            category.value = props.categoryData.description;
            selectedColor.value = props.categoryData.color;
        }
    });

    const handleSubmit = async () => {
        if (!category.value || !selectedColor.value) {
                showAlert('Por favor, preencha todos os campos obrigatórios.', 'warning');
                return;
            }

            try {
                if(props.categoryData?.idCategory) {
                    const { error } = await supabase
                    .from('Category')
                    .update({
                        description: category.value,
                        color: selectedColor.value
                    })
                    .eq('idCategory', props.categoryData.idCategory);
                    if (error) throw error;
                } else {
                    const { error } = await supabase
                    .from('Category')
                    .insert({
                        description: category.value,
                        color: selectedColor.value
                    });
                    if (error) throw error;
                }
                emit('saved');
                emit('close');
            } catch (error) {
                console.error('Erro ao adicionar categoria:', error);
                showAlert('Ocorreu um erro ao adicionar a categoria. Tente novamente.', 'error');
            }
    };

</script>
<template>
    <FormLayout 
        :title="props.categoryData ? 'Editar Categoria' : 'Nova Categoria'" 
        :subtitle="props.categoryData ? 'Atualize as informações da categoria.' : 'Preencha os campos para criar uma nova categoria.'" 
        @close="$emit('close')">
        
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
            <div class="form-actions">
                <button type="submit" class="btn-primary">
                    <PhPencilSimple v-if="props.categoryData" size="20" weight="bold" />
                    <PhPlus v-else size="20" weight="bold" /> 
                    {{ props.categoryData ? 'Atualizar Categoria' : 'Cadastrar Categoria' }}
                </button>
            </div>
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
        margin-top: 2rem;
    }

    .form-actions {
        display: flex;
        gap: 1rem;
        margin-top: 2rem;
    }

    .color-preview { 
        font-size: 0.85rem; 
        color: var(--text-secondary);
        margin-top: 8px; 
    }

    @media (max-width: 640px) {
    .btn-primary {
        margin-top: 1.5rem;
    }

    .form-group {
        margin-bottom: 1.5rem;
    }

    .color-circle {
        width: 36px;
        height: 36px;
    }
}

</style>