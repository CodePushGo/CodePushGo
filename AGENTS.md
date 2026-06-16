# AGENTS.md

This repository is the React Native-focused CodePushGo monorepo.

## Commands

- Use `bun` and `bunx` for repo-local commands.
- Customer-facing docs and marketing examples should use standard `npm` and `npx`.
- Install dependencies with `bun install`.
- Run all local verification with `bun run lint`, `bun run typecheck`, `bun run build`, and `bun run test`.
- Start the Vue dashboard with `bun dev`.
- Start the Cloudflare Worker with `bun run worker:dev`.

## Architecture

- `packages/worker` is the backend runtime. Keep server code deployable as a Cloudflare Worker; default metadata/storage is Cloudflare D1 and R2.
- Do not add Supabase Edge Functions. Supabase-backed deployments may use the Worker storage adapter and the single consolidated migration.
- `packages/cli` owns React Native bundle generation and uploads. It should default app identity to the detected React Native bundle id, matching Capgo's config-driven app id behavior.
- `packages/react-native-updater` owns the JavaScript React Native updater client. Native bridge/build support is intentionally out of scope for now, but native-facing decisions should be covered by `native-contract-tests`.
- `apps/dashboard` remains Vue 3.
- `packages/shared` owns contracts shared by CLI, worker, updater, and dashboard.
- Admin endpoints require `Authorization: Bearer <CODEPUSHGO_API_KEY>`.
- Device endpoints (`/updates`, `/stats`, `/channel_self`) are public.
- Success responses return JSON with `status: "ok"` where practical.
- Errors return JSON with `error` and `message`.

## CLI Norms

- Keep command handlers outside `src/index.ts`.
- CLI command names must be lowercase and kebab-case.
- Prefer small exported helpers for parsing, bundling, and upload behavior so tests can cover them.
- Internal commands should use Bun tooling. Public examples may use `npx @codepushgo/cli@latest ...`.

## Testing

- Add focused tests beside the package that owns the behavior.
- Worker tests should use the memory storage adapter unless a task specifically needs live Cloudflare resources.
- Tests must not depend on test ordering across files.

## GitHub / PR Flow

- If creating a PR, make it draft first.
- Wait for CI, fix failures, then mark the PR ready only when checks pass.
- If review comments arrive, wait until "Review in progress" is gone, fix comments, resolve them, and verify CI again.
