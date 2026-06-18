<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { AlertTriangle, ArrowRight } from 'lucide-vue-next'
import { countUnresolvedCompatibilityGroups } from '../../services/compatibilityEvents'
import { createDashboardClient } from '../../services/registration'

const props = defineProps<{
  appId: string
}>()

const client = createDashboardClient()
const unresolvedCount = ref(0)

async function refreshUnresolvedCount() {
  if (!client || !props.appId) {
    unresolvedCount.value = 0
    return
  }

  try {
    unresolvedCount.value = await countUnresolvedCompatibilityGroups(client, props.appId)
  }
  catch {
    unresolvedCount.value = 0
  }
}

onMounted(refreshUnresolvedCount)
watch(() => props.appId, refreshUnresolvedCount)
</script>

<template>
  <section v-if="unresolvedCount > 0" class="console-table-card compatibility-banner" data-test="compatibility-banner">
    <div>
      <AlertTriangle :size="18" />
      <div>
        <p class="eyebrow">Compatibility</p>
        <h2>{{ unresolvedCount }} unresolved native compatibility {{ unresolvedCount === 1 ? 'event' : 'events' }}</h2>
        <p>Review bundle changes that may require a matching native release before more devices receive them.</p>
      </div>
    </div>
    <RouterLink class="primary" :to="`/app/${encodeURIComponent(appId)}/compatibility`">
      View details
      <ArrowRight :size="16" />
    </RouterLink>
  </section>
</template>
