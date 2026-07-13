#!/usr/bin/env bash
# Build the Linux bundles (.deb + .AppImage) in a Docker container and copy them out to
# ./dist/linux/. Works from macOS (Tauri can't cross-compile to Linux natively).
#
# Usage:
#   scripts/build-linux.sh            # x86_64 (linux/amd64) — most desktop users; slow via QEMU on Apple Silicon
#   scripts/build-linux.sh arm64      # arm64 (linux/arm64)  — native/fast on Apple Silicon
#
# Requires Docker Desktop running (with amd64 emulation enabled, which is the default).
set -euo pipefail

ARCH="${1:-amd64}"
case "$ARCH" in
  amd64|x86_64) PLATFORM="linux/amd64" ;;
  arm64|aarch64) PLATFORM="linux/arm64" ;;
  *) echo "unknown arch '$ARCH' (use amd64 or arm64)"; exit 1 ;;
esac

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$REPO_ROOT/dist/linux"
IMAGE="ultraprompt-linux-build:$ARCH"
mkdir -p "$OUT"

# AppImage (linuxdeploy) can't run under QEMU emulation — when the target arch differs
# from the host arch, skip it and build .deb + .rpm only (an x86_64 AppImage needs a
# native x86_64 Linux host or CI).
norm() { case "$1" in x86_64|amd64) echo amd64;; arm64|aarch64) echo arm64;; *) echo "$1";; esac; }
BUNDLES=""; NOTE=""
if [ "$(norm "$(uname -m)")" != "$(norm "${PLATFORM##*/}")" ]; then
  BUNDLES="deb,rpm"
  NOTE=" (emulated — slower; .deb + .rpm only, AppImage needs a native ${PLATFORM##*/} host)"
fi
echo "==> Building Linux bundles for $PLATFORM$NOTE. This can take a while..."
docker build --platform "$PLATFORM" --build-arg "BUNDLES=$BUNDLES" \
  -f "$REPO_ROOT/docker/linux.Dockerfile" -t "$IMAGE" "$REPO_ROOT"

echo "==> Extracting bundles -> $OUT"
cid="$(docker create --platform "$PLATFORM" "$IMAGE")"
trap 'docker rm -f "$cid" >/dev/null 2>&1 || true' EXIT
for kind in deb appimage rpm; do
  docker cp "$cid:/app/src-tauri/target/release/bundle/$kind/." "$OUT/" 2>/dev/null || true
done
# Keep only the final artifacts, not the bundlers' staging dirs.
find "$OUT" -mindepth 1 -maxdepth 1 -type d -exec rm -rf {} +

echo "==> Done. Linux bundles:"
ls -lh "$OUT"
