import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useFilterStore = defineStore('filter', () => {

    const currentDate = new Date();
    const selectedMonth = ref(currentDate.getMonth());
    const selectedYear = ref(currentDate.getFullYear());
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const filterMode = ref<'month' | 'invoice'>('month');
    const selectedCardIds = ref<number[]>([]);

    const setFilterMode = (mode: 'month' | 'invoice') => {
        filterMode.value = mode;
    };

    const toggleCardSelection = (cardId: number) => {
        const index = selectedCardIds.value.indexOf(cardId);
        if (index > -1) {
            selectedCardIds.value.splice(index, 1)
        } else {
            selectedCardIds.value.push(cardId);
        }
    }

    const selectMonth = (index: number) => {
        selectedMonth.value = index;
    };

    const nextYear = () => {
        selectedYear.value++;
    };

    const previousYear = () => {
        selectedYear.value--;
    };

    const nextMonth = () => {
        if (selectedMonth.value >= 11) {
            selectedMonth.value = 0;
            selectedYear.value++;
        } else {
            selectedMonth.value++;
        }
    };

    const previousMonth = () => {
        if (selectedMonth.value <= 0) {
            selectedMonth.value = 11;
            selectedYear.value--;
        } else {
            selectedMonth.value--;
        }
    };

    const goToCurrentMonth = () => {
        const now = new Date();
        selectedMonth.value = now.getMonth();
        selectedYear.value = now.getFullYear();
    };

    return {
        selectedMonth,
        selectedYear,
        monthNames,
        filterMode,
        selectedCardIds,
        setFilterMode,
        selectMonth,
        nextYear,
        previousYear,
        nextMonth,
        previousMonth,
        goToCurrentMonth,
        toggleCardSelection
    };
})