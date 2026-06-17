# Capgo / CodePushGo Parity Audit

Capgo source: /tmp/capgo-current
Capacitor updater source: /tmp/capacitor-updater-current
CodePushGo test count: 351

| Suite | Source tests/flows | CodePushGo matching files | Status |
| --- | ---: | ---: | --- |
| Capgo backend tests | 224 | 229 | verified |
| Capgo CLI tests | 115 | 120 | verified |
| Capacitor updater native contract tests | 2 | 2 | verified |
| Capacitor updater Maestro native flows | 39 | 0 | not applicable |

## Missing Source Examples

### Capgo backend tests

- None by filename; semantic parity checks passed.

### Capgo CLI tests

- None by filename; semantic parity checks passed.

### Capacitor updater native contract tests

- None by filename; semantic parity checks passed.

### Capacitor updater Maestro native flows

- Not applicable: React Native native build automation and native Maestro smoke flows are intentionally disabled for this MVP.

## Semantic Requirement Checks

| Check | Status | Detail |
| --- | --- | --- |
| monorepo packages present | pass | root workspaces include apps and packages |
| CLI command handlers stay out of entrypoint | pass | CLI entrypoint wires commands to handlers in src/commands.ts |
| CLI defaults app identity to detected RN bundle id | pass | init/resolve path uses detected React Native bundle id and auto-syncs when authenticated |
| Worker backend accepts bundle_id/app_id and public device endpoints | pass | Worker device contracts accept React Native bundle_id and expose update/stat/channel_self endpoints |
| Cloudflare Worker backend is configured | pass | wrangler.toml and worker scripts are present |
| no Supabase Edge Functions | pass | repo has only consolidated migration and Worker storage adapters |
| Vue dashboard remains Vue 3 | pass | dashboard package uses Vue and App.vue exists |
| React Native updater resolves bundle id automatically | pass | updater resolves RN bundle id and sends app_id/bundle_id |
| native self-managed/direct-update complexity is disabled | pass | native contract only normalizes simple off/background update checks |
| native build/store flows explicitly disabled | pass | native build automation has explicit disabled contract |
| AGENTS norms present | pass | root AGENTS.md captures repo norms |
| GitHub Actions run full local gate | pass | CI test workflow mirrors local verification gate |

