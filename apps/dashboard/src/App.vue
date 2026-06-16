<script setup lang="ts">
import { computed, ref } from 'vue'
import ConsoleView from './views/ConsoleView.vue'
import LoginView from './views/LoginView.vue'
import RegisterView from './views/RegisterView.vue'

const path = ref(window.location.pathname.replace(/\/+$/, '') || '/')
const route = computed(() => {
  if (path.value === '/register')
    return 'register'
  if (path.value === '/login')
    return 'login'
  return 'console'
})
</script>

<template>
  <RegisterView v-if="route === 'register'" />
  <LoginView v-else-if="route === 'login'" />
  <ConsoleView v-else />
</template>
