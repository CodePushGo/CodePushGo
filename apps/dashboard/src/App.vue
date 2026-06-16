<script setup lang="ts">
import { computed, ref } from 'vue'
import ConsoleView from './views/ConsoleView.vue'
import RegisterView from './views/RegisterView.vue'

const path = ref(window.location.pathname.replace(/\/+$/, '') || '/')
const isRegisterRoute = computed(() => path.value === '/register')
</script>

<template>
  <RegisterView v-if="isRegisterRoute" />
  <ConsoleView v-else />
</template>
