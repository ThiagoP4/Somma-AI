<script setup lang="ts">
import DefaultLayout from './layouts/DefaultLayout.vue'
import CustomAlert from './components/CustomAlert.vue';
import { RouterView, useRouter } from 'vue-router'; 
import { onMounted } from 'vue';
import { supabase } from './services/supabase';

const router = useRouter();

onMounted(() => {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' && !session) {
      router.push('/login');
    }
  })
})

</script>

<template>
  <DefaultLayout>
    <RouterView />
  </DefaultLayout>
  <CustomAlert />
</template>

<style>
/* 3. Reset Global: Isso remove as bordas brancas padrão do navegador */
body {
  margin: 0;
  padding: 0;
  -webkit-font-smoothing: antialiased;
}
</style>