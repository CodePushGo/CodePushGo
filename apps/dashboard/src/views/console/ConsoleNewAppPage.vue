<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowRight, Copy, Loader2, PackagePlus } from 'lucide-vue-next'
import { createAppOnboarding, createDashboardClient } from '../../services/registration'
import { useConsoleStore } from '../../stores/console'
import { useOrganizationStore } from '../../stores/organization'

const client = createDashboardClient()
const consoleStore = useConsoleStore()
const organizationStore = useOrganizationStore()
const appName = ref('')
const appId = ref('')
const pending = ref(false)
const error = ref('')
const notice = ref('')

const ownerOrg = computed(() => organizationStore.currentOrganization?.gid || organizationStore.currentOrganization?.id || '')
const initCommand = computed(() => 'npx @codepushgo/cli@latest init')
const normalizedAppId = computed(() => appId.value.trim())
const normalizedName = computed(() => appName.value.trim() || normalizedAppId.value)

onMounted(() => {
  void organizationStore.dedupFetchOrganizations()
})

function appHref(appIdValue: string) {
  return `/app/${encodeURIComponent(appIdValue)}`
}

async function submit() {
  error.value = ''
  notice.value = ''
  if (!client) {
    error.value = 'Supabase public config is missing.'
    return
  }
  if (!ownerOrg.value) {
    error.value = 'Create or select an organization before adding an app.'
    return
  }
  if (!normalizedAppId.value) {
    error.value = 'Native bundle ID is required.'
    return
  }
  if (!/^[A-Za-z0-9_-]+([.][A-Za-z0-9_-]+)+$/.test(normalizedAppId.value)) {
    error.value = 'Native bundle ID is invalid.'
    return
  }

  pending.value = true
  try {
    const app = await createAppOnboarding(client, {
      appId: normalizedAppId.value,
      name: normalizedName.value,
      ownerOrg: ownerOrg.value,
    })
    notice.value = 'App created.'
    await consoleStore.refresh()
    window.location.assign(appHref(app.app_id))
  }
  catch (submitError) {
    error.value = submitError instanceof Error ? submitError.message : String(submitError)
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <section class="dashboard-content console-table-card">
    <header>
      <div>
        <p class="eyebrow">New app</p>
        <h2>Connect a React Native bundle ID</h2>
      </div>
      <PackagePlus :size="18" />
    </header>

    <form class="dashboard-home-grid compact-content" @submit.prevent="submit">
      <article class="quickstart-card">
        <p class="eyebrow">Native identity</p>
        <label>
          App name
          <input v-model="appName" type="text" autocomplete="off" placeholder="Acme Mobile">
        </label>
        <label>
          Native bundle ID
          <input v-model="appId" type="text" autocomplete="off" placeholder="com.acme.mobile" required>
        </label>
        <button class="primary" type="submit" :disabled="pending">
          <Loader2 v-if="pending" :size="16" class="spin" />
          <ArrowRight v-else :size="16" />
          Create app
        </button>
        <p v-if="error" class="form-alert error">{{ error }}</p>
        <p v-if="notice" class="form-alert success">{{ notice }}</p>
      </article>

      <article class="quickstart-card">
        <p class="eyebrow">CLI path</p>
        <h2>Auto-detect by default</h2>
        <button class="command" type="button" @click="consoleStore.copyCommand(initCommand)">
          <code>{{ initCommand }}</code>
          <Copy :size="16" />
        </button>
        <p>Run this inside the React Native project to detect ios.bundleIdentifier or android.applicationId.</p>
      </article>
    </form>
  </section>
</template>
