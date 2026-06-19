<script setup lang="ts">
import { Hammer, Info } from 'lucide-vue-next'
</script>

<template>
  <section class="capgo-page-section two-column-layout">
    <div class="console-table-card">
      <header>
        <div>
          <p class="eyebrow">Native builds</p>
          <h2>Builds</h2>
        </div>
        <span>Removed for React Native MVP</span>
      </header>
      <div class="empty-state">
        <Hammer :size="24" />
        <p>Capgo keeps native build workflows here. CodePushGo keeps the route and tab for console parity, but native build execution is intentionally out of scope for this React Native updater.</p>
      </div>
    </div>

    <aside class="quickstart-card muted-card">
      <Info :size="22" />
      <h2>Use bundle releases instead</h2>
      <p>Upload JavaScript bundles from the CLI, then promote through channels and rollout controls from the Bundles tab.</p>
      <pre><code>npx @codepushgo/cli@latest upload</code></pre>
    </aside>
  </section>
</template>
