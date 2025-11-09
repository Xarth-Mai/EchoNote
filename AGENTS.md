# Repository Guidelines

## Project Structure & Module Organization
EchoNote pairs a Vite/TypeScript client in `src/` with a Tauri/Rust host under `src-tauri/`. UI widgets live in `src/components`, shared helpers in `src/utils`, and strict type contracts in `src/types`. Styles consolidate in `src/styles.css`, while native icons and capability manifests sit in `src-tauri/icons` and `src-tauri/capabilities`. Build outputs land in `dist/` for the web shell and `src-tauri/target/` for native binaries; Android artifacts are driven by `script/android-build.sh`.

## Build, Test, and Development Commands
- `pnpm dev`: Launches Vite with hot reload for rapid UI work.
- `pnpm tauri dev`: Boots the Rust backend plus the UI inside the desktop shell; run this before shipping.
- `pnpm build`: Executes `tsc --noEmit` for strict type safety, then emits production assets.
- `pnpm tauri build`: Produces signed desktop bundles; set `TAURI_ENV_*` when targeting a platform.
- `bash script/android-build.sh`: Uses the Tauri mobile toolchain to assemble an APK (Android SDK required).

## Coding Style & Naming Conventions
Use 2-space indentation, TypeScript strict mode, single quotes, and prefer `const`. Components export PascalCase classes, utilities use camelCase, and files mirror their primary export (`Calendar.ts`, `utils/state.ts`). Keep Rust modules formatted with `cargo fmt` and linted through `cargo clippy --all-targets --all-features`. Before committing multi-file edits, run `pnpm dlx biome format` (or Prettier) to keep diffs clean.

## Testing Guidelines
Automated tests are not wired yet, so rely on manual flows: switch calendar/editor modes, add entries, and verify monthly summaries. When introducing Vitest, colocate specs as `feature.test.ts` beside the source and wire `pnpm test`. Rust coverage belongs in `src-tauri/src/**/tests.rs`, executed via `cargo test`. Document any manual validation steps in PRs until CI arrives.

## Commit & Pull Request Guidelines
Follow conventional commits (`feat:`, `chore:`, `refactor:`) in imperative tone, e.g., `feat: add monthly summary API`. PRs should summarize user-facing impact, link issues, and attach UI screenshots or clips. Call out capability tweaks (`src-tauri/capabilities/*.json`), schema changes, or new env vars. Ensure `pnpm tauri dev` starts on a clean install before requesting review and list residual risks.

## Security & Configuration Tips
Never commit `.env` files or API tokens; document required keys in `README.md`. Update shell access via `src-tauri/capabilities` rather than bypassing Tauri’s sandbox. If you adjust `src-tauri/tauri.conf.json` for local experiments, revert those flags before merging so downstream agents inherit safe defaults.
