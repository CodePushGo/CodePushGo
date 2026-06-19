# Capgo / CodePushGo Parity Audit

This audit tracks the copied Capgo console/backend structure adapted for CodePushGo React Native.

| Check | Status | Detail |
| --- | --- | --- |
| monorepo packages present | pass | root workspaces include apps, packages, and copied Capgo dashboard CLI workspace |
| Capgo file-router console copied | pass | dashboard uses the copied Capgo Vue file-based console pages |
| Vue dashboard remains Vue 3 | pass | dashboard package uses Vue and copied Vite config |
| CodePushGo Supabase public config present | pass | dashboard public config points at the CodePushGo Supabase project |
| console custom domain deploy configured | pass | console Worker assets deploy to the CodePushGo console domain |
| Cloudflare Worker backend is configured | pass | wrangler.toml and worker scripts are present |
| no Supabase Edge Functions | pass | repo uses the consolidated migration and Cloudflare Worker runtime instead of Supabase Edge Functions |
| consolidated migration contains onboarding and plan intent | pass | Supabase schema has onboarding RPCs and plan intent table |
| React Native updater resolves bundle id automatically | pass | updater resolves RN bundle id and sends app_id/bundle_id |
| AGENTS norms present | pass | root AGENTS.md captures repo norms |
| GitHub Actions run full local gate | pass | CI test workflow mirrors local verification gate |

