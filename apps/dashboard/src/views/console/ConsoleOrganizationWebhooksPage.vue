<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { CheckCircle2, ChevronDown, Clipboard, FlaskConical, Pencil, Plus, RefreshCw, Trash2, XCircle } from 'lucide-vue-next'
import {
  createWebhook,
  deleteWebhook as deleteWorkerWebhook,
  fetchWebhookDeliveries,
  listWebhooks,
  retryWebhookDelivery,
  testWebhook as testWorkerWebhook,
  updateWebhook,
  validateWebhookUrl,
  WEBHOOK_EVENT_TYPES,
  type Webhook,
  type WebhookDelivery,
  type WebhookDeliveryStatus,
  type WebhookDeliveryVersion,
} from '../../services/webhooks'
import { getRegistrationConfig } from '../../services/registration'
import { useConsoleStore } from '../../stores/console'
import { useOrganizationStore } from '../../stores/organization'

const config = getRegistrationConfig()
const consoleStore = useConsoleStore()
const organizationStore = useOrganizationStore()
const webhooks = ref<Webhook[]>([])
const deliveries = ref<WebhookDelivery[]>([])
const loading = ref(false)
const deliveryLoading = ref(false)
const pending = ref(false)
const testingWebhookId = ref('')
const expandedWebhookId = ref('')
const editingWebhook = ref<Webhook | null>(null)
const selectedWebhookForLog = ref<Webhook | null>(null)
const error = ref('')
const notice = ref('')
const apiKey = ref('')
const form = ref({
  name: '',
  url: '',
  events: ['apps', 'app_versions'],
  enabled: true,
  deliveryVersion: 'legacy' as WebhookDeliveryVersion,
})

const orgId = computed(() => organizationStore.currentOrganization?.gid || organizationStore.currentOrganization?.id || consoleStore.selectedApp.value?.owner_org || '')
const canManageWebhooks = computed(() => Boolean(apiKey.value.trim() && orgId.value))
const urlError = computed(() => form.value.url ? validateWebhookUrl(form.value.url) : '')
const isFormValid = computed(() => Boolean(form.value.name.trim() && form.value.url.trim() && form.value.events.length > 0 && !urlError.value && canManageWebhooks.value))

const signatureVerificationCode = `import crypto from 'node:crypto'

export function verifyWebhookSignature(rawBody, headers, secret) {
  const signature = headers['x-codepushgo-signature'] ?? headers['X-CodePushGo-Signature']
  const match = signature?.match(/^v1=(\\d+)\\.([a-f0-9]{64})$/i)
  if (!match)
    throw new Error('Invalid webhook signature format')

  const [, timestamp, receivedHmac] = match
  const expectedHmac = crypto
    .createHmac('sha256', secret)
    .update(timestamp + '.' + rawBody)
    .digest('hex')

  return crypto.timingSafeEqual(Buffer.from(receivedHmac), Buffer.from(expectedHmac))
}`

function requestOptions() {
  return { apiUrl: config.apiUrl, apiKey: apiKey.value.trim(), orgId: orgId.value }
}

function eventLabel(eventValue: string) {
  return WEBHOOK_EVENT_TYPES.find(event => event.value === eventValue)?.label || eventValue
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : '-'
}

function deliveryVersion(webhook: Webhook) {
  return webhook.delivery_version || webhook.deliveryVersion || 'legacy'
}

function createdAt(webhook: Webhook) {
  return webhook.created_at || webhook.createdAt || null
}

function updatedAt(webhook: Webhook) {
  return webhook.updated_at || webhook.updatedAt || null
}

function deliveryStatus(delivery: WebhookDelivery) {
  return delivery.status || 'pending'
}

function deliveryStatusClass(delivery: WebhookDelivery) {
  const status = deliveryStatus(delivery)
  if (status === 'success')
    return 'success'
  if (status === 'failed')
    return 'error'
  return 'warning'
}

function deliveryResponseStatus(delivery: WebhookDelivery) {
  return delivery.response_status ?? delivery.responseStatus ?? '-'
}

