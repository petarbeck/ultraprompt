# Build the Linux bundles (.deb + .AppImage) from any host via Docker.
# Tauri can't cross-compile from macOS (per-OS webview), so we build inside a real Linux
# container. On Apple Silicon, `--platform linux/amd64` builds x86_64 (QEMU-emulated,
# slower); the default arm64 build is native/fast. See scripts/build-linux.sh.
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
# Tauri v2 Linux prerequisites (webkit2gtk 4.1) + build toolchain.
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl wget ca-certificates file build-essential pkg-config libssl-dev \
      libwebkit2gtk-4.1-dev libgtk-3-dev librsvg2-dev libxdo-dev \
      libayatana-appindicator3-dev patchelf \
    && rm -rf /var/lib/apt/lists/*

# Node 22
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs && rm -rf /var/lib/apt/lists/*

# Rust (stable, for the container's native arch)
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal
ENV PATH="/root/.cargo/bin:${PATH}"
# Run AppImage tools (linuxdeploy) without FUSE — needed in containers, and lets the
# AppImage bundle build under QEMU emulation (the x86_64 build on an Apple Silicon host).
ENV APPIMAGE_EXTRACT_AND_RUN=1

WORKDIR /app
# Source is COPYed (not mounted) so the Linux build never touches the host's macOS
# node_modules / target. See .dockerignore for what's excluded.
COPY . .
# BUNDLES limits the bundle formats (e.g. "deb,rpm"). Needed for the emulated x86_64
# build: linuxdeploy (AppImage) can't run under QEMU, so we skip AppImage there. Empty =
# all formats (native arm64 build makes the AppImage too).
ARG BUNDLES=""
RUN npm ci && \
    if [ -n "$BUNDLES" ]; then npm run tauri build -- --bundles "$BUNDLES"; \
    else npm run tauri build; fi
# Bundles land in /app/src-tauri/target/release/bundle/{deb,rpm,appimage}/
