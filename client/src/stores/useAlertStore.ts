import { defineStore } from "pinia";
import { ref } from "vue";

export type AlertType = 'success' | 'error' | 'warning' | 'info';

export const useAlertStore = defineStore('alert', () => {
    const isOpen = ref(false);
    const message = ref('');
    const type = ref<AlertType>('success');
    const alertKey = ref(0);
    const durationMs = ref(4000);
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const showAlert = (msg: string, alertType: AlertType = 'success', duration = 4000) => {
        message.value = msg;
        type.value = alertType;
        durationMs.value = duration;
        alertKey.value += 1;
        isOpen.value = true;

        if (timeoutId) clearTimeout(timeoutId);

        timeoutId = setTimeout(() => {
            isOpen.value = false;
        }, duration);
    };

    const closeAlert = () => {
        if (timeoutId) clearTimeout(timeoutId);
        isOpen.value = false;
    };

    return {
        isOpen,
        message,
        type,
        alertKey,
        durationMs,
        showAlert,
        closeAlert
    };
});
