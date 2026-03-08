<script setup lang = "ts">
    import { ref, onMounted, computed } from 'vue';
    import { supabase } from '../services/supabase';
    import { PhCheck, PhPlus, PhPencilSimple } from '@phosphor-icons/vue';
    import FormLayout from '../layouts/FormLayout.vue';
    import { useAlertStore } from '../stores/useAlertStore';

    const { showAlert } = useAlertStore();

    const props = defineProps<{ categoryData?: any }>();
    const emit = defineEmits(['close', 'saved']);

    const category = ref('');
    const selectedColor = ref('#B91C1C');
    const colorInputRef = ref<HTMLInputElement | null>(null);
    const openColorPicker = () => {
        colorInputRef.value?.click();
    };

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

    const isCustomColor = computed(() => {
        return !availableColors.some(color => color.toLowerCase() === selectedColor.value.toLowerCase());
    });

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

         const { data: { user } } = await supabase.auth.getUser();

        // Se por acaso o usuário não estiver logado, bloqueia a função
        if (!user) {
            console.error("Usuário não autenticado!");
            return;
        }


            try {
                if(props.categoryData?.idCategory) {
                    const { error } = await supabase
                    .from('fin_category')
                    .update({
                        description: category.value,
                        color: selectedColor.value,
                        user_id: user.id
                    })
                    .eq('idCategory', props.categoryData.idCategory);
                    if (error) throw error;
                } else {
                    const { error } = await supabase
                    .from('fin_category')
                    .insert({
                        description: category.value,
                        color: selectedColor.value,
                        user_id: user.id
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
                        <div class="color-circle custom-picker-wrapper"
                            :class="{ selected: isCustomColor }"
                            :style="isCustomColor ? 
                            { background: selectedColor } : {}"
                            @click="openColorPicker"
                        >
                            <PhCheck v-if="isCustomColor" size="16" weight="bold" color="white" class="overlay-icon" />
         
                            <input type="color" ref="colorInputRef" v-model="selectedColor" class="hidden-color-input" />
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
    .color-circle { width: 30px; height: 30px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: transform 0.2s; }
    .color-circle:hover { transform: scale(1.1); }
    .color-circle.selected { border-color: var(--text-primary); transform: scale(1.1); }

    .custom-picker-wrapper {
        position: relative;
        overflow: hidden;
        border-radius: 50%; /* <- garante que o input não vaze pelos cantos */
        background: conic-gradient(
            from 90deg,
            hsl(0, 100%, 50%),
            hsl(60, 100%, 50%),
            hsl(120, 100%, 50%),
            hsl(180, 100%, 50%),
            hsl(240, 100%, 50%),
            hsl(300, 100%, 50%),
            hsl(360, 100%, 50%)
        );
    }

    .hidden-color-input {
        position: absolute;
        width: 0;
        height: 0;
        opacity: 0;
        pointer-events: none;
        border: none;
        padding: 0;
    }

    .overlay-icon { 
        position: absolute; 
        z-index: 1; 
        pointer-events: none; }

    .palette-icon { filter: drop-shadow(0px 1px 2px rgba(0,0,0,0.6)); }
    
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