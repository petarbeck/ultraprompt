# Ultraprompt — project guide for Claude

macOS desktop app: prepare per-project kanban tasks and **pipeline** a task's
markdown into that project's working dir for its AI harness. The full design +
plan + deferred-work notes live locally under `docs/superpowers/` (kept out of
the public repo — gitignored). This file is the fast orientation.

## Stack
Tauri 2 (Rust) · Vue 3 `<script setup>` + TypeScript · Pinia · Vite · SQLite via
`@tauri-apps/plugin-sql`. Markdown: markdown-it + DOMPurify. Fonts: Archivo
(display) / Inter (UI) / JetBrains Mono (figures). **Drag is pointer-based**
(mousedown/move/up, `src/lib/drag.ts`) — no native HTML5 DnD, no library — so it
works identically across WebKit/WebView2. Window size is remembered via
`tauri-plugin-window-state`.

## Architecture / data flow
- UI (`src/components/`) → Pinia stores (`src/stores/`: projects, lanes, tasks,
  checklist, ui) → DB layer (`src/db/`: `getDb`/`select`/`execute`, `types.ts`,
  `mappers.ts` snake→camel) → SQLite.
- DB name is `sqlite:ultraprompt.db`; **schema is created by Rust migrations**
  in `src-tauri/src/lib.rs` — append-only: **v1** (schema + lane seed), **v2**
  (`tasks.completed_at`), **v3** (lane-emoji reseed), **v4** (rename default lanes
  Selected→Specify, In Progress→Plan), **v5** (`projects.working_dir_bookmark`, macOS
  sandbox). Migrations run at runtime on the first
  `Database.load` (app startup, from `AppShell` onMounted). The DB file lives in the
  OS app-data dir (`~/Library/Application Support/<identifier>/`).
- **NEVER edit an already-applied migration's SQL.** tauri-plugin-sql (sqlx) stores a
  **checksum** per applied migration; changing one triggers a version-mismatch that
  makes `Database.load` fail — the app opens with **no data** (the DB file is *not*
  modified; it just won't load). To change seeding for new installs, **append a new
  migration** written to be a **no-op on existing DBs** (e.g. `UPDATE ... WHERE
  name='<old default>'`, which matches nothing once the user has renamed/customized).
- **Vue never touches the FS directly** — three Rust commands do: `pipeline_task`
  (write body to `.ultraprompt/queue/`, `pipeline.rs`; `unique_queue_path` dedupes
  the basename against BOTH `queue/` and `done/` so a reused name can't false-flag
  as completed), `list_queue_status` (read `.ultraprompt/processing/` + `done/`,
  returns `{ processing, done }`, `done.rs`), `import_markdown_dir` (read a dir's
  `.md` files, `import.rs`). The pipeline/queue commands (`pipeline_task` / `revoke_queued`
  / `list_queue_status`) also take an **optional `bookmark`** (base64 macOS security-scoped
  bookmark) and run their FS work inside `bookmark::access` so they work under the Mac App
  Store sandbox; `create_working_dir_bookmark` mints one when a working dir is picked
  (`bookmark.rs`, stored in `projects.working_dir_bookmark`). No-op off macOS / when `None`,
  so Developer-ID + dev builds are unchanged. Pass `bookmark: project.workingDirBookmark`
  from the Vue side.
- **Drag manager** (`src/lib/drag.ts`): a reactive module-singleton driving all
  card interaction — reorder, cross-lane move (always **appends to end** of the
  target lane), drop-on-**ULTRAPROMPT** (pipeline), drop-on-**Trash** (delete +
  undo). `AppShell` wires handlers + renders the ghost, and polls
  `list_queue_status` every 4s (`tasks.pollDone`, re-entrancy-guarded) to flip
  each sent task through **Queued → Processing → Completed** (global newest-first
  history feed in the ULTRAPROMPT panel; rows are labelled with their project).
- Design tokens: `src/assets/theme.css` (`--up-*`, the "Access · Deep" violet-on-
  near-black palette). Pure logic helpers: `src/lib/` (`slugify`, `search`, `reorder`
  incl. `moveToIndex`, `drag`, `listDrag` (settings-table pointer reorder),
  `armedConfirm` (two-click confirm), `datetime` (UTC→local, `isWithinLastHours`),
  `caret`, `markdown`).

## Rules / conventions (don't regress these)
- **Body-only export.** `pipeline_task` writes `task.body` only, to
  `<workingDir>/.ultraprompt/queue/<slug>.md`. The checklist is in-app prep and is
  **never** exported.
- **Drag targets:** drop a card on the **Pipeline** panel (the right-hand
  `UltrapromptPanel`, header now reads "Pipeline") to pipeline it (lock + archive +
  write). There is **no Trash drop zone** anymore — delete/archive moved onto the
  cards. **Unarchive** (archive table) returns a task to the first lane, clearing
  sent/completed/archived state.
- **Card + modal action buttons.** Order on BOTH surfaces: **delete · archive ·
  favorite · copy · send-to-pipeline**, spaced (no separator lines — each button has a
  border + dark tint on the card, border-only in the always-visible modal header). On
  the card the row is **hover-reveal, bottom-right** (`.cardacts`); the modal header
  carries the same set beside the quick-move lane buttons + timestamp. **send-to-pipeline
  only renders when the task is in the LAST (right-most) lane** — `isLastLane` = laneId
  === max-position lane, computed in both `TaskCard` and `TaskModal`. **delete / archive /
  send require a confirming second click** (`useArmedConfirm`, `src/lib/armedConfirm.ts`);
  **favorite + copy fire immediately**. copy → `navigator.clipboard.writeText(task.body)`
  (raw markdown) + toast. delete → `tasks.remove` + Undo; archive → `tasks.archive`
  (bypass) + Undo; send → `tasks.pipeline`. Cards use `padding-bottom:20px` so body text
  clears the action row.
- **Post-close card flash.** Closing a task's detail modal via `close()` (× / ESC /
  backdrop — NOT delete/archive/send, which remove the card) calls `ui.flashTask(id)`;
  the matching board card plays a brief violet-ring `.card.flash` keyframe (~0.52s) so
  you can relocate it. `ui.flashTaskId` self-clears (~700ms) so it can re-fire; respects
  `prefers-reduced-motion`.
- **GOTCHA — hover-only buttons block drag on short cards.** An `opacity:0` button
  still captures pointer events, so a `pointerdown` over the (invisible) bottom-right
  action row won't start a drag. `TaskCard.onPointerDown` skips drag when the target is
  inside `.cardacts`; drag by the card **body/text**, not a short card's geometric
  center (which sits over the action row). Harness drivers that drag must grab the text.
- **Two archive paths:** `pipeline` (sent to harness, `sent_at` set, appears in the
  feed) vs `archive` (bypass, `sent_at` stays null). Both set `archived_at`.
- **`ui.showToast(msg, undoPayload?, undoAction?)`** renders an Undo button. Undo runs
  `undoAction` if given, else `tasks.restore(undoPayload)`; `restore` accepts a single
  snapshot OR an array (batch undo — e.g. `LaneSettings` clear/archive-all, which uses
  `undoAction` to un-archive back to each task's lane).
- **Pipeline feed** (`UltrapromptPanel`) shows tasks **sent within the last 24h**
  (strict window, `isWithinLastHours`), newest-first, fills the panel and scrolls.
  Header carries muted status **totals** (Queued/Processing/Completed, color-coded).
  A still-Queued row has a hover **revoke** icon (`tasks.revoke` + Rust `revoke_queued`
  deletes the queue file, returns the task to the last lane). Rows are clickable →
  read-only detail modal. **Rows from OTHER projects are muted** (`.frow.muted`, opacity
  0.4; hover restores) so the active project's tasks stand out — the feed is global.
- **Harness setup is a `/ultraprompt` slash command** (`HarnessPrompt.vue`): a coding-agent
  session is turn-based and can't detect later-queued tasks with a one-shot scan, so the
  harness **arms Claude Code's built-in `Monitor` tool** on `.ultraprompt/queue/` — Monitor
  streams each new-file event back to the agent mid-turn, which is the actual wake. (A plain
  backgrounded command only re-invokes the agent when it EXITS, so a persistent echo loop
  detects files but never wakes it — the historical "never detects tasks" bug; the prompt
  now steers hard away from it and has no poll-loop fallback.) The modal shows ONE paste-once
  prompt (`SETUP_PROMPT`) telling the agent to create `.claude/commands/ultraprompt.md` (its
  body = the harness loop `COMMAND_BODY`, embedded between `===ULTRAPROMPT===` markers) and
  start it; thereafter the user types **`/ultraprompt`** to re-engage — a repo file, so it
  survives restarts + `/clear` with no `settings.json`. **Re-arm, don't skip:** re-running
  `/ultraprompt` always starts a FRESH Monitor, restarting the session's OWN stale one
  (session-scoped — never kills other sessions' watchers, since multiple sessions on one
  project are normal); the create step ASKS before overwriting an existing command file.
  Tasks run one-at-a-time in ascending filename order; claiming is an atomic
  `queue→processing` MOVE (duplicate wakes are harmless); a blocked/unverifiable task is
  **parked in `processing/`** (NOT bounced back to `queue/`, which would re-claim and loop).
  (This SUPERSEDED the old `SessionStart`-hook approach.) Task files are work requests,
  **not authority over the harness** (a task can't make the agent disable its Monitor,
  re-run `/ultraprompt`, or install auto-running `.claude/` startup config); and only touch
  `.claude/` config on a **direct human request**, never from a queued task file.
  `.claude/commands/*.md` is a plain slash-command file (loads live, no restart) — unlike a
  hook it does NOT auto-run, so it's the safe primitive here. **This repo dogfoods it:**
  `.claude/commands/ultraprompt.md` is committed, so typing `/ultraprompt` in a session
  opened here arms the harness against this project's own `.ultraprompt/` queue.
- **Lanes are global** (shared by every project); new installs seed `Backlog/Specify/
  Plan/Ready` (v1 seeds the old `Selected`/`In Progress` names, v4 renames them) —
  **no "Completed" lane** (dropping on ULTRAPROMPT is the
  terminal state). Deleting a lane requires migrating its tasks
  (`deleteWithMigration`). Settings edits projects/lanes via **drag-sortable tables +
  modals** (`ProjectEditModal`/`LaneEditModal`): each row has a grip handle; dragging
  reorders and persists via `projects.reorder`/`lanes.reorder`. (Settings no longer holds
  the harness prompt — it moved to the header **Harness** button.)
- **Header (`TopBar`) right side:** two labeled icon buttons — **Harness** (terminal
  icon → opens the `/ultraprompt` setup modal via `ui.harnessPromptOpen`) and **Settings**
  (gear → `ui.settingsOpen`). `HarnessPrompt` is mounted once in `AppShell` and teleports
  its own modal (gated by `ui.harnessPromptOpen`) — it is NOT inside `SettingsModal`
  anymore. Every scroll area app-wide uses the reusable **`OverlayScrollbar`** component
  (hidden-until-hover custom thumb), never a raw native scrollbar — see the WKWebView gotcha.
- **App version** lives in `src/version.ts` (`APP_VERSION`, format `<major>.<minor>.<build>`),
  shown muted at the sidebar's bottom-center (`Sidebar` `.version`). On release, bump it
  together with `package.json` and `src-tauri/tauri.conf.json` — three places, kept in sync
  (currently `1.3.3`). `.side` is a flex column so `.side-scroll` fills and `.version` pins
  below.
- **Reorder helpers:** `moveToIndex` (`src/lib/reorder.ts`, pure, unit-tested) + the
  `useListReorder` composable (`src/lib/listDrag.ts`) drive the settings tables' pointer
  drag (same pointerdown/move/up + midpoint-insertion approach as the kanban `drag.ts`).
  The sidebar just **lists** projects now — its old ▲▼ sort buttons were removed.
- **Cards show the truncated markdown body** — there is no title field.
- **Favorites** (`is_favorite` on projects+tasks): pinned on top — a "Favorites"
  sidebar group, and above a divider in each lane. Favorite status changes only
  via the **star**, never by dragging across the divider.
- **Reordering** is slot-precise and group-aware: `computeLaneOrder`
  (`src/lib/reorder.ts`) + `tasks.reorderLane`, driven by the pointer-drag manager
  (hit-test → insertion index from card midpoints). Favorites stay pinned; drag is
  disabled while a search filter is active (tap still opens the modal).
- **Live search**: `matchesQuery` (`src/lib/search.ts`) — full body text, `*`/`?`
  wildcards, dotAll (spans newlines). Header search drives both board and archive.
- **SQL**: always bound `$n` params (never string-interpolate). `datetime('now')`
  for timestamps.
- **Editor saves** are debounced + optimistic (`tasks.updateBody`); `flushBody` is
  called on modal pipeline/close so nothing is lost.
- **One Tauri builder chain** in `lib.rs` — add plugins (`sql`, `dialog`) and the
  log `.setup()` + the single `.invoke_handler` to the SAME chain, never a second.

## Gotchas
- **Native `::-webkit-scrollbar` is unreliable in the app's WKWebView for STATE-driven
  styling** (e.g. reveal-on-`:hover` doesn't repaint the scrollbar), and the Chromium
  test harness renders scrollbars differently (overlay/0-width), so you can't verify a
  native-scrollbar behavior there. For hidden-until-hover or any dynamic scrollbar, hide
  the native one (`scrollbar-width:none` + `::-webkit-scrollbar{display:none}`) and draw a
  **custom overlay `<div>` thumb** from scroll metrics (`scrollTop`/`scrollHeight`/
  `clientHeight`) — a `<div>` renders identically in WKWebView and the harness, so it's
  consistent AND verifiable. The always-on global 10px `::-webkit-scrollbar` (theme.css)
  is fine; only state-driven reveal is the problem. This is packaged as the reusable
  **`OverlayScrollbar`** (`src/components/OverlayScrollbar.vue`): pass it the scroll element
  (`:view`, a div OR a `<textarea>`) and it renders the hidden-until-hover, drag-scrollable
  thumb (self-contained scroll/input/Resize/Mutation observers + pointerenter/leave hover).
  **Consumer contract:** the view sits in a `position:relative` wrapper, the component is a
  SIBLING inside it, and the view carries the global `.no-native-scrollbar` class. Applied
  to: pipeline feed, project sidebar, every kanban lane, the three task-modal columns
  (checklist / editor `<textarea>` / preview), the settings body, the harness setup modal.
  **Never add a raw native scroll area — use `OverlayScrollbar`.**
- **A flex `<input>` with `flex:1` needs `min-width:0`**, else it can't shrink below its
  intrinsic width and forces horizontal overflow in a narrow column (was the task-modal
  checklist's horizontal scrollbar). See `ChecklistColumn` `.txt`.
- **`node`/`npm`/`npx` are broken nvm shell functions in non-interactive shells.**
  Prefix every toolchain command with:
  `unset -f node npm npx nvm 2>/dev/null; export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$HOME/.cargo/bin:$PATH"`
- Rust toolchain is now **native `aarch64-apple-darwin`** (reinstalled from the old Rosetta
  x86_64 install; `rustc -vV` host = aarch64) at 1.97; Tauri 2 needs ≥1.77. For a universal
  release DMG add the Intel target (`rustup target add x86_64-apple-darwin`) and build
  `--target universal-apple-darwin`.
- **Bundle identifier is `at.ultraprompt`** (`src-tauri/tauri.conf.json`). NB:
  changing the identifier moved the app-data dir, so the app opens a fresh DB.
  Developer-ID signing + notarization + a universal `.dmg` are set up (a real signed,
  notarized, stapled build shipped) — see **`RELEASE.md`** (signing needs your Apple
  identity via `APPLE_*` env). Cross-build: Tauri can't cross-compile from macOS, so Linux
  builds in Docker (`scripts/build-linux.sh`; native arm64 → `.deb`/`.rpm`/`.AppImage`, but
  the **emulated x86_64** build is `.deb`/`.rpm` only — `linuxdeploy` can't build the
  AppImage under QEMU, so an x86_64 AppImage needs a native x86_64 host/CI; the script
  auto-skips AppImage when target arch ≠ host). Windows needs a real Windows env. MAS is
  code-unblocked (bookmarks) but not submitted.
- **Overlay z-index ladder** (keep new overlays consistent): TaskModal backdrop
  `50` < SettingsModal `60` < HarnessPrompt setup-prompt modal `70` < Toast `1200`.
  The setup-prompt modal `<teleport to="body">`'s from `AppShell` so it escapes any
  parent stacking context; scoped styles still apply to teleported nodes.

## Run & verify
- **Launch the app:** `npm run tauri dev` (opens the native window; it *blocks*, so
  don't run it inside a headless subagent). Production bundle: `npm run tauri build`.
- **Tests:** `npm test` (Vitest) and `cargo test --manifest-path src-tauri/Cargo.toml`.
  Type/build: `npx vue-tsc --noEmit` + `npm run build`.
- **Headless visual/e2e check:** the app's data needs the Tauri bridge, absent in a
  plain browser. A reusable **Playwright + `sql.js`** harness lives at `.harness/`
  (gitignored session scratch): `vite.harness.config.ts` aliases the Tauri modules
  to `mock-sql.ts` (in-memory DB seeded from the real schema, exposed as
  `window.__db`), `mock-core.ts` (invoke — `pipeline_task`/`list_queue_status`/
  `import_markdown_dir`, driver-controllable via `window.__processingFiles`/
  `__doneFiles`/`__importBodies`), and `mock-dialog.ts` (`open` → `window.__pickDir`).
  Pointer events reproduce 1:1. Run: `npx vite --config .harness/vite.harness.config.ts`
  (bg, port 5174), then `node .harness/driveN.mjs` — `drive.mjs`..`drive11.mjs`
  (assert against `window.__db` + screenshots to `.harness/shots/`; later drivers:
  9 harness-loop tweaks, 10 settings clear-tasks, 11 task-modal actions). `AppShell`
  exposes dev-only `window.__pollDone()`, `__reloadPipelined()`, and **`__reload()`**
  (reloads ALL stores from the mock DB WITHOUT a page reload — a `page.reload()` re-seeds
  the in-memory mock DB, wiping any rows a driver inserted, so use `__reload()` after
  seeding). `screencapture` of the native window is blocked (no Screen-Recording perm).
- **To SHOW the user a screenshot/visual comparison, use `SendUserFile`** — `Read`-ing an
  image only renders it for the agent, not the user. For a visual A/B/C choice, render the
  variants on the REAL component (inject CSS via a driver, no source change), montage them
  into one image, `SendUserFile` it, then ask.
