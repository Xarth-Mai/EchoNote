# Repository Guidelines

## Project Structure & Module Organization
EchoNote combines a SvelteKit front end with a Rust/Tauri shell. UI entry points live in `src/routes` (`+layout.svelte` for global chrome, `+page.svelte` for the editor). Shared components are stored in `src/lib/components`, reusable helpers in `src/utils`, and types in `src/types`. Styling originates from `src/styles.css`, which defines the shared tokens and utility classes for panels, buttons, calendars, and timelines. Native commands, capability manifests, and bundle assets live in `src-tauri` (see `src-tauri/src/*.rs`, `tauri.conf.json`, and `icons/`).

## Build, Test, and Development Commands
- `bun install` — install JS dependencies; rerun after changing `package.json` or `bun.lock`.
- `bun run dev` — start Vite/SvelteKit for browser development.
- `bun run check` or `bun run check:watch` — execute `svelte-check` with the repo `tsconfig.json`.
- `python script/check_i18n.py` — validate locale strings stay in sync across language packs.
- `bun run build` followed by `bun run preview` — compile and locally serve the production bundle before packaging.
- `bun run tauri dev` / `bun run tauri build` — open the desktop shell or create release binaries; both assume the web bundle already passes `bun run build`.
- `bash script/android-build.sh [debug|release]` — cross-compile the Android flavor with the Tauri CLI installed.

## Coding Style & Naming Conventions
Use TypeScript modules with 2-space indentation and prefer `const` + explicit return types. Components and stores adopt `PascalCase` filenames (`Editor.svelte`, `TimelineStore.ts`), while helper exports stay `camelCase`. Co-locate UI logic inside `<script lang="ts">` blocks, keep side-effect helpers in `src/utils/backend.ts`, and expose state through Svelte stores in `src/utils/state.ts`. Favor the semantic utility classes already defined in `src/styles.css` (`.btn`, `.surface-card`, `.calendar__*`, `.timeline__*`, etc.) and extend that file when shared styles are needed.

## Testing Guidelines
Treat `bun run check` as the minimum gate for every commit. New UI tests should sit next to the subject file as `ComponentName.spec.ts` and run through Vitest (`bun x vitest run`) when introduced. Tauri/Rust code should provide module tests in `src-tauri/src` and be verified with `cargo test`. Always perform an integration smoke test via `bun run preview` plus `bun run tauri dev` to confirm IPC commands, especially after touching `src/utils/backend.ts` or `src-tauri/src/commands.rs`.

## Commit & Pull Request Guidelines
Follow the Conventional Commits style already visible in `git log` (`feat: …`, `docs: …`, `refactor: …`) and always write commit messages in English so they remain searchable for every contributor. Keep each commit scoped to one logical change that leaves both Bun and Tauri builds green. PRs must include a short summary, checklist of validation commands, linked issue (if applicable), and screenshots or short clips when altering UI/UX. Convert drafts to “ready for review” only after CI passes locally and platform-specific artifacts (desktop, Android) are tested as relevant.

## Communication & Support
EchoNote is bilingual; mirror the language the user or reviewer used in their latest message (reply in Chinese when they write Chinese, English otherwise). Surface command outputs or logs succinctly, and recap any manual steps (e.g., `bun run check`) so reviewers can reproduce results quickly. If unsure about localization or terminology, ask in the user’s language before shipping changes.
