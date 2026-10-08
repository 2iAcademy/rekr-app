#!/usr/bin/env bash
# Builds the three production images and pushes them to the registry, tagged
# with the commit hash. Called by .github/workflows/ci-cd.yml, but plain
# Docker: another CI runs it the same way, once logged in to its registry.
#
#   REGISTRY=ghcr.io/2iacademy IMAGE_TAG=<commit> scripts/ci/build-images.sh
#
# Images:
#   rekr-backend  the API (backend, target `runner`)
#   rekr-migrate  Prisma migrations (backend, target `common`, has the CLI)
#   rekr-web      Caddy, with the front build and the Caddyfile inside
#
# `main` moves to the last image built. The server never uses it: it pulls by
# commit hash, so a rollback is only a matter of pointing IMAGE_TAG back.
#
# Optional: VITE_SENTRY_DSN (inlined in the front build), SOURCE_URL (links
# the images to the repository on GHCR), PUSH=0 to build into the local
# Docker only.
set -euo pipefail

: "${REGISTRY:?REGISTRY is required, e.g. ghcr.io/2iacademy}"
: "${IMAGE_TAG:?IMAGE_TAG is required, the commit hash}"
PUSH="${PUSH:-1}"

cd "$(dirname "$0")/../.."

build() {
  local name="$1"
  shift
  local image="$REGISTRY/$name"
  local args=(
    --tag "$image:$IMAGE_TAG"
    --tag "$image:main"
    --label "org.opencontainers.image.revision=$IMAGE_TAG"
  )
  if [[ -n "${SOURCE_URL:-}" ]]; then
    args+=(--label "org.opencontainers.image.source=$SOURCE_URL")
  fi
  if [[ "$PUSH" == 1 ]]; then
    # Layers cached in the registry next to the image: the next build only
    # redoes what changed, whatever runner it lands on.
    args+=(
      --push
      --cache-from "type=registry,ref=$image:buildcache"
      --cache-to "type=registry,ref=$image:buildcache,mode=max"
    )
  else
    args+=(--load)
  fi
  echo "build-images: $image:$IMAGE_TAG"
  docker buildx build "${args[@]}" "$@"
}

build rekr-backend --target runner ./backend
build rekr-migrate --target common ./backend
build rekr-web --target prod \
  --build-context rekr-caddy=./docker/caddy \
  --build-arg "VITE_SENTRY_DSN=${VITE_SENTRY_DSN:-}" \
  --build-arg VITE_SENTRY_ENVIRONMENT=production \
  ./clientApp
