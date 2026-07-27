#!/usr/bin/env bash
set -euo pipefail

script_dir="${BASH_SOURCE[0]%/*}"
[[ "${script_dir}" == "${BASH_SOURCE[0]}" ]] && script_dir="."
repo_root="$(cd "${script_dir}/.." && pwd)"
example_file="${repo_root}/deploy/production.env.example"
target_file="${repo_root}/deploy/production.env"
docs_host="${1:-}"
scheme="https"
http_bind="127.0.0.1"
http_port="8083"
public_port=""

usage() {
  echo "Usage: $0 <docs-host> [--scheme http|https] [--bind address] [--port port] [--public-port port]" >&2
  echo "HTTPS example: $0 docs.example.internal" >&2
  echo "LAN HTTP example: $0 192.168.1.20 --scheme http --bind 0.0.0.0 --port 4332" >&2
}

if [[ -z "${docs_host}" || ! "${docs_host}" =~ ^[A-Za-z0-9.-]+$ ]]; then
  usage
  exit 1
fi

shift
while [[ $# -gt 0 ]]; do
  case "$1" in
    --scheme)
      [[ $# -ge 2 ]] || { usage; exit 1; }
      scheme="$2"
      shift 2
      ;;
    --bind)
      [[ $# -ge 2 ]] || { usage; exit 1; }
      http_bind="$2"
      shift 2
      ;;
    --port)
      [[ $# -ge 2 ]] || { usage; exit 1; }
      http_port="$2"
      shift 2
      ;;
    --public-port)
      [[ $# -ge 2 ]] || { usage; exit 1; }
      public_port="$2"
      shift 2
      ;;
    *)
      usage
      exit 1
      ;;
  esac
done

if [[ "${scheme}" != "http" && "${scheme}" != "https" ]]; then
  echo "--scheme must be http or https" >&2
  exit 1
fi

if [[ ! "${http_port}" =~ ^[0-9]+$ ]] || (( http_port < 1 || http_port > 65535 )); then
  echo "--port must be between 1 and 65535" >&2
  exit 1
fi

if [[ -n "${public_port}" ]] && { [[ ! "${public_port}" =~ ^[0-9]+$ ]] || (( public_port < 1 || public_port > 65535 )); }; then
  echo "--public-port must be between 1 and 65535" >&2
  exit 1
fi

if [[ -z "${http_bind}" || "${http_bind}" == *$'\n'* ]]; then
  echo "--bind must be a non-empty address" >&2
  exit 1
fi

if [[ -e "${target_file}" ]]; then
  echo "Refusing to overwrite ${target_file}" >&2
  exit 1
fi

command -v openssl >/dev/null 2>&1 || {
  echo "openssl is required" >&2
  exit 1
}

cp "${example_file}" "${target_file}"

set_value() {
  local key="$1"
  local value="$2"
  sed -i "s|^${key}=.*$|${key}=${value}|" "${target_file}"
}

random_secret() {
  openssl rand -hex 32
}

sed -i "s/docs\.example\.internal/${docs_host}/g" "${target_file}"
if [[ -z "${public_port}" ]]; then
  if [[ "${scheme}" == "http" ]]; then
    public_port="${http_port}"
  else
    public_port="443"
  fi
fi

port_suffix=""
if [[ ( "${scheme}" == "http" && "${public_port}" != "80" ) || ( "${scheme}" == "https" && "${public_port}" != "443" ) ]]; then
  port_suffix=":${public_port}"
fi
origin="${scheme}://${docs_host}${port_suffix}"
ws_scheme="ws"
[[ "${scheme}" == "https" ]] && ws_scheme="wss"

set_value MAPLEDOCS_HTTP_BIND "${http_bind}"
set_value MAPLEDOCS_HTTP_PORT "${http_port}"
set_value DJANGO_CSRF_TRUSTED_ORIGINS "${origin}"
set_value DJANGO_EMAIL_URL_APP "${origin}"
set_value MEDIA_BASE_URL "${origin}"
set_value LOGIN_REDIRECT_URL "${origin}"
set_value LOGIN_REDIRECT_URL_FAILURE "${origin}"
set_value LOGOUT_REDIRECT_URL "${origin}"
set_value OIDC_REDIRECT_ALLOWED_HOSTS "[\"${origin}\"]"
set_value ONLYOFFICE_DOCUMENT_SERVER_URL "${origin}/onlyoffice"
set_value COLLABORATION_SERVER_ORIGIN "${origin}"
set_value COLLABORATION_WS_URL "${ws_scheme}://${docs_host}${port_suffix}/collaboration/ws/"

if [[ "${scheme}" == "http" ]]; then
  set_value DJANGO_SECURE_SSL_REDIRECT false
  set_value DJANGO_CSRF_COOKIE_SECURE false
  set_value DJANGO_SESSION_COOKIE_SECURE false
fi

set_value APP_CONTAINER_UID "$(id -u)"
set_value DJANGO_SECRET_KEY "$(random_secret)"
set_value POSTGRES_PASSWORD "$(random_secret)"
set_value MINIO_ROOT_PASSWORD "$(random_secret)"

onlyoffice_secret="$(random_secret)"
set_value ONLYOFFICE_JWT_SECRET "${onlyoffice_secret}"
set_value JWT_SECRET "${onlyoffice_secret}"

set_value Y_PROVIDER_API_KEY "$(random_secret)"
set_value COLLABORATION_SERVER_SECRET "$(random_secret)"

chmod 600 "${target_file}"
echo "Created ${target_file} for ${origin} (listening on ${http_bind}:${http_port})"
