<script setup lang="ts">
import { Copy, ShieldCheck } from 'lucide-vue-next'
import { useConsoleStore } from '../../stores/console'

const { copyCommand } = useConsoleStore()
</script>

<template>
  <section class="dashboard-home-grid dashboard-content compact-content">
    <article class="quickstart-card">
      <p class="eyebrow">CLI authentication</p>
      <h2>Create an organization API key</h2>
      <p>Admin endpoints require <code>Authorization: Bearer &lt;CODEPUSHGO_API_KEY&gt;</code>. Use the key with the CLI for bundle uploads and release operations.</p>
      <button class="command" type="button" @click="copyCommand('npx @codepushgo/cli@latest login')">
        <code>npx @codepushgo/cli@latest login</code>
        <Copy :size="16" />
      </button>
    </article>
    <article class="quickstart-card muted-card">
      <ShieldCheck :size="24" />
      <h2>Supabase auth, Worker API</h2>
      <p>User sessions stay in Supabase Auth. Runtime update traffic goes to the Cloudflare Worker, not Supabase Edge Functions.</p>
    </article>
  </section>
</template>
