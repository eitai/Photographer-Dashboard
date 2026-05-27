#!/usr/bin/env bash
#
# bootstrap.sh — install pinned compression binaries to /usr/local/bin/photo-*
#
# Run as root on the production box ONCE during initial setup, and again any
# time you bump a pinned version. Idempotent: re-running with unchanged pins
# is a no-op.
#
# ============================================================================
# !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
# !!  PLACEHOLDERS BELOW MUST BE FILLED IN BEFORE THIS SCRIPT WILL RUN.    !!
# !!  Look for: EXPECTED_SHA256_PLACEHOLDER_REPLACE_BEFORE_USE             !!
# !!                                                                       !!
# !!  For each binary:                                                     !!
# !!    1. Visit the GitHub Releases page (URL in the variable comment).   !!
# !!    2. Confirm the URL still resolves, or update it to the current     !!
# !!       release asset for linux-x86_64.                                 !!
# !!    3. Download the asset and compute sha256:                          !!
# !!         curl -fsSL <url> | sha256sum                                  !!
# !!    4. Paste the 64-char hex into the EXPECTED_SHA256_<NAME> variable. !!
# !!    5. Confirm the EXPECTED_VERSION_PREFIX_<NAME> matches `--version`  !!
# !!       output of the release.                                          !!
# !!                                                                       !!
# !!  DO NOT silence the placeholder check. The script aborts on purpose.  !!
# !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
# ============================================================================

set -euo pipefail
IFS=$'\n\t'

# ---------- root check ----------
if [ "${EUID}" -ne 0 ]; then
  echo "bootstrap.sh: must run as root" >&2
  exit 1
fi

# ---------- platform sanity ----------
ARCH="$(uname -m)"
KERNEL="$(uname -s)"
if [ "${KERNEL}" != "Linux" ] || [ "${ARCH}" != "x86_64" ]; then
  echo "bootstrap.sh: this script targets Linux x86_64 only (got ${KERNEL}/${ARCH})" >&2
  exit 1
fi

# ---------- pinned versions ----------
# libjxl (provides cjxl + djxl)
# Releases:           https://github.com/libjxl/libjxl/releases
# Choose the static linux-x86_64 tarball from a stable tag (0.11.x as of Q1 2026).
LIBJXL_VERSION="0.11.1"
LIBJXL_URL="https://github.com/libjxl/libjxl/releases/download/v${LIBJXL_VERSION}/jxl-linux-x86_64-static-v${LIBJXL_VERSION}.tar.gz"
LIBJXL_SHA256="EXPECTED_SHA256_PLACEHOLDER_REPLACE_BEFORE_USE"   # TODO ops: paste sha256 of the tarball
LIBJXL_VERSION_PREFIX="cjxl v${LIBJXL_VERSION}"                  # TODO ops: confirm matches `cjxl --version`

# oxipng
# Releases: https://github.com/shssoichiro/oxipng/releases
OXIPNG_VERSION="9.1.5"
OXIPNG_URL="https://github.com/shssoichiro/oxipng/releases/download/v${OXIPNG_VERSION}/oxipng-${OXIPNG_VERSION}-x86_64-unknown-linux-musl.tar.gz"
OXIPNG_SHA256="EXPECTED_SHA256_PLACEHOLDER_REPLACE_BEFORE_USE"   # TODO ops
OXIPNG_VERSION_PREFIX="oxipng ${OXIPNG_VERSION}"                  # TODO ops: confirm

# ---------- placeholder guard ----------
PLACEHOLDER="EXPECTED_SHA256_PLACEHOLDER_REPLACE_BEFORE_USE"
if [ "${LIBJXL_SHA256}" = "${PLACEHOLDER}" ] \
   || [ "${OXIPNG_SHA256}" = "${PLACEHOLDER}" ]; then
  cat >&2 <<'MSG'

==============================================================================
  bootstrap.sh: refusing to run with placeholder SHA-256 values.

  Open ops/bootstrap.sh and replace every instance of
    EXPECTED_SHA256_PLACEHOLDER_REPLACE_BEFORE_USE
  with the real sha256 of the corresponding release asset.

  See the comment block at the top of this script for instructions.
