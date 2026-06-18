<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { MailPlus, RefreshCw, Search, ShieldCheck, Trash2, UserRoundCog } from 'lucide-vue-next'
import { getRegistrationConfig } from '../../services/registration'
import { deleteOrganizationMember, listOrganizationMembers, roleLabel, upsertOrganizationMember, type OrganizationMember } from '../../services/organizationMembers'
import { useConsoleStore } from '../../stores/console'
import { useOrganizationStore } from '../../stores/organization'

const config = getRegistrationConfig()
const consoleStore = useConsoleStore()
const organizationStore = useOrganizationStore()
const members = ref<OrganizationMember[]>([])
const loading = ref(false)
const pending = ref(false)
const error = ref('')
const notice = ref('')
const search = ref('')
const apiKey = ref('')
const inviteEmail = ref('')
const inviteRole = ref('read')

const orgId = computed(() => organizationStore.currentOrganization?.gid || organizationStore.currentOrganization?.id || consoleStore.selectedApp.value?.owner_org || '')
const filteredMembers = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query)
    return members.value
  return members.value.filter(member => member.email.toLowerCase().includes(query) || member.role.toLowerCase().includes(query))
})
const canManageMembers = computed(() => Boolean(apiKey.value.trim() && orgId.value))
const canSubmitInvite = computed(() => canManageMembers.value && inviteEmail.value.trim().includes('@') && inviteRole.value)

const roleOptions = [
  { label: 'Member', value: 'read' },
  { label: 'Admin', value: 'admin' },
  { label: 'Super admin', value: 'super_admin' },
]

function requestOptions() {
  return { apiUrl: config.apiUrl, apiKey: apiKey.value.trim(), orgId: orgId.value }
}

function saveApiKey() {
  if (typeof window !== 'undefined')
    window.localStorage.setItem('codepushgo:console-api-key', apiKey.value.trim())
  notice.value = 'API key saved for this browser.'
}

async function refreshMembers() {
  error.value = ''
  notice.value = ''
  if (!orgId.value) {
    error.value = 'No organization selected.'
    return
  }
  if (!apiKey.value.trim()) {
    error.value = 'Paste an organization API key to manage members.'
    return
  }

  loading.value = true
  try {
    members.value = await listOrganizationMembers(requestOptions())
  }
  catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : String(loadError)
    members.value = []
  }
  finally {
    loading.value = false
  }
}

async function inviteMember() {
  if (!canSubmitInvite.value)
    return
  pending.value = true
  error.value = ''
  notice.value = ''
  const result = await upsertOrganizationMember(requestOptions(), { email: inviteEmail.value, role: inviteRole.value })
  pending.value = false
  if (!result.success) {
    error.value = result.error || 'Member invite failed.'
    return
  }
  inviteEmail.value = ''
  notice.value = 'Member saved.'
  await refreshMembers()
}

async function updateMemberRole(member: OrganizationMember, role: string) {
  pending.value = true
  const result = await upsertOrganizationMember(requestOptions(), { email: member.email, role, userId: member.user_id || member.uid })
  pending.value = false
  if (!result.success) {
    error.value = result.error || 'Member role update failed.'
    return
  }
  notice.value = 'Member role updated.'
  await refreshMembers()
}

async function removeMember(member: OrganizationMember) {
  if (!window.confirm(`Remove ${member.email} from this organization?`))
    return
  const result = await deleteOrganizationMember(requestOptions(), member.email)
  if (!result.success) {
    error.value = result.error || 'Member removal failed.'
    return
  }
  notice.value = 'Member removed.'
  await refreshMembers()
}

onMounted(async () => {
  if (typeof window !== 'undefined')
    apiKey.value = window.localStorage.getItem('codepushgo:console-api-key') || ''
  await organizationStore.dedupFetchOrganizations()
  if (apiKey.value)
    await refreshMembers()
})
</script>

<template>
  <section class="dashboard-content console-table-card">
    <header>
      <div>
        <p class="eyebrow">Organization settings</p>
        <h2>Members</h2>
      </div>
      <button type="button" :disabled="loading" @click="refreshMembers">
        <RefreshCw :size="16" />
        Refresh
      </button>
    </header>

    <div class="dashboard-home-grid compact-content">
      <article class="quickstart-card">
        <p class="eyebrow">Worker authorization</p>
        <h2>Organization API key</h2>
        <label class="field-label" for="members-api-key">API key</label>
        <input id="members-api-key" v-model="apiKey" type="password" autocomplete="off" placeholder="cpg_..." @change="saveApiKey">
        <button class="primary" type="button" @click="saveApiKey">Save key</button>
      </article>

      <article class="quickstart-card">
        <p class="eyebrow">Invite user</p>
        <h2>Add organization member</h2>
        <label class="field-label" for="member-email">Email</label>
        <input id="member-email" v-model="inviteEmail" type="email" placeholder="dev@example.com">
        <label class="field-label" for="member-role">Role</label>
        <select id="member-role" v-model="inviteRole">
          <option v-for="role in roleOptions" :key="role.value" :value="role.value">{{ role.label }}</option>
        </select>
        <button class="primary" type="button" :disabled="pending || !canSubmitInvite" @click="inviteMember">
          <MailPlus :size="16" />
          Add member
        </button>
      </article>
    </div>

    <p v-if="error" class="form-alert error">{{ error }}</p>
    <p v-if="notice" class="form-alert success">{{ notice }}</p>

    <label class="search-control" for="member-search">
      <Search :size="16" />
      <input id="member-search" v-model="search" type="search" placeholder="Search members">
    </label>

    <p v-if="loading" class="empty-state">Loading members...</p>
    <div v-else class="table-scroll">
      <table aria-label="Organization members table">
        <thead>
          <tr>
            <th scope="col">Member</th>
            <th scope="col">Role</th>
            <th scope="col">Status</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="member in filteredMembers" :key="member.uid || member.email">
            <th scope="row">
              <div class="stacked-cell">
                <strong>{{ member.email }}</strong>
                <small>{{ member.uid }}</small>
              </div>
            </th>
            <td>
              <select :value="member.role" :disabled="pending || !canManageMembers" aria-label="Member role" @change="updateMemberRole(member, ($event.target as HTMLSelectElement).value)">
                <option v-for="role in roleOptions" :key="role.value" :value="role.value">{{ role.label }}</option>
              </select>
            </td>
            <td>
              <span class="status-pill success"><ShieldCheck :size="14" /> {{ roleLabel(member.role) }}</span>
            </td>
            <td>
              <button type="button" :disabled="pending || !canManageMembers" @click="removeMember(member)">
                <Trash2 :size="16" />
                Remove
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="filteredMembers.length === 0" class="empty-state">
        <UserRoundCog :size="32" />
        No organization members match this filter.
      </p>
    </div>
  </section>
</template>
