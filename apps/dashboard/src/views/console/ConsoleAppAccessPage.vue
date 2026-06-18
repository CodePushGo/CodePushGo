<script setup lang="ts">
import { KeyRound, ShieldCheck, Users } from 'lucide-vue-next'
import { useConsoleStore } from '../../stores/console'

const {
  copyCommand,
  devices,
  releaseCommand,
  selectedApp,
  selectedAppId,
  uploadCommand,
  user,
} = useConsoleStore()
</script>

<template>
  <section class="dashboard-content console-table-card">
    <header>
      <div>
        <p class="eyebrow">App access</p>
        <h2>{{ selectedApp?.name || selectedAppId }}</h2>
      </div>
      <ShieldCheck :size="18" />
    </header>

    <div v-if="selectedApp" class="dashboard-home-grid compact-content">
      <article class="quickstart-card">
        <p class="eyebrow">Upload permission</p>
        <h2>Organization API key</h2>
        <p>Use the organization key with the CLI to upload bundles and promote releases for this native bundle ID.</p>
        <button class="command" type="button" @click="copyCommand(uploadCommand)">
          <code>{{ uploadCommand }}</code>
          <KeyRound :size="16" />
        </button>
        <button class="command" type="button" @click="copyCommand(releaseCommand)">
          <code>{{ releaseCommand }}</code>
          <KeyRound :size="16" />
        </button>
      </article>

      <article class="quickstart-card">
        <p class="eyebrow">Session access</p>
        <h2>{{ user?.email || 'Signed in user' }}</h2>
        <dl class="detail-list">
          <div>
            <dt>App ID</dt>
            <dd>{{ selectedApp.app_id }}</dd>
          </div>
          <div>
            <dt>Organization</dt>
            <dd>{{ selectedApp.owner_org || '-' }}</dd>
          </div>
          <div>
            <dt>Known devices</dt>
            <dd>{{ devices.length }}</dd>
          </div>
        </dl>
      </article>
    </div>

    <div v-else class="empty-state">
      App not found for this native bundle ID.
    </div>
  </section>

  <section v-if="selectedApp" class="dashboard-home-grid dashboard-content compact-content">
    <article class="quickstart-card muted-card">
      <Users :size="24" />
      <h2>Organization members</h2>
      <p>Membership and role changes stay in organization settings, matching the shared Supabase Auth and RLS boundary.</p>
    </article>
    <article class="quickstart-card muted-card">
      <ShieldCheck :size="24" />
      <h2>Runtime access</h2>
      <p>Device update checks stay public. Admin upload and release commands require the bearer API key.</p>
    </article>
  </section>
</template>
