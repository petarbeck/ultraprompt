# Releasing Ultraprompt

How to build, sign, and distribute the app. Two macOS distribution paths:

| | Developer-ID `.dmg` (recommended first) | Mac App Store (MAS) |
|---|---|---|
| Distribute via | GitHub Releases / your site | App Store |
| Gatekeeper | Clean once notarized | Clean |
| Sandbox | **No** (pipeline works as-is) | **Yes** — needs code changes (see below) |
| Effort | Low | High |

## 1. Build locally

Prereqs: Node 22, a **native** Rust toolchain (on Apple Silicon: `rustup default
stable-aarch64-apple-darwin` — `rustc -vV` should show `host: aarch64-apple-darwin`),
Xcode Command Line Tools.

```sh
npm install
npm run tauri build                                   # host arch (e.g. arm64) → target/release/bundle/
npm run tauri build -- --target universal-apple-darwin  # universal (Intel + Apple Silicon), recommended for release
```

> Note: a plain `npm run tauri build` on Apple Silicon produces a native **arm64** app, but
> Tauri labels the host-build DMG `_x64` (cosmetic). Build with `--target
> universal-apple-darwin` (add both `rustup target add aarch64-apple-darwin
> x86_64-apple-darwin`) for a correctly-named universal DMG that runs on every Mac.

Output: `Ultraprompt.app` and `Ultraprompt_<version>_*.dmg` under
`src-tauri/target/**/release/bundle/`.

## 2. Developer-ID: sign + notarize

You need an **Apple Developer account** and a *Developer ID Application* certificate in your
login keychain. Then set these env vars and build — Tauri signs + notarizes automatically:

```sh
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
export APPLE_ID="you@example.com"
export APPLE_PASSWORD="app-specific-password"   # appleid.apple.com → App-Specific Passwords
export APPLE_TEAM_ID="TEAMID"
npm run tauri build -- --target universal-apple-darwin
```

The resulting `.dmg` opens cleanly (no Gatekeeper prompt). Verify with
`spctl -a -vvv Ultraprompt.app` and `codesign -dv --verbose=4 Ultraprompt.app`.

## 3. Automated releases (GitHub Actions)

`.github/workflows/release.yml` builds macOS (universal) + Windows + Linux and attaches the
installers to a **draft** GitHub release when you push a tag:

```sh
git tag v1.3.3 && git push origin v1.3.3
```

To sign + notarize the macOS build in CI, add these repo **secrets** (Settings → Secrets →
Actions); without them the macOS artifact is unsigned (ad-hoc):

- `APPLE_CERTIFICATE` — base64 of your `.p12`: `base64 -i cert.p12 | pbcopy`
- `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`

Windows/Linux build unsigned by default (Windows code-signing is a separate cert if you want it).

## 3b. Building Linux (and Windows) yourself — no CI

Tauri can't cross-compile from macOS (each OS links its own native webview), so other
platforms must be built on that OS.

**Linux — via Docker, from your Mac.** A Linux container does the real build and copies the
bundles to `dist/linux/`:

```sh
scripts/build-linux.sh          # x86_64 → .deb + .rpm (most Linux desktops; QEMU-emulated on Apple Silicon)
scripts/build-linux.sh arm64    # arm64 → .deb + .rpm + .AppImage (native, fast on Apple Silicon)
```

Requires Docker Desktop running (amd64 emulation is on by default). The container installs
Tauri's Linux deps (webkit2gtk 4.1) + Node + Rust — see `docker/linux.Dockerfile`.

**AppImage caveat:** the AppImage bundler (`linuxdeploy`, itself an AppImage) can't run under
QEMU emulation, so the **emulated x86_64 build produces `.deb` + `.rpm` only** (the script
auto-skips AppImage when the target arch ≠ host arch). `.deb`/`.rpm` cover Debian/Ubuntu and
Fedora. For a portable **x86_64 `.AppImage`**, build on a **native x86_64 Linux** host (a
VM, an x86_64 machine, or the CI runner). The native arm64 build makes its `.AppImage` fine.

**Windows.** Needs an actual Windows environment — a VM on your Mac (Parallels/UTM + Windows
11) or a Windows PC. Install Rust (MSVC toolchain), Node 22, and the WebView2 runtime, then
`npm run tauri build` produces the `.msi` / NSIS installer. There is no reliable Mac→Windows
cross-build.

## 4. Mac App Store (MAS)

The **sandbox blocker is resolved in code.** Ultraprompt writes `.ultraprompt/queue/*.md`
into each project's user-picked working directory, which the App Sandbox forbids by default.
Now:

- Picking a working dir (`ProjectEditModal`) calls `create_working_dir_bookmark`, which
  creates a **security-scoped bookmark** (`src-tauri/src/bookmark.rs`) stored in
  `projects.working_dir_bookmark` (migration v5).
- The FS commands (`pipeline_task` / `revoke_queued` / `list_queue_status`) take that
  bookmark and run their filesystem work inside `bookmark::access(...)`, which resolves the
  bookmark and brackets the ops with `start/stopAccessingSecurityScopedResource`.
- It's a **no-op off the sandbox** (Developer-ID / dev builds pass `None` and behave
  identically), so the same code ships to both channels. **Caveat:** the sandbox *grant*
  itself can only be verified in a signed, MAS-entitled build — it compiles and the
  unsandboxed path is tested, but exercise it in a real MAS build before shipping.

Remaining MAS steps (need your Apple account):

1. In App Store Connect, create the app record (bundle id `at.ultraprompt`).
2. Certificates: *Apple Distribution* + *Mac Installer Distribution*; a *Mac App Store*
   provisioning profile.
3. Build the MAS `.pkg` with `src-tauri/entitlements.mas.plist` applied (a MAS-only
   `--config` override that sets `bundle.macOS.entitlements`, so the Developer-ID build
   stays un-sandboxed). Sign the `.app` with Apple Distribution and the `.pkg` with the
   installer identity.
4. Upload with Transporter / `xcrun notarytool`, then submit for review.

Still, **ship Developer-ID first** (simpler, no review); MAS is now unblocked as a follow-up.

## 5. Demo data for screenshots

To capture App Store / marketing screenshots without touching your real database
(`~/Library/Application Support/at.ultraprompt/ultraprompt.db`):

1. Temporarily build a **demo variant** with a different identifier so it gets its own
   app-data dir: set `identifier` to `at.ultraprompt.demo` in `src-tauri/tauri.conf.json`,
   `npm run tauri build`, and run the demo app once (creates a fresh DB, migrations applied).
2. Seed it: `sqlite3 "~/Library/Application Support/at.ultraprompt.demo/ultraprompt.db" < scripts/seed-demo.sql`
3. Relaunch the demo app and capture screenshots. Discard the demo build afterward.

Your personal DB (identifier `at.ultraprompt`) is never touched. The README's screenshots in
`docs/screenshots/` were generated the same way via the headless harness.

## 6. Versioning

Bump the version in **three** places together (see CLAUDE.md): `package.json`,
`src-tauri/tauri.conf.json`, and `src/version.ts`. Tag matches (`vX.Y.Z`).