function deliveryDuration(delivery: WebhookDelivery) {
  const duration = delivery.duration_ms ?? delivery.durationMs
  if (duration === null || duration === undefined)
    return '-'
  return duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(2)}s`
}

function deliveryCreatedAt(delivery: WebhookDelivery) {
  return delivery.created_at || delivery.createdAt || null
}

function resetForm(webhook: Webhook | null = null) {
  editingWebhook.value = webhook
  form.value = webhook
    ? {
        name: webhook.name,
        url: webhook.url,
        events: [...webhook.events],
        enabled: webhook.enabled,
        deliveryVersion: deliveryVersion(webhook),
      }
    : {
        name: '',
        url: '',
        events: ['apps', 'app_versions'],
        enabled: true,
        deliveryVersion: 'legacy',
      }
}

function toggleEvent(eventValue: string) {
  const index = form.value.events.indexOf(eventValue)
  if (index === -1)
    form.value.events.push(eventValue)
  else
    form.value.events.splice(index, 1)
}

function saveApiKey() {
  if (typeof window !== 'undefined')
    window.localStorage.setItem('codepushgo:console-api-key', apiKey.value.trim())
  notice.value = 'API key saved for this browser.'
}

async function copySecret(secret: string) {
  await navigator.clipboard.writeText(secret)
  notice.value = 'Signing secret copied.'
}

async function refreshWebhooks() {
  error.value = ''
  notice.value = ''
  if (!orgId.value) {
    error.value = 'No organization selected.'
    return
  }
  if (!apiKey.value.trim()) {
    error.value = 'Paste an organization API key to manage webhooks.'
    return
  }

  loading.value = true
  try {
    webhooks.value = await listWebhooks(requestOptions())
  }
  catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : String(loadError)
    webhooks.value = []
  }
  finally {
    loading.value = false
  }
}

async function submitWebhook() {
  if (!isFormValid.value)
    return
  pending.value = true
  error.value = ''
  notice.value = ''
  const input = {
    name: form.value.name.trim(),
    url: form.value.url.trim(),
    events: form.value.events,
    enabled: form.value.enabled,
    deliveryVersion: form.value.deliveryVersion,
  }
  const wasEditing = Boolean(editingWebhook.value)
  const result = editingWebhook.value
    ? await updateWebhook(requestOptions(), editingWebhook.value.id, input)
    : await createWebhook(requestOptions(), input)
  pending.value = false

  if (!result.success) {
    error.value = result.error || 'Webhook operation failed.'
    return
  }
  resetForm(null)
  notice.value = wasEditing ? 'Webhook updated.' : 'Webhook created.'
  await refreshWebhooks()
}

async function toggleWebhook(webhook: Webhook) {
  pending.value = true
  const result = await updateWebhook(requestOptions(), webhook.id, { enabled: !webhook.enabled })
  pending.value = false
  if (!result.success) {
    error.value = result.error || 'Webhook update failed.'
    return
  }
  await refreshWebhooks()
}

async function deleteWebhook(webhook: Webhook) {
  if (!window.confirm(`Delete webhook ${webhook.name}?`))
    return
  const result = await deleteWorkerWebhook(requestOptions(), webhook.id)
  if (!result.success) {
    error.value = result.error || 'Webhook delete failed.'
    return
  }
  notice.value = 'Webhook deleted.'
  await refreshWebhooks()
}

async function testWebhook(webhook: Webhook) {
  testingWebhookId.value = webhook.id
  error.value = ''
  try {
    const result = await testWorkerWebhook(requestOptions(), webhook.id)
    notice.value = result.message || 'Test webhook delivered.'
  }
  catch (testError) {
    error.value = testError instanceof Error ? testError.message : String(testError)
  }
  finally {
    testingWebhookId.value = ''
  }
}

async function openDeliveryLog(webhook: Webhook) {
  selectedWebhookForLog.value = webhook
  deliveries.value = []
  deliveryLoading.value = true
  try {
    const result = await fetchWebhookDeliveries(requestOptions(), webhook.id)
    deliveries.value = result.deliveries
  }
  catch (deliveryError) {
    error.value = deliveryError instanceof Error ? deliveryError.message : String(deliveryError)
  }
  finally {
    deliveryLoading.value = false
  }
}

async function retryDelivery(delivery: WebhookDelivery) {
  const result = await retryWebhookDelivery(requestOptions(), delivery.id)
  if (!result.success) {
    error.value = result.error || 'Delivery retry failed.'
    return
  }
  notice.value = 'Delivery retry queued.'
  if (selectedWebhookForLog.value)
    await openDeliveryLog(selectedWebhookForLog.value)
}

onMounted(async () => {
  if (typeof window !== 'undefined')
    apiKey.value = window.localStorage.getItem('codepushgo:console-api-key') || ''
  await organizationStore.dedupFetchOrganizations()
  if (apiKey.value)
    await refreshWebhooks()
})
</script>

<template>
  <section class="dashboard-content console-table-card">
    <header>
      <div>
        <p class="eyebrow">Organization settings</p>
        <h2>Webhooks</h2>
      </div>
      <button type="button" :disabled="loading" @click="refreshWebhooks">
        <RefreshCw :size="16" />
        Refresh
      </button>
    </header>

    <div class="dashboard-home-grid compact-content">
      <article class="quickstart-card">
        <p class="eyebrow">Worker authorization</p>
        <h2>Organization API key</h2>
        <label class="field-label" for="webhook-api-key">API key</label>
        <input id="webhook-api-key" v-model="apiKey" type="password" autocomplete="off" placeholder="cpg_..." @change="saveApiKey">
        <button class="primary" type="button" @click="saveApiKey">Save key</button>
      </article>

      <article class="quickstart-card">
        <p class="eyebrow">Create webhook</p>
        <h2>{{ editingWebhook ? 'Edit endpoint' : 'Add endpoint' }}</h2>
        <label class="field-label" for="webhook-name">Name</label>
        <input id="webhook-name" v-model="form.name" type="text" placeholder="Production deploys">
        <label class="field-label" for="webhook-url">URL</label>
        <input id="webhook-url" v-model="form.url" type="url" placeholder="https://example.com/codepushgo/webhook">
        <p v-if="urlError" class="form-alert error">{{ urlError }}</p>
        <label class="field-label" for="webhook-version">Delivery version</label>
        <select id="webhook-version" v-model="form.deliveryVersion">
          <option value="legacy">Legacy</option>
          <option value="standard">Standard</option>
        </select>
        <label class="filter-row">
          <input v-model="form.enabled" type="checkbox">
          Enabled
        </label>
        <div class="event-grid" aria-label="Webhook events">
          <label v-for="event in WEBHOOK_EVENT_TYPES" :key="event.value" class="event-option">
            <input type="checkbox" :checked="form.events.includes(event.value)" @change="toggleEvent(event.value)">
            <span>{{ event.label }}</span>
            <small>{{ event.description }}</small>
          </label>
        </div>
        <div class="button-row">
          <button class="primary" type="button" :disabled="pending || !isFormValid" @click="submitWebhook">
            <Plus v-if="!editingWebhook" :size="16" />
            <CheckCircle2 v-else :size="16" />
            {{ editingWebhook ? 'Update webhook' : 'Add webhook' }}
          </button>
          <button v-if="editingWebhook" type="button" @click="resetForm(null)">Cancel</button>
        </div>
      </article>
    </div>

    <p v-if="error" class="form-alert error">{{ error }}</p>
    <p v-if="notice" class="form-alert success">{{ notice }}</p>
    <p v-if="loading" class="empty-state">Loading webhooks...</p>

    <div v-else-if="webhooks.length === 0" class="empty-state">
      <FlaskConical :size="32" />
      <h3>No webhooks</h3>
      <p>Create the first endpoint to receive app, bundle, channel, member, and organization events.</p>
    </div>

    <div v-else class="webhook-list">
      <article v-for="webhook in webhooks" :key="webhook.id" class="quickstart-card webhook-card">
        <button class="webhook-summary" type="button" :aria-expanded="expandedWebhookId === webhook.id" @click="expandedWebhookId = expandedWebhookId === webhook.id ? '' : webhook.id">
          <span class="status-dot" :class="{ active: webhook.enabled }" aria-hidden="true" />
          <span>
            <strong>{{ webhook.name }}</strong>
            <small>{{ webhook.url }}</small>
          </span>
          <span class="event-badges">
            <span v-for="event in webhook.events.slice(0, 2)" :key="event" class="status-pill">{{ eventLabel(event) }}</span>
            <span v-if="webhook.events.length > 2" class="status-pill">+{{ webhook.events.length - 2 }}</span>
          </span>
          <ChevronDown :size="18" />
        </button>

        <div v-if="expandedWebhookId === webhook.id" class="webhook-details">
          <div class="detail-list">
            <div>
              <dt>Subscribed events</dt>
              <dd>{{ webhook.events.map(eventLabel).join(', ') }}</dd>
            </div>
            <div>
              <dt>Delivery version</dt>
              <dd>{{ deliveryVersion(webhook) }}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{{ formatDate(createdAt(webhook)) }}</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>{{ formatDate(updatedAt(webhook)) }}</dd>
            </div>
          </div>

          <div class="secret-row">
            <code>{{ webhook.secret || 'Signing secret is only returned on create.' }}</code>
            <button v-if="webhook.secret" type="button" aria-label="Copy signing secret" @click="copySecret(webhook.secret)">
              <Clipboard :size="16" />
            </button>
          </div>

          <details>
            <summary>How to verify the signature</summary>
            <pre><code>{{ signatureVerificationCode }}</code></pre>
          </details>

          <div class="button-row">
            <button type="button" :disabled="testingWebhookId === webhook.id" @click="testWebhook(webhook)">
              <FlaskConical :size="16" />
              {{ testingWebhookId === webhook.id ? 'Testing...' : 'Test' }}
            </button>
            <button type="button" @click="openDeliveryLog(webhook)">
              <RefreshCw :size="16" />
              Deliveries
            </button>
            <button type="button" @click="toggleWebhook(webhook)">
              <CheckCircle2 v-if="!webhook.enabled" :size="16" />
              <XCircle v-else :size="16" />
              {{ webhook.enabled ? 'Disable' : 'Enable' }}
            </button>
            <button type="button" @click="resetForm(webhook)">
              <Pencil :size="16" />
              Edit
            </button>
            <button type="button" class="danger" @click="deleteWebhook(webhook)">
              <Trash2 :size="16" />
              Delete
            </button>
          </div>
        </div>
      </article>
    </div>
  </section>

  <section v-if="selectedWebhookForLog" class="dashboard-content console-table-card">
    <header>
      <div>
        <p class="eyebrow">Delivery log</p>
        <h2>{{ selectedWebhookForLog.name }}</h2>
      </div>
      <button type="button" @click="selectedWebhookForLog = null">Close</button>
    </header>

    <p v-if="deliveryLoading" class="empty-state">Loading deliveries...</p>
    <div v-else class="table-scroll">
      <table aria-label="Webhook delivery log">
        <thead>
          <tr>
            <th scope="col">Status</th>
            <th scope="col">Response</th>
            <th scope="col">Duration</th>
            <th scope="col">Created</th>
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="delivery in deliveries" :key="delivery.id">
            <td><span class="status-pill" :class="deliveryStatusClass(delivery)">{{ deliveryStatus(delivery) }}</span></td>
            <td>{{ deliveryResponseStatus(delivery) }}</td>
            <td>{{ deliveryDuration(delivery) }}</td>
            <td>{{ formatDate(deliveryCreatedAt(delivery)) }}</td>
            <td>
              <button v-if="deliveryStatus(delivery) === 'failed'" type="button" @click="retryDelivery(delivery)">Retry</button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="deliveries.length === 0" class="empty-state">No webhook deliveries yet.</p>
    </div>
  </section>
</template>