==============================================================================

MSG
  exit 1
fi

# ---------- helpers ----------
log() { printf '[bootstrap] %s\n' "$*"; }

# verify_sha256 <file> <expected_hex>
verify_sha256() {
  local file="$1" expected="$2" actual
  actual="$(sha256sum "${file}" | awk '{print $1}')"
  if [ "${actual}" != "${expected}" ]; then
    echo "sha256 mismatch for ${file}" >&2
    echo "  expected: ${expected}" >&2
    echo "  actual:   ${actual}" >&2
    return 1
  fi
}

# already_installed <dest> <version_prefix>
# Returns 0 if dest exists and `<dest> --version` output starts with version_prefix.
already_installed() {
  local dest="$1" prefix="$2"
  [ -x "${dest}" ] || return 1
  # Some tools print version on stderr. Merge streams.
  local out
  if ! out="$("${dest}" --version 2>&1 | head -n 1)"; then
    return 1
  fi
  case "${out}" in
    "${prefix}"*) return 0 ;;
    *)            return 1 ;;
  esac
}

# install_one <name> <url> <sha256> <version_prefix> <archive_member_path>
# Downloads url, verifies sha, extracts, copies the archive_member_path to
# /usr/local/bin/photo-<name>, chmods +x, and asserts version prefix.
install_one() {
  local name="$1" url="$2" sha="$3" prefix="$4" member="$5"
  local dest="/usr/local/bin/photo-${name}"

  if already_installed "${dest}" "${prefix}"; then
    log "${name}: already at ${prefix} (skip)"
    return 0
  fi

  local tmp
  tmp="$(mktemp -d -t photo-bootstrap-XXXXXX)"
  trap 'rm -rf "${tmp}"' RETURN

  log "${name}: downloading ${url}"
  curl -fsSL --retry 3 --retry-delay 2 -o "${tmp}/asset" "${url}"

  log "${name}: verifying sha256"
  verify_sha256 "${tmp}/asset" "${sha}"

  log "${name}: extracting"
  case "${url}" in
    *.tar.gz|*.tgz) tar -xzf "${tmp}/asset" -C "${tmp}" ;;
    *.tar.xz)       tar -xJf "${tmp}/asset" -C "${tmp}" ;;
    *.zip)          unzip -q "${tmp}/asset" -d "${tmp}" ;;
    *)
      # Single binary, not an archive
      cp "${tmp}/asset" "${tmp}/${member}"
      ;;
  esac

  if [ ! -f "${tmp}/${member}" ]; then
    echo "expected archive member not found: ${tmp}/${member}" >&2
    echo "archive contents:" >&2
    find "${tmp}" -maxdepth 4 -type f >&2 || true
    return 1
  fi

  log "${name}: installing to ${dest}"
  install -m 0755 -o root -g root "${tmp}/${member}" "${dest}"

  log "${name}: asserting --version starts with '${prefix}'"
  local out
  out="$("${dest}" --version 2>&1 | head -n 1)"
  case "${out}" in
    "${prefix}"*)
      log "${name}: OK -> ${out}"
      ;;
    *)
      echo "${name}: version assertion failed" >&2
      echo "  expected prefix: ${prefix}" >&2
      echo "  got:             ${out}" >&2
      return 1
      ;;
  esac
}

# ---------- libjxl (cjxl + djxl) ----------
# The libjxl static tarball typically extracts to:
#   jxl-linux-x86_64-static-v<ver>/tools/cjxl
#   jxl-linux-x86_64-static-v<ver>/tools/djxl
# TODO ops: confirm the extracted layout after first download and adjust
# LIBJXL_CJXL_MEMBER / LIBJXL_DJXL_MEMBER below if it differs.
LIBJXL_CJXL_MEMBER="jxl-linux-x86_64-static-v${LIBJXL_VERSION}/tools/cjxl"
LIBJXL_DJXL_MEMBER="jxl-linux-x86_64-static-v${LIBJXL_VERSION}/tools/djxl"
DJXL_VERSION_PREFIX="djxl v${LIBJXL_VERSION}"   # TODO ops: confirm

