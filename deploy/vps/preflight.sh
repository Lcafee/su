#!/usr/bin/env bash
set -u

section() {
  printf '\n===== %s =====\n' "$1"
}

run() {
  printf '$ %s\n' "$*"
  "$@" 2>&1 || true
}

section "identity"
run date -u
run hostname
run uname -a
run id

section "capacity"
run uptime
run free -h
run df -h /
run df -h /var

section "runtime versions"
run node --version
run npm --version
run nginx -v

section "service health"
run systemctl is-active nginx
run systemctl is-active lcafe
run systemctl show lcafe --no-pager -p ActiveState -p SubState -p MainPID -p MemoryCurrent -p CPUUsageNSec

section "listening ports 3000 and 3100"
printf '$ ss -ltnp | grep -E ":(3000|3100)\\b" || true\n'
ss -ltnp 2>&1 | grep -E ':(3000|3100)\b' || true

section "main-site target collision checks"
for target in /srv/lcafe-site /var/lib/lcafe-site /etc/lcafe-site; do
  if [ -e "$target" ]; then
    printf 'EXISTS %s\n' "$target"
    ls -ld "$target" 2>&1 || true
  else
    printf 'FREE %s\n' "$target"
  fi
done

if getent passwd lcafe-site >/dev/null 2>&1; then
  printf 'EXISTS user lcafe-site: '
  getent passwd lcafe-site
else
  printf 'FREE user lcafe-site\n'
fi

section "operations boundary presence (metadata only)"
for target in /app /var/lib/lcafe /etc/lcafe; do
  if [ -e "$target" ]; then
    ls -ld "$target" 2>&1 || true
  else
    printf 'MISSING %s\n' "$target"
  fi
done

section "top resident processes"
printf '$ ps -eo pid,user,comm,%%cpu,%%mem,rss --sort=-rss | head -n 16\n'
ps -eo pid,user,comm,%cpu,%mem,rss --sort=-rss 2>&1 | head -n 16 || true

section "nginx syntax"
run nginx -t

section "result"
printf 'READ_ONLY_PREFLIGHT_COMPLETE\n'
