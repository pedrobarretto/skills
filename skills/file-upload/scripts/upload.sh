#!/usr/bin/env bash

# Uploads local files to the file-upload R2 bucket and prints one public URL per
# file. Authenticates through Wrangler's durable login (`wrangler login`), so no
# credential is stored by this script.

set -euo pipefail

readonly CONFIG_ROOT="${XDG_CONFIG_HOME:-${HOME}/.config}/file-upload"
readonly CONFIG_FILE="${FILE_UPLOAD_CONFIG:-${CONFIG_ROOT}/config}"
# Wrangler writes a `.wrangler/` cache into its working directory, and a
# `.wrangler/` in $HOME shadows its login. Always run it from here instead.
readonly RUNTIME_DIR="${CONFIG_ROOT}/runtime"
readonly WRANGLER_VERSION="4.163.0"
readonly DEFAULT_BUCKET="file-upload"
readonly MAX_BYTES=$((300 * 1024 * 1024))

usage() {
  cat <<'EOF'
Usage:
  upload.sh --configure
  upload.sh <path-to-file> [more-files...]

Optional environment variables:
  FILE_UPLOAD_BASE_URL  Override the configured public base URL.
  FILE_UPLOAD_BUCKET    Override the configured R2 bucket name.
  FILE_UPLOAD_CONFIG    Override the configuration file path.
  CLOUDFLARE_ACCOUNT_ID Pick the account when the Wrangler login sees several.
EOF
}

wrangler() {
  mkdir -p "${RUNTIME_DIR}"
  (cd "${RUNTIME_DIR}" && WRANGLER_SEND_METRICS=false npx --yes "wrangler@${WRANGLER_VERSION}" "$@")
}

# Explains the one login failure that isn't the user's: Wrangler reads its
# config from ~/.wrangler whenever that directory exists, so a `.wrangler/`
# cache left in $HOME by a run from there hides the real login.
login_hint() {
  if [[ -d "${HOME}/.wrangler" && ! -f "${HOME}/.wrangler/config/default.toml" ]]; then
    printf 'Hint: %s/.wrangler exists without a login and hides Wrangler'"'"'s real one. If it only holds logs and caches, remove it and retry.\n' \
      "${HOME}" >&2
  fi
}

configure() {
  local base_url bucket

  printf 'Public base URL (for example, https://file-upload.example.workers.dev): '
  read -r base_url
  base_url="${base_url%/}"

  if [[ ! "${base_url}" =~ ^https://[^/]+$ ]]; then
    printf 'Error: enter an HTTPS origin without a path.\n' >&2
    exit 1
  fi

  printf 'R2 bucket name [%s]: ' "${DEFAULT_BUCKET}"
  read -r bucket
  bucket="${bucket:-${DEFAULT_BUCKET}}"

  if [[ ! "${bucket}" =~ ^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$ ]]; then
    printf 'Error: %s is not a valid R2 bucket name.\n' "${bucket}" >&2
    exit 1
  fi

  if ! wrangler r2 bucket info "${bucket}" >/dev/null 2>&1; then
    login_hint
    printf 'Error: cannot read R2 bucket %s. Run `npx wrangler@%s login`, check the bucket exists, then retry.\n' \
      "${bucket}" "${WRANGLER_VERSION}" >&2
    exit 1
  fi

  umask 077
  mkdir -p "${CONFIG_ROOT}"
  {
    printf 'FILE_UPLOAD_BASE_URL=%q\n' "${base_url}"
    printf 'FILE_UPLOAD_BUCKET=%q\n' "${bucket}"
  } > "${CONFIG_FILE}"
  chmod 600 "${CONFIG_FILE}"

  printf 'Configuration saved in %s\n' "${CONFIG_FILE}"
}

load_config() {
  # Environment overrides win over the file.
  local env_base_url="${FILE_UPLOAD_BASE_URL:-}" env_bucket="${FILE_UPLOAD_BUCKET:-}"

  if [[ -f "${CONFIG_FILE}" ]]; then
    # The file is created by this script with shell-escaped values and mode 600.
    # shellcheck disable=SC1090
    source "${CONFIG_FILE}"
  fi

  FILE_UPLOAD_BASE_URL="${env_base_url:-${FILE_UPLOAD_BASE_URL:-}}"
  FILE_UPLOAD_BUCKET="${env_bucket:-${FILE_UPLOAD_BUCKET:-}}"

  if [[ -z "${FILE_UPLOAD_BASE_URL}" || -z "${FILE_UPLOAD_BUCKET}" ]]; then
    printf 'Error: file upload is not configured for R2. Run %s --configure.\n' "$0" >&2
    exit 1
  fi

  FILE_UPLOAD_BASE_URL="${FILE_UPLOAD_BASE_URL%/}"
}

absolute_path() {
  local file="$1"
  printf '%s/%s' "$(cd "$(dirname "${file}")" && pwd -P)" "$(basename "${file}")"
}

slugify() {
  local value="${1%.*}"
  value="$(printf '%s' "${value}" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g')"
  printf '%s' "${value:-file}"
}

object_key() {
  local file="$1"
  local basename extension slug suffix

  basename="$(basename "${file}")"
  extension=""
  if [[ "${basename}" == *.* && "${basename}" != .* ]]; then
    extension=".$(printf '%s' "${basename##*.}" | tr '[:upper:]' '[:lower:]')"
  fi

  slug="$(slugify "${basename}")"
  suffix="$(od -An -N6 -tx1 /dev/urandom | tr -d ' \n')"
  printf '%s/%s-%s%s' "$(date -u +%Y/%m/%d)" "${slug}" "${suffix}" "${extension}"
}

upload() {
  local file="$1"
  local absolute_file key content_type size upload_output

  if [[ ! -f "${file}" ]]; then
    printf 'Error: file not found: %s\n' "${file}" >&2
    return 1
  fi

  absolute_file="$(absolute_path "${file}")"
  size="$(wc -c < "${absolute_file}" | tr -d ' ')"
  if (( size > MAX_BYTES )); then
    printf 'Error: %s is larger than 300 MiB, the most Wrangler uploads.\n' "${file}" >&2
    return 1
  fi

  key="$(object_key "${absolute_file}")"
  content_type="$(file --brief --mime-type "${absolute_file}")"
  # `file` reports text as text/plain without a charset, which garbles accents.
  if [[ "${content_type}" == text/* ]]; then
    content_type="${content_type}; charset=utf-8"
  fi

  if ! upload_output="$(
    wrangler r2 object put "${FILE_UPLOAD_BUCKET}/${key}" \
      --file "${absolute_file}" \
      --content-type "${content_type}" \
      --cache-control "public, max-age=31536000, immutable" \
      --remote 2>&1
  )"; then
    printf '%s\n' "${upload_output}" >&2
    login_hint
    return 1
  fi

  printf '%s/%s\n' "${FILE_UPLOAD_BASE_URL}" "${key}"
}

main() {
  if [[ "${1:-}" == "--configure" ]]; then
    configure
    exit 0
  fi

  if [[ $# -eq 0 || "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    usage
    exit 0
  fi

  load_config

  local file
  for file in "$@"; do
    upload "${file}"
  done
}

main "$@"
