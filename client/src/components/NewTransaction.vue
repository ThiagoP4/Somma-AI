<script setup lang="ts">    

    import { ref, onMounted, computed, type PropType } from 'vue';
    import { supabase } from '../services/supabase';
    import { PhPlus, PhWhatsappLogo } from '@phosphor-icons/vue';
    import FormLayout from '../layouts/FormLayout.vue';
    import { useAlertStore } from '../stores/useAlertStore';

    const { showAlert } = useAlertStore();

    const props = defineProps({
        transactionData: {
            type: Object as PropType<any>,
            default: null
        },
        type: {
            type: String as PropType<string>,
            default: 'compras'
        }
    });

    const description = ref('');
    const value = ref('');
    const categoryId = ref('');
    const date = ref(new Date().toISOString().split('T')[0]); // Data de hoje
    const categories = ref<any[]>([]);
    const loading = ref(false);

    const isInstallment = ref(false);
    const installmentNumber = ref('');

    const emit = defineEmits(['close', 'saved']);
    const isEditing = computed(() => !!props.transactionData);
    const isIncome = computed(() => props.type === 'entradas');

    onMounted(async () => {
        try {
            const { data, error } = await supabase
                .from('fin_category') // Confere se no banco está maiúsculo ou minúsculo
                .select('*');
            if (error) throw error;
            categories.value = data;
        } catch (error) {
            console.error('Erro ao carregar categorias:', error);
        }
        if(props.transactionData) {
            description.value = props.transactionData.title;
            value.value = props.transactionData.value;
            categoryId.value = props.transactionData.categoryId;
            date.value = props.transactionData.date.split('T')[0]; // Formata para YYYY-MM-DD
        }
    });

    const handleSubmit = async () => {
        if (!description.value || !value.value || !date.value) {
            showAlert('Por favor, preencha todos os campos obrigatórios.', 'warning');
            return;
        }

        if(!isIncome.value && !categoryId.value) {
            showAlert('Por favor, selecione uma Categoria.', 'warning');
            return;
        }

        const { data: { user } } = await supabase.auth.getUser();

        // Se por acaso o usuário não estiver logado, bloqueia a função
        if (!user) {
        console.error("Usuário não autenticado!");
        return;
        }

        loading.value = true;

        try {
            const payload = {
                title: description.value,
                value: parseFloat(value.value.toString()),
                categoryId: categoryId.value || null,
                date: date.value,
                user_id: user.id,
                total_installments: isInstallment.value ? Number(installmentNumber.value) : 1
            };
            
            const table = isIncome.value ? 'fin_income' : 'fin_purchase';
            const primaryKey = isIncome.value ? 'idIncome' : 'idPurchase';

            if(isEditing.value) {
                const { error } = await supabase
                    .from(table)
                    .update(payload)
                    .eq(primaryKey, props.transactionData[primaryKey]);
                if (error) throw error;
            } else {

                if(isIncome.value) {
                    const { error } = await supabase
                        .from('fin_income')
                        .insert(payload);
                    if (error) throw error;
                } else {
                const { data: returnData, error: purchaseError } = await supabase
                    .from('fin_purchase')
                    .insert(payload)
                    .select('idPurchase')
                    .single();
                if(purchaseError) throw purchaseError;

                const idCompraGerada = returnData.idPurchase;
                const totalValuesToDivide = payload.value;
                const installment = isInstallment.value;
                const installmentQtd = installment ? Number(installmentNumber.value) : 1;
                const valuePerInstallment = parseFloat((totalValuesToDivide / installmentQtd).toFixed(2));

                const installmentsData = [];

                let currentDateInstallment = new Date(payload.date);

                for(let i = 1; i <= installmentQtd; i++) {
                    installmentsData.push({
                        purchaseId: idCompraGerada,
                        installmentNumber: i,
                        value: valuePerInstallment,
                        dueDate: currentDateInstallment.toISOString(),
                        paid: i === 1 && !installment
                    });
                    currentDateInstallment.setMonth(currentDateInstallment.getMonth() + 1);
                }

                const { error: insError } = await supabase.from('fin_installment').insert(installmentsData);
                if(insError) throw insError;
                }
            }
        
            emit('saved');
            emit('close');
        } catch (error) {
            console.error('Erro ao adicionar compra:', error);
            showAlert('Ocorreu um erro ao adicionar a compra. Tente novamente.', 'error');
        } finally {
            loading.value = false; // <--- DESTRAVA O BOTÃO
        }
    };