# install_libjxl_tools — downloads the libjxl tarball ONCE and installs both
# cjxl and djxl from the same verified archive. Calling install_one twice
# (the previous approach) re-downloaded the tarball, so if upstream rotated
# release assets between calls the two binaries could come from different
# archives — defeating the SHA-256 pin. Single-download is the only way to
# guarantee both binaries are from the same verified bytes.
install_libjxl_tools() {
  local cjxl_dest="/usr/local/bin/photo-cjxl"
  local djxl_dest="/usr/local/bin/photo-djxl"

  # Both already at the right version — skip the whole song and dance.
  if already_installed "${cjxl_dest}" "${LIBJXL_VERSION_PREFIX}" \
     && already_installed "${djxl_dest}" "${DJXL_VERSION_PREFIX}"; then
    log "libjxl: cjxl and djxl already at v${LIBJXL_VERSION} (skip)"
    return 0
  fi

  local tmp
  tmp="$(mktemp -d -t photo-bootstrap-libjxl-XXXXXX)"
  trap 'rm -rf "${tmp}"' RETURN

  log "libjxl: downloading ${LIBJXL_URL}"
  curl -fsSL --retry 3 --retry-delay 2 -o "${tmp}/asset" "${LIBJXL_URL}"

  log "libjxl: verifying sha256"
  verify_sha256 "${tmp}/asset" "${LIBJXL_SHA256}"

  log "libjxl: extracting"
  case "${LIBJXL_URL}" in
    *.tar.gz|*.tgz) tar -xzf "${tmp}/asset" -C "${tmp}" ;;
    *.tar.xz)       tar -xJf "${tmp}/asset" -C "${tmp}" ;;
    *.zip)          unzip -q "${tmp}/asset" -d "${tmp}" ;;
    *)
      echo "libjxl: unsupported archive type: ${LIBJXL_URL}" >&2
      return 1
      ;;
  esac

  # install_member <member_path> <dest> <version_prefix>
  install_member() {
    local member="$1" dest="$2" prefix="$3"
    if [ ! -f "${tmp}/${member}" ]; then
      echo "libjxl: expected archive member not found: ${tmp}/${member}" >&2
      echo "archive contents:" >&2
      find "${tmp}" -maxdepth 4 -type f >&2 || true
      return 1
    fi
    log "libjxl: installing ${member} -> ${dest}"
    install -m 0755 -o root -g root "${tmp}/${member}" "${dest}"
    log "libjxl: asserting ${dest} --version starts with '${prefix}'"
    local out
    out="$("${dest}" --version 2>&1 | head -n 1)"
    case "${out}" in
      "${prefix}"*)
        log "libjxl: OK -> ${out}"
        ;;
      *)
        echo "libjxl: version assertion failed for ${dest}" >&2
        echo "  expected prefix: ${prefix}" >&2
        echo "  got:             ${out}" >&2
        return 1
        ;;
    esac
  }

  install_member "${LIBJXL_CJXL_MEMBER}" "${cjxl_dest}" "${LIBJXL_VERSION_PREFIX}"
  install_member "${LIBJXL_DJXL_MEMBER}" "${djxl_dest}" "${DJXL_VERSION_PREFIX}"
}

install_libjxl_tools

# ---------- oxipng ----------
# Archive layout: oxipng-<ver>-x86_64-unknown-linux-musl/oxipng
OXIPNG_MEMBER="oxipng-${OXIPNG_VERSION}-x86_64-unknown-linux-musl/oxipng"
install_one "oxipng" "${OXIPNG_URL}" "${OXIPNG_SHA256}" "${OXIPNG_VERSION_PREFIX}" "${OXIPNG_MEMBER}"

log "all binaries installed:"
ls -l /usr/local/bin/photo-cjxl /usr/local/bin/photo-djxl \
      /usr/local/bin/photo-oxipng

log "done."
