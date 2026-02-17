import { ref, watch, type Ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSwipe } from '@vueuse/core';

export function useTabsSwipe(tabs: string[], targetRef: Ref<HTMLElement | null>) {
    const route = useRoute();
    const router = useRouter();
    const currentTab = ref<string>(route.query.tab ? String(route.query.tab) : tabs[0] || '');

    watch(currentTab, (newTab) => {
        router.replace({ query: { ...route.query, tab: newTab } });
    });

    const moveTab = (direction: number) => {
        const currentIndex = tabs.indexOf(currentTab.value);
        const newIndex = currentIndex + direction;
        if (newIndex >= 0 && newIndex < tabs.length) {
            currentTab.value = tabs[newIndex] as string;
        }
    };

    useSwipe(targetRef, {
        onSwipeEnd(_e, direction) {
        if (direction === 'left') moveTab(1);
        if (direction === 'right') moveTab(-1);
        }
    });

    return { tabs, currentTab, moveTab };
}