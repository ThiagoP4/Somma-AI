import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useDateStore = defineStore('date', () => {
    const currentDate = new Date();
    const selectedMonth = ref(currentDate.getMonth());
    const selectedYear = ref(currentDate.getFullYear());
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const selectMonth = (index: number) => {
        selectedMonth.value = index;
    };

    const nextYear = () => {
        selectedYear.value++;
    };

    const previousYear = () => {
        selectedYear.value--;
    };
    
    return {
        selectedMonth,
        selectedYear,
        monthNames,
        selectMonth,
        nextYear,
        previousYear
    };
});