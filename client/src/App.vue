<script setup lang="ts">
import DefaultLayout from './layouts/DefaultLayout.vue'
import CustomAlert from './components/CustomAlert.vue';
import BiometricLockScreen from './components/BiometricLockScreen.vue';
import UpdateBanner from './components/UpdateBanner.vue';
import { RouterView, useRouter, useRoute } from 'vue-router'; 
import { ref, onMounted } from 'vue';
import { supabase } from './services/supabase';
import {
  isAppLockEnabled,
  isSessionBiometricUnlocked,
  syncBiometricSessionToken,
  clearSessionBiometricUnlocked
} from './services/biometricAuth';

const router = useRouter();
const route = useRoute();
const isBiometricLocked = ref(false);

onMounted(async () => {
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) {
    syncBiometricSessionToken(data.session.user.id, data.session.refresh_token);
    if (isAppLockEnabled() && !isSessionBiometricUnlocked() && route.path !== '/login') {
      isBiometricLocked.value = true;
    }
  }

  supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user && session.refresh_token) {
      syncBiometricSessionToken(session.user.id, session.refresh_token);
    }
    if (event === 'SIGNED_OUT' && !session) {
      clearSessionBiometricUnlocked();
      isBiometricLocked.value = false;
      router.push('/login');
    }
  });
});

</script>

<template>
  <BiometricLockScreen v-if="isBiometricLocked" @unlocked="isBiometricLocked = false" />
  <DefaultLayout>
    <RouterView />
  </DefaultLayout>
  <UpdateBanner />
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