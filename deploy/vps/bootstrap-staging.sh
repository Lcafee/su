#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root." >&2
  exit 1
fi

SHA="${1:-}"
if [[ ! "${SHA}" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Usage: bootstrap-staging.sh <40-char-git-sha>" >&2
  exit 1
fi

EXPECTED_HOST="ubuntu-lcafe-ops-beta"
REPO="https://github.com/Lcafee/su.git"
CODE_ROOT="/srv/lcafe-site"
RELEASE_ROOT="${CODE_ROOT}/releases/${SHA}"
DATA_ROOT="/var/lib/lcafe-site"
CONFIG_ROOT="/etc/lcafe-site"
INPUT_ROOT="/root/lcafe-main-site-migration-input"
TMP="$(mktemp -d /tmp/lcafe-site-release.XXXXXX)"
STAGING_RELEASE=""

cleanup() {
  rm -rf "${TMP}"
  if [[ -n "${STAGING_RELEASE}" && -e "${STAGING_RELEASE}" ]]; then
    rm -rf "${STAGING_RELEASE}"
  fi
}
trap cleanup EXIT

echo "== host and tool guard =="
if [[ "$(hostname)" != "${EXPECTED_HOST}" ]]; then
  echo "Refusing to stage on unexpected host: $(hostname)" >&2
  exit 1
fi
for command_name in git node npm nginx systemctl ss curl install useradd; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Required command is missing: ${command_name}" >&2
    exit 1
  fi
done

echo "== Operations boundary guard =="
for forbidden in /app /var/lib/lcafe /etc/lcafe; do
  if [[ ! -e "${forbidden}" ]]; then
    echo "WARNING: expected Operations path missing: ${forbidden}" >&2
  fi
done
if [[ "$(systemctl is-active lcafe || true)" != "active" ]]; then
  echo "Refusing to stage while lcafe.service is not active." >&2
  exit 1
fi
if ! ss -ltn | grep -qE '127\.0\.0\.1:3000\b'; then
  echo "Refusing to stage: Operations is not listening on 127.0.0.1:3000." >&2
  exit 1
fi
if ss -ltn | grep -qE '127\.0\.0\.1:3100\b'; then
  echo "Refusing to continue: port 3100 is already in use." >&2
  exit 1
fi

echo "== fetch and verify exact Main Site release =="
git -C "${TMP}" init -q
git -C "${TMP}" remote add origin "${REPO}"
git -C "${TMP}" fetch -q --depth=1 origin "${SHA}"
git -C "${TMP}" checkout -q --detach FETCH_HEAD
ACTUAL_FETCHED="$(git -C "${TMP}" rev-parse HEAD)"
if [[ "${ACTUAL_FETCHED}" != "${SHA}" ]]; then
  echo "Fetched SHA mismatch: expected ${SHA}, got ${ACTUAL_FETCHED}" >&2
  exit 1
fi
(
  cd "${TMP}"
  node scripts/agent-scope-check.mjs
)

echo "== runtime identity =="
if ! id lcafe-site >/dev/null 2>&1; then
  useradd --system --home-dir /nonexistent --shell /usr/sbin/nologin lcafe-site
fi

echo "== isolated directories =="
install -d -o root -g root -m 0755 "${CODE_ROOT}" "${CODE_ROOT}/releases"
install -d -o lcafe-site -g lcafe-site -m 0751 "${DATA_ROOT}"
install -d -o lcafe-site -g www-data -m 0750 "${DATA_ROOT}/managed-menu"
install -d -o lcafe-site -g www-data -m 0750 "${DATA_ROOT}/managed-media"
install -d -o lcafe-site -g lcafe-site -m 0750 "${DATA_ROOT}/menu-revisions"
install -d -o lcafe-site -g lcafe-site -m 0750 "${DATA_ROOT}/media-originals"
install -d -o root -g lcafe-site -m 0750 "${CONFIG_ROOT}"
install -d -o root -g root -m 0700 "${INPUT_ROOT}"

echo "== immutable release ${SHA} =="
if [[ ! -e "${RELEASE_ROOT}" ]]; then
  (
    cd "${TMP}"
    npm ci --no-audit --no-fund
    npm run build
    npm run validate:dist
    rm -rf node_modules
  )

  (
    cd "${TMP}/server-node"
    npm ci --omit=dev --no-audit --no-fund
  )

  STAGING_RELEASE="${CODE_ROOT}/releases/.${SHA}.staging.${BASHPID}"
  install -d -o root -g root -m 0755 "${STAGING_RELEASE}"
  cp -a "${TMP}/." "${STAGING_RELEASE}/"
  chown -R root:root "${STAGING_RELEASE}"
  chmod -R a+rX "${STAGING_RELEASE}"
  test -f "${STAGING_RELEASE}/dist/index.html"
  test -f "${STAGING_RELEASE}/server-node/src/server.mjs"
  test -f "${STAGING_RELEASE}/server-node/node_modules/better-sqlite3/package.json"
  mv "${STAGING_RELEASE}" "${RELEASE_ROOT}"
  STAGING_RELEASE=""
else
  if [[ ! -d "${RELEASE_ROOT}/.git" ]]; then
    echo "Existing release path is incomplete; refusing to reuse it: ${RELEASE_ROOT}" >&2
    exit 1
  fi
  ACTUAL="$(git -C "${RELEASE_ROOT}" rev-parse HEAD)"
  if [[ "${ACTUAL}" != "${SHA}" ]]; then
    echo "Existing release path has unexpected SHA: ${ACTUAL}" >&2
    exit 1
  fi
  test -f "${RELEASE_ROOT}/dist/index.html"
  test -f "${RELEASE_ROOT}/server-node/src/server.mjs"
  test -f "${RELEASE_ROOT}/server-node/node_modules/better-sqlite3/package.json"
fi

echo "== atomic current pointer =="
ln -sfn "releases/${SHA}" "${CODE_ROOT}/current.next"
mv -Tf "${CODE_ROOT}/current.next" "${CODE_ROOT}/current"

echo "== private environment template =="
if [[ ! -f "${CONFIG_ROOT}/site.env" ]]; then
  cp "${RELEASE_ROOT}/deploy/vps/site.env.example" "${CONFIG_ROOT}/site.env"
fi
chown root:lcafe-site "${CONFIG_ROOT}/site.env"
chmod 0640 "${CONFIG_ROOT}/site.env"

echo "== install service definition (not started) =="
install -o root -g root -m 0644 \
  "${RELEASE_ROOT}/deploy/vps/lcafe-site-api.service" \
  /etc/systemd/system/lcafe-site-api.service
systemctl daemon-reload

echo "== install internal-only staging nginx =="
NGINX_AVAILABLE="/etc/nginx/sites-available/lcafe-site-staging"
NGINX_ENABLED="/etc/nginx/sites-enabled/lcafe-site-staging"
NGINX_BACKUP="${TMP}/lcafe-site-staging.nginx.previous"
HAD_NGINX_AVAILABLE=0
if [[ -f "${NGINX_AVAILABLE}" ]]; then
  cp -a "${NGINX_AVAILABLE}" "${NGINX_BACKUP}"
  HAD_NGINX_AVAILABLE=1
fi

install -o root -g root -m 0644 \
  "${RELEASE_ROOT}/deploy/vps/lcafe-site.staging.nginx.conf" \
  "${NGINX_AVAILABLE}"
ln -sfn "${NGINX_AVAILABLE}" "${NGINX_ENABLED}"

if ! nginx -t; then
  rm -f "${NGINX_ENABLED}"
  if [[ "${HAD_NGINX_AVAILABLE}" -eq 1 ]]; then
    cp -a "${NGINX_BACKUP}" "${NGINX_AVAILABLE}"
    ln -sfn "${NGINX_AVAILABLE}" "${NGINX_ENABLED}"
  else
    rm -f "${NGINX_AVAILABLE}"
  fi
  nginx -t || true
  echo "Nginx staging config rejected; previous state restored." >&2
  exit 1
fi
systemctl reload nginx

echo "== post-checks =="
test "$(systemctl is-active lcafe)" = "active"
ss -ltn | grep -qE '127\.0\.0\.1:3000\b'
curl -fsS --max-time 5 -o /dev/null http://127.0.0.1:8081/
ss -ltn | grep -E '127\.0\.0\.1:(3000|8081)\b' || true

echo
echo "STAGING_BOOTSTRAP_OK"
echo "release=${SHA}"
echo "current=$(readlink -f "${CODE_ROOT}/current")"
echo "input_dir=${INPUT_ROOT}"
echo "api_not_started=true"
