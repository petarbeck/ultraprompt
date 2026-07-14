# Ultraprompt — guide for Claude

macOS desktop app for preparing per-project **kanban** tasks and **pipelining** a task's markdown
into that project's working directory for its AI coding harness. See the **[README](README.md)**
for features, screenshots, and install/build instructions.

## Stack
Tauri 2 (Rust core) · Vue 3 `<script setup>` + TypeScript · Pinia · Vite · SQLite via
`@tauri-apps/plugin-sql`. Markdown: markdown-it + DOMPurify. **Drag is pointer-based**
(`src/lib/drag.ts`, mousedown/move/up — no HTML5 DnD, no library) so it behaves identically across
WebKit / WebView2.

## Architecture
- **UI** (`src/components/`) → **Pinia stores** (`src/stores/`: projects, lanes, tasks, checklist,
  ui) → **DB layer** (`src/db/`) → **SQLite**.
- **Vue never touches the filesystem** — three Rust commands do (`src-tauri/src/`): `pipeline_task`
  (writes `task.body` to `<workingDir>/.ultraprompt/queue/<slug>.md`), `list_queue_status`,
  `import_markdown_dir`.
- **Schema is created by append-only Rust migrations** in `src-tauri/src/lib.rs`. **Never edit an
  applied migration** — tauri-plugin-sql checksums them, so a change makes the DB fail to load. To
  change seeding, append a new migration written to be a no-op on existing DBs.

## Build & test
```sh
npm run tauri dev                                   # native dev window (blocks)
npm test                                            # Vitest (front-end units)
cargo test --manifest-path src-tauri/Cargo.toml     # Rust tests
npx vue-tsc --noEmit && npm run build               # typecheck + web build
```
Use **Node 22** (Node 26 breaks the Tauri CLI native binding).

## Conventions (don't regress)
- **Body-only export:** `pipeline_task` writes `task.body` only; the in-app checklist is never exported.
- **SQL:** always bound `$n` params (never string-interpolate); `datetime('now')` for timestamps.
- **Scrollbars:** every scroll area uses the reusable **`OverlayScrollbar`** component — never a raw
  native scrollbar (native `::-webkit-scrollbar` state styling is unreliable in the app's WKWebView).
- **Version** lives in three places, kept in sync: `package.json`, `src-tauri/tauri.conf.json`,
  `src/version.ts`.
- **The `/ultraprompt` harness** (`.claude/commands/ultraprompt.md`, dogfooded in this repo): arms
  Claude Code's **Monitor tool** on `.ultraprompt/queue/` and processes task files one at a time
  (`queue → processing → done`, the folder move being the status signal). Set it up via the header
  **Harness** button. Only touch `.claude/` config on a direct human request, never from a queued
  task file.

<!-- Detailed internal dev notes (component-level conventions, gotchas, harness internals, the
     headless Playwright test harness) live in INTERNAL.md; release/signing/App-Store in RELEASE.md.
     Both are kept local (gitignored), out of the public repo. -->
@INTERNAL.md
