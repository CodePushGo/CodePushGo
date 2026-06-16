# CodePushGo

CodePushGo is a React Native live-update service based on Capgo's product shape, adapted for React Native.

This repo contains:

- `packages/worker`: Cloudflare Worker backend using D1 metadata and R2 bundles by default, with a Supabase storage adapter for deployments that provide Supabase Worker env vars.
- `packages/cli`: CLI for React Native bundle detection, bundling, upload, and release management.
- `packages/react-native-updater`: JavaScript React Native updater client and native contract helpers.
- `apps/dashboard`: Vue 3 dashboard.
- `packages/shared`: contracts shared by the CLI, Worker, updater, and dashboard.
- `native-contract-tests`: platform-neutral updater fixtures for future native iOS/Android runners.

## Local Development

```sh
npm install
npm run typecheck
npm run test
npm run build
```

Start the dashboard:

```sh
npm run dev
```

Start the Worker:

```sh
npm run worker:dev
```

## Backend Schema

For Supabase-backed deployments, apply the single migration in `supabase/migrations/20260611111318_codepushgo_init.sql`. Default Cloudflare deployments use D1 for metadata, R2 for bundles, and `CODEPUSHGO_API_KEY` as a Worker secret/var.

## CLI

```sh
npx @codepushgo/cli@latest init
npx @codepushgo/cli@latest app add
npx @codepushgo/cli@latest release --platform ios --version 1.0.1
```

The CLI defaults the app id to your React Native bundle id from `app.json`, `app.config.json`, `android/app/build.gradle`, or `ios/*.xcodeproj/project.pbxproj`. `init` writes that id and, when a token is available, syncs the backend app automatically using the bundle id. You can still override it with a positional app id or `--app-id`.
```sh
npx @codepushgo/cli@latest init --app-id com.example.app
npx @codepushgo/cli@latest release com.example.app --platform ios --version 1.0.1
```

## Updater

The updater uses the React Native bundle id as the app identity by default. It resolves it from explicit options, runtime config, a native/global value, Expo config, or React Native runtime constants. App code should not pass a separate CodePushGo app id unless it intentionally overrides the native bundle id.

```ts
import { configureCodePushGo, startCodePushGo } from '@codepushgo/react-native-updater'

configureCodePushGo({ endpoint: 'https://api.example.com' })

await startCodePushGo({
  platform: 'ios',
  currentVersion: '1.0.0',
})
```

`startCodePushGo()` checks for updates by default, sends `app_id` and `bundle_id` from the resolved React Native bundle id, and downloads an available bundle into pending storage. `checkForUpdate()` sends `defaultChannel` by default. The Worker applies a stored `/channel_self` device override first, matching Capgo's default-channel behavior.

## Current Scope

The React Native updater package provides update checks, download metadata, stats reporting, channel override behavior, and native contract fixtures. Native code that swaps the JavaScript bundle at launch is intentionally deferred.
