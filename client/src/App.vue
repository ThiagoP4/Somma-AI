<script setup lang="ts">
import DefaultLayout from './layouts/DefaultLayout.vue'
import CustomAlert from './components/CustomAlert.vue';
import { RouterView } from 'vue-router'; 
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