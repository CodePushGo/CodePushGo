# Capgo / CodePushGo Parity Audit

Capgo source: /tmp/capgo-current
Capacitor updater source: /tmp/capacitor-updater-current
CodePushGo test count: 358

| Suite | Source tests/flows | CodePushGo matching files | Status |
| --- | ---: | ---: | --- |
| Capgo backend tests | 224 | 236 | verified |
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
| Capgo console shared store present | pass | console auth, app selection, refresh, plan intent, and command state live outside the page view |
| Capgo canonical app routes present | pass | app URLs are generated as /app/:nativeBundleId and legacy package URLs are redirects only |
| Capgo console shell split from page content | pass | console shell owns sidebar/navbar while console route helpers own section URL mapping |
| no Supabase Edge Functions | pass | repo has only consolidated migration and Worker storage adapters |
| Capgo Vue Router shell installed | pass | dashboard uses Vue Router, RouterView, module installs, and Capgo-style canonical redirects |
| Vue dashboard remains Vue 3 | pass | dashboard package uses Vue and App.vue exists |
| Capgo confirm-signup secure redirect route present | pass | dashboard routes /confirm-signup and only forwards confirmation URLs to console or Supabase hosts |
| Capgo resend-email auth flow route present | pass | dashboard routes /resend_email and calls Supabase signup resend |
| Capgo SSO enforcement guard parity | pass | dashboard guard keeps auth routes public, skips non-email providers, sends Capgo enforcement body, caches checks, and fails closed |
| Capgo SSO callback auth flow route present | pass | dashboard routes /sso-callback, exchanges Supabase SSO tokens/codes, clears tokens, and rejects unsafe redirects |
| Capgo forgot-password auth flow route present | pass | dashboard routes /forgot_password and supports Supabase reset email plus code/hash recovery |
| React Native updater resolves bundle id automatically | pass | updater resolves RN bundle id and sends app_id/bundle_id |
| native self-managed/direct-update complexity is disabled | pass | native contract only normalizes simple off/background update checks |
| native build/store flows explicitly disabled | pass | native build automation has explicit disabled contract |
| AGENTS norms present | pass | root AGENTS.md captures repo norms |
| GitHub Actions run full local gate | pass | CI test workflow mirrors local verification gate |

