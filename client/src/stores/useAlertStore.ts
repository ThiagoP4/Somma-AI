import { defineStore } from "pinia";
import { ref } from "vue";

export type AlertType = 'success' | 'error' | 'warning';

export const useAlertStore = defineStore('alert', () => {
    const isOpen = ref(false);
    const message = ref('');
    const type = ref<AlertType>('success');
    let timeoutId: ReturnType<typeof setTimeout>;

    const showAlert = (msg: string, alertType: AlertType = 'success') => {
        message.value = msg;
        type.value = alertType;
        isOpen.value = true;

        if(timeoutId) clearTimeout(timeoutId);

        timeoutId = setTimeout(() => {
            isOpen.value = false;
        }, 3000);
    };

    const closeAlert = () => {
        isOpen.value = false;
    };

    return {
        isOpen,
        message,
        type,
        showAlert,
        closeAlert
    };
});