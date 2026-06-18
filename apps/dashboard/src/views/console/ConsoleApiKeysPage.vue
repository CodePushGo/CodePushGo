<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { CheckCircle2, Clipboard, KeyRound, Plus, RefreshCw, RotateCcw, Search, Trash2 } from 'lucide-vue-next'
import {
  API_KEY_APP_ROLES,
  API_KEY_ORG_ROLES,
  apiKeyBindingsSummary,
  apiKeyCreatedAt,
  apiKeyExpiresAt,
  apiKeyGlobalPermissions,
  buildApiKeyBinding,
  createApiKey,
  deleteApiKey,
  isApiKeyExpired,
  listApiKeys,
  regenerateApiKey,
  updateApiKey,
  type ApiKeyRecord,
  type ApiKeyScopeType,
} from '../../services/apikeys'
import { getRegistrationConfig } from '../../services/registration'
import { useConsoleStore } from '../../stores/console'
import { useOrganizationStore } from '../../stores/organization'

const config = getRegistrationConfig()
const consoleStore = useConsoleStore()
const organizationStore = useOrganizationStore()
const keys = ref<ApiKeyRecord[]>([])
const loading = ref(false)
const pending = ref(false)
const error = ref('')
const notice = ref('')
const search = ref('')
const adminApiKey = ref('')
const oneTimeKey = ref('')
const editingKey = ref<ApiKeyRecord | null>(null)
const form = ref({
  name: '',
  scopeType: 'org' as ApiKeyScopeType,
  orgId: '',
  appId: '',
  roleName: 'org_admin',
  expiresAt: '',
  allowOrgCreate: false,
})

const selectedOrgId = computed(() => organizationStore.currentOrganization?.gid || organizationStore.currentOrganization?.id || consoleStore.selectedApp.value?.owner_org || '')
const selectedAppId = computed(() => consoleStore.selectedAppId.value)
const roleOptions = computed(() => form.value.scopeType === 'app' ? API_KEY_APP_ROLES : API_KEY_ORG_ROLES)
const filteredKeys = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query)
    return keys.value
  return keys.value.filter(key => key.name.toLowerCase().includes(query) || apiKeyBindingsSummary(key.bindings).toLowerCase().includes(query))
})
const canSubmit = computed(() => Boolean(adminApiKey.value.trim() && form.value.name.trim() && (form.value.scopeType === 'app' ? form.value.appId.trim() : form.value.orgId.trim()) && form.value.roleName))

function requestOptions() {
  return { apiUrl: config.apiUrl, apiKey: adminApiKey.value.trim() }
}

function resetForm(key: ApiKeyRecord | null = null) {
  editingKey.value = key
  const firstBinding = key?.bindings?.[0]
  const scopeType = (firstBinding?.scopeType || firstBinding?.scope_type || 'org') as ApiKeyScopeType
  form.value = {
    name: key?.name || '',
    scopeType,
    orgId: firstBinding?.orgId || firstBinding?.org_id || selectedOrgId.value,
    appId: firstBinding?.appId || firstBinding?.app_id || selectedAppId.value,
    roleName: firstBinding?.roleName || firstBinding?.role_name || (scopeType === 'app' ? 'app_admin' : 'org_admin'),
    expiresAt: apiKeyExpiresAt(key || {})?.slice(0, 10) || '',
    allowOrgCreate: apiKeyGlobalPermissions(key || {}).includes('org.create'),
  }
}

function saveAdminApiKey() {
  if (typeof window !== 'undefined')
    window.localStorage.setItem('codepushgo:console-api-key', adminApiKey.value.trim())
  notice.value = 'API key saved for this browser.'
}

function bindingForForm() {
  return buildApiKeyBinding({
    roleName: form.value.roleName,
    scopeType: form.value.scopeType,
    orgId: form.value.orgId || selectedOrgId.value,
    appId: form.value.scopeType === 'app' ? form.value.appId : undefined,
  })
}

function globalPermissionsForForm() {
  return form.value.allowOrgCreate ? ['org.create'] : []
}

function expiresAtForForm() {
  return form.value.expiresAt ? new Date(`${form.value.expiresAt}T23:59:59.000Z`).toISOString() : null
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : '-'
}

function updateScopeType(scopeType: ApiKeyScopeType) {
  form.value.scopeType = scopeType
  form.value.roleName = scopeType === 'app' ? 'app_admin' : 'org_admin'
}

function onScopeTypeChange(event: Event) {
  const target = event.target as HTMLSelectElement | null
  if (target?.value === 'org' || target?.value === 'app')
    updateScopeType(target.value)
}

async function copySecret() {
  if (!oneTimeKey.value)
    return
  await navigator.clipboard.writeText(oneTimeKey.value)
  notice.value = 'API key copied.'
}

async function refreshApiKeys() {
  error.value = ''
  notice.value = ''
  if (!adminApiKey.value.trim()) {
    error.value = 'Paste an admin API key to manage API keys.'
    return
  }

  loading.value = true
  try {
    keys.value = await listApiKeys(requestOptions())
  }
  catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : String(loadError)
    keys.value = []
  }
  finally {
    loading.value = false
  }
}

async function submitApiKey() {
  if (!canSubmit.value)
    return
  pending.value = true
  error.value = ''
  notice.value = ''
  const input = {
    name: form.value.name.trim(),
    bindings: [bindingForForm()],
    expiresAt: expiresAtForForm(),
    globalPermissions: globalPermissionsForForm(),
  }
  const result = editingKey.value
    ? await updateApiKey(requestOptions(), editingKey.value.id, input)
    : await createApiKey(requestOptions(), input)
  pending.value = false
  if (!result.success) {
    error.value = result.error || 'API key operation failed.'
    return
  }
  oneTimeKey.value = result.key || ''
  notice.value = editingKey.value ? 'API key updated.' : 'API key created.'
  resetForm(null)
  await refreshApiKeys()
}

async function regenerate(key: ApiKeyRecord) {
  if (!window.confirm(`Regenerate ${key.name}? The current key will stop working.`))
    return
  pending.value = true
  const result = await regenerateApiKey(requestOptions(), key.id)
  pending.value = false
  if (!result.success) {
    error.value = result.error || 'API key regeneration failed.'
    return
  }
  oneTimeKey.value = result.key || ''
  notice.value = 'API key regenerated.'
  await refreshApiKeys()
}

async function remove(key: ApiKeyRecord) {
  if (!window.confirm(`Delete ${key.name}?`))
    return
  const result = await deleteApiKey(requestOptions(), key.id)
  if (!result.success) {
    error.value = result.error || 'API key deletion failed.'
    return
  }
  notice.value = 'API key deleted.'
  await refreshApiKeys()
}

onMounted(async () => {
  if (typeof window !== 'undefined')
    adminApiKey.value = window.localStorage.getItem('codepushgo:console-api-key') || ''
  await organizationStore.dedupFetchOrganizations()
  resetForm(null)
  if (adminApiKey.value)
    await refreshApiKeys()
})
</script>

