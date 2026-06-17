<script setup lang="ts">
import { computed, ref } from 'vue'
import ConsoleView from './views/ConsoleView.vue'
import ForgotPasswordView from './views/ForgotPasswordView.vue'
import LoginView from './views/LoginView.vue'
import RegisterView from './views/RegisterView.vue'
import { resolveDashboardRoute } from './route'

const path = ref(window.location.pathname)
const route = computed(() => resolveDashboardRoute(path.value))
</script>

<template>
  <RegisterView v-if="route === 'register'" />
  <LoginView v-else-if="route === 'login'" />
  <ForgotPasswordView v-else-if="route === 'forgot-password'" />
  <ConsoleView v-else />
</template>
