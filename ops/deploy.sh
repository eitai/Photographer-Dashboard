#!/usr/bin/env bash
#
# deploy.sh — rolling deployment for Photographer-Dashboard.
#
# Production deployment. Test in staging first. Database migrations are
# idempotent and run on app boot — this script does NOT run migrations
# directly.
#
# Run as the `photo` user. Requires a sudoers entry that lets `photo` restart
# the two services (see ops/README.md section 6.1).
#
# Usage:
#   sudo -u photo bash /opt/photo/ops/deploy.sh             # deploy origin/main
#   sudo -u photo bash /opt/photo/ops/deploy.sh release/x   # deploy a branch/tag

set -euo pipefail
IFS=$'\n\t'

# Parse args: optional --force may appear as the first or second positional.
# Usage: deploy.sh [ref] [--force]    OR    deploy.sh --force [ref]
FORCE=0
ARGS=()
for arg in "$@"; do
  if [ "${arg}" = "--force" ]; then
    FORCE=1
  else
    ARGS+=("${arg}")
  fi
done
REF="${ARGS[0]:-main}"
REPO_DIR="/opt/photo"
# Readiness URL: 200 only when DB, S3/Wasabi, and pg-boss are all reachable.
# Plain /api/health returns 200 as soon as Express binds the port, which is
# not enough to gate a deploy.
READY_URL="http://localhost:5000/api/health/ready"

log() { printf '[deploy] %s\n' "$*"; }

# ---------- safety ----------
if [ "$(id -un)" != "photo" ]; then
  echo "deploy.sh: must run as user 'photo' (got $(id -un))" >&2
  exit 1
fi

if [ ! -d "${REPO_DIR}/.git" ]; then
  echo "deploy.sh: ${REPO_DIR} is not a git checkout" >&2
  exit 1
fi

cd "${REPO_DIR}"

# ---------- record what we're replacing, in case we need to roll back manually ----------
PREV_SHA="$(git rev-parse HEAD)"
log "current HEAD: ${PREV_SHA}"
log "deploying ref: ${REF}"

# ---------- dirty tree guard ----------
# `git reset --hard` later in this script silently destroys local edits. Refuse
# to deploy with uncommitted changes unless the operator explicitly opts in
# with --force.
if [ -n "$(git status --porcelain)" ]; then
  echo "deploy.sh: working tree is dirty, refusing to deploy" >&2
  echo "  use --force to override (will discard local changes)" >&2
  git status --short >&2
  if [ "${FORCE}" -ne 1 ]; then
    exit 1
  fi
  log "WARNING: --force given, proceeding despite dirty tree"
fi

# ---------- pull ----------
log "git fetch --all --tags --prune"
git fetch --all --tags --prune

# Resolve ref. Prefer origin/<ref> (tracks remote) if it exists, else use ref
# directly (tag, full SHA, etc.).
TARGET="${REF}"
if git rev-parse --verify --quiet "origin/${REF}" >/dev/null; then
  TARGET="origin/${REF}"
fi

log "git reset --hard ${TARGET}"
git reset --hard "${TARGET}"
NEW_SHA="$(git rev-parse HEAD)"
log "new HEAD: ${NEW_SHA}"

if [ "${PREV_SHA}" = "${NEW_SHA}" ]; then
  log "no changes since last deploy; restarting services anyway for config refresh"
fi

# ---------- backend ----------
log "backend: npm ci --omit=dev"
( cd backend && npm ci --omit=dev )

# ---------- frontend ----------
# The frontend is a Vite build; we install full deps (build needs devDeps),
# build, then leave node_modules in place — disk is cheap, rebuild speed isn't.
if [ -d "frontend" ]; then
  log "frontend: npm ci"
  ( cd frontend && npm ci )
  log "frontend: npm run build"
  ( cd frontend && npm run build )
else
  log "frontend: directory not present, skipping"
fi

# ---------- restart ----------
# `photo` user must have sudoers entry permitting these exact commands; see
# /etc/sudoers.d/photo-deploy in ops/README.md.
log "restarting services"
sudo /bin/systemctl restart photo-api photo-worker

# Brief pause for the API to bind its port; replace with proper readiness loop
# if you ever need < 1s deploys.
sleep 2

# ---------- post-restart logs ----------
log "--- last 50 lines of photo-api ---"
journalctl -u photo-api -n 50 --no-pager || true
log "--- last 50 lines of photo-worker ---"
journalctl -u photo-worker -n 50 --no-pager || true

# ---------- readiness check ----------
# Poll up to 5 times (10s total) for /api/health/ready to return 200. The
# readiness endpoint verifies DB + S3 + queue, so a 200 means every external
# dep is actually reachable — not just that Express bound its port.
log "readiness check: ${READY_URL}"
READY_OK=0
for i in 1 2 3 4 5; do
  if curl -sf "${READY_URL}" > /dev/null; then
    log "readiness check passed (attempt ${i})"
    READY_OK=1
    break
  fi
  sleep 2
done

if [ "${READY_OK}" -ne 1 ]; then
  echo "deploy.sh: readiness check failed after 5 attempts" >&2
  # Capture the last response body for debugging
  curl -sS -o /tmp/photo-health.$$ "${READY_URL}" || true
  echo "last response body:" >&2
  cat /tmp/photo-health.$$ >&2 || true
  rm -f /tmp/photo-health.$$
  echo "previous SHA was ${PREV_SHA}; to roll back manually:" >&2
  echo "  git reset --hard ${PREV_SHA}" >&2
  echo "  cd backend && npm ci --omit=dev" >&2
  echo "  ( cd ../frontend && npm ci && npm run build )" >&2
  echo "  sudo /bin/systemctl restart photo-api photo-worker" >&2
  exit 1
fi

log "deployed ${NEW_SHA} successfully"