<template>
  <section class="dashboard-content console-table-card">
    <header>
      <div>
        <p class="eyebrow">CLI authentication</p>
        <h2>API keys</h2>
      </div>
      <button type="button" :disabled="loading" @click="refreshApiKeys">
        <RefreshCw :size="16" />
        Refresh
      </button>
    </header>

    <div class="dashboard-home-grid compact-content">
      <article class="quickstart-card">
        <p class="eyebrow">Worker authorization</p>
        <h2>Admin API key</h2>
        <label class="field-label" for="apikey-admin-key">Current key</label>
        <input id="apikey-admin-key" v-model="adminApiKey" type="password" autocomplete="off" placeholder="cpg_..." @change="saveAdminApiKey">
        <button class="primary" type="button" @click="saveAdminApiKey">Save key</button>
      </article>

      <article class="quickstart-card">
        <p class="eyebrow">{{ editingKey ? 'Edit key' : 'Create key' }}</p>
        <h2>{{ editingKey ? editingKey.name : 'New API key' }}</h2>
        <label class="field-label" for="apikey-name">Name</label>
        <input id="apikey-name" v-model="form.name" type="text" placeholder="Production CLI">
        <label class="field-label" for="apikey-scope">Scope</label>
        <select id="apikey-scope" :value="form.scopeType" @change="onScopeTypeChange">
          <option value="org">Organization</option>
          <option value="app">App</option>
        </select>
        <template v-if="form.scopeType === 'org'">
          <label class="field-label" for="apikey-org">Organization ID</label>
          <input id="apikey-org" v-model="form.orgId" type="text" placeholder="org id">
        </template>
        <template v-else>
          <label class="field-label" for="apikey-app">App ID</label>
          <input id="apikey-app" v-model="form.appId" type="text" placeholder="com.example.app">
        </template>
        <label class="field-label" for="apikey-role">Role</label>
        <select id="apikey-role" v-model="form.roleName">
          <option v-for="role in roleOptions" :key="role.value" :value="role.value">{{ role.label }}</option>
        </select>
        <label class="field-label" for="apikey-expiry">Expires</label>
        <input id="apikey-expiry" v-model="form.expiresAt" type="date">
        <label v-if="form.scopeType === 'org'" class="filter-row">
          <input v-model="form.allowOrgCreate" type="checkbox">
          Allow organization creation
        </label>
        <div class="button-row">
          <button class="primary" type="button" :disabled="pending || !canSubmit" @click="submitApiKey">
            <Plus v-if="!editingKey" :size="16" />
            <CheckCircle2 v-else :size="16" />
            {{ editingKey ? 'Update API key' : 'Create API key' }}
          </button>
          <button v-if="editingKey" type="button" @click="resetForm(null)">Cancel</button>
        </div>
      </article>
    </div>

    <article v-if="oneTimeKey" class="quickstart-card one-time-key-card">
      <p class="eyebrow">One-time secret</p>
      <h2>Copy this API key now</h2>
      <div class="secret-row">
        <code>{{ oneTimeKey }}</code>
        <button type="button" aria-label="Copy API key" @click="copySecret">
          <Clipboard :size="16" />
        </button>
      </div>
    </article>

    <p v-if="error" class="form-alert error">{{ error }}</p>
    <p v-if="notice" class="form-alert success">{{ notice }}</p>

    <label class="search-control" for="apikey-search">
      <Search :size="16" />
      <input id="apikey-search" v-model="search" type="search" placeholder="Search API keys">
    </label>

    <p v-if="loading" class="empty-state">Loading API keys...</p>
    <div v-else class="table-scroll">
      <table aria-label="API keys table">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Bindings</th>
            <th scope="col">Global</th>
            <th scope="col">Expires</th>
            <th scope="col">Created</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="key in filteredKeys" :key="key.id">
            <th scope="row">
              <div class="stacked-cell">
                <strong>{{ key.name }}</strong>
                <small>{{ key.rbac_id || key.rbacId || key.key_hash || key.keyHash }}</small>
              </div>
            </th>
            <td>{{ apiKeyBindingsSummary(key.bindings) }}</td>
            <td>{{ apiKeyGlobalPermissions(key).join(', ') || '-' }}</td>
            <td>
              <span v-if="isApiKeyExpired(apiKeyExpiresAt(key))" class="status-pill error">Expired</span>
              <span v-else>{{ formatDate(apiKeyExpiresAt(key)) }}</span>
            </td>
            <td>{{ formatDate(apiKeyCreatedAt(key)) }}</td>
            <td>
              <div class="button-row">
                <button type="button" :disabled="pending" @click="resetForm(key)">
                  <KeyRound :size="16" />
                  Edit
                </button>
                <button type="button" :disabled="pending" @click="regenerate(key)">
                  <RotateCcw :size="16" />
                  Regenerate
                </button>
                <button type="button" class="danger" :disabled="pending" @click="remove(key)">
                  <Trash2 :size="16" />
                  Delete
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="filteredKeys.length === 0" class="empty-state">No API keys match this filter.</p>
    </div>
  </section>
</template>