</script>

<template>
    <FormLayout :title="isEditing ? (isIncome ? 'Editar Entrada' : 'Editar Compra') : (isIncome ? 'Nova Entrada' : 'Nova Compra')" :subtitle="isIncome ? 'Preencha os dados da receita' : 'Preencha os dados da despesa'" @close="$emit('close')">
        
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
                <label>Categoria <span class="required" v-if="!isIncome">*</span></label>
                <div class="select-wrapper">
                    <select v-model="categoryId" class="input-field">
                        <option value="" disabled selected>Selecione...</option>
                        <option v-for="cat in categories" :key="cat.idCategory" :value="cat.idCategory">
                            {{ cat.description }}
                        </option>
                    </select>
                </div>
            </div>

            <div class="installment-card" v-if="!isIncome">
                <div class="card-text">
                    <span class="card-title">Compra Parcelada?</span>
                    <span class="card-subtitle">Divide o valor em parcelas</span>
                </div>
                <label class="switch">
                    <input 
                        type="checkbox" 
                        v-model="isInstallment" 
                    />
                    <span class="slider"></span>
                </label>
            </div>

            <div class="installment-card" v-if="!isIncome && isInstallment"
            style="margin-top: 12px; flex-direction: column; align-items: flex-start;">
                <label  class="card-title mb-2">Quantidade de Parcelas</label>
                 <div class="select-wrapper w-100">
                    <select v-model.number="installmentNumber" class="input-field">
                        <option v-for="n in 23" :key="n" :value="n + 1">
                            {{ n + 1 }}x
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
                {{ isEditing ? 'Salvar Alterações' : (isIncome ? 'Adicionar Entrada' : 'Adicionar Compra') }}
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
        color: #B91C1C;
    }

    .divider {
        text-align: center;
        margin: 1.5rem 0;
        position: relative;
    }

    .installment-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem;
        background: var(--bg-card);
        border-radius: 12px;
        border: 1px solid var(--border-color);
        margin-bottom: 1rem;
    }

    .card-text {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .card-title {
        font-size: 0.9rem;
        font-weight: 600;
        color: var(--text-primary);
    }

    .card-subtitle {
        font-size: 0.875rem;
        color: var(--text-secondary);
    }
    
    .mb-2 {
        margin-bottom: 8px;
    }

    .w-100 {
        width: 100%;
    }

     .switch {
        position: relative;
        display: inline-block;
        width: 46px;   /* Largura total da pista */
        height: 24px;  /* Altura total da pista */
    }
    /* Esconde o checkbox HTML original */
    .switch input { 
        opacity: 0;
        width: 0;
        height: 0;
    }
    /* A pista (slider) */
    .slider {
        position: absolute;
        cursor: pointer;
        top: 0; left: 0; right: 0; bottom: 0;
        background-color: #5c5c5e; /* Cor de fundo do switch desligado */
        transition: .3s;
        border-radius: 24px; /* Bordas super arredondadas */
    }
    /* A bolinha do switch */
    .slider:before {
        position: absolute;
        content: "";
        height: 18px;
        width: 18px;
        left: 3px;
        bottom: 3px;
        background-color: #000000; /* Cor da bolinha quando desligada */
        transition: .3s;
        border-radius: 50%;
    }
    /* Estado: LIGADO (:checked) */
    .switch input:checked + .slider {
        background-color: #7C3AED; 
    }
    /* Muda a cor da bolinha quando liga e joga ela pra direita */
    .switch input:checked + .slider:before {
        background-color: #FFFFFF;
        transform: translateX(22px); 
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