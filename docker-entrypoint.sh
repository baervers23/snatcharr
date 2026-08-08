#!/bin/sh
set -e

: "${PUID:?Set PUID in .env}"
: "${PGID:?Set PGID in .env}"

# Match container user to host volume ownership (set PUID/PGID in .env).
current_uid="$(id -u nextjs 2>/dev/null || echo -1)"
current_gid="$(id -g nextjs 2>/dev/null || echo -1)"
if [ "$current_uid" != "$PUID" ] || [ "$current_gid" != "$PGID" ]; then
  id nextjs >/dev/null 2>&1 && deluser nextjs 2>/dev/null || true
  grep -q '^nodejs:' /etc/group 2>/dev/null && delgroup nodejs 2>/dev/null || true
  addgroup -g "$PGID" -S nodejs 2>/dev/null || addgroup -S nodejs
  adduser -D -u "$PUID" -G nodejs -S -H -h /app nextjs
fi

for dir in /app/data /downloads; do
  mkdir -p "$dir"
  chown -R "$PUID:$PGID" "$dir"
  chmod -R u+rwX,g+rwX "$dir"
done

# Optional: mount dedicated download disk (e.g. /dev/sdb1) on fresh hosts.
DOWNLOAD_DEVICE="${DOWNLOAD_DEVICE:-/dev/sdb1}"
DOWNLOAD_FSTAB_OPTS="${DOWNLOAD_FSTAB_OPTS:-defaults,noexec,nosuid,nodev}"
if [ -b "$DOWNLOAD_DEVICE" ] && ! mountpoint -q /downloads 2>/dev/null; then
  if ! grep -q "[[:space:]]/downloads[[:space:]]" /etc/fstab 2>/dev/null; then
    echo "$DOWNLOAD_DEVICE /downloads ext4 $DOWNLOAD_FSTAB_OPTS 0 2" >> /etc/fstab
  fi
  mount /downloads 2>/dev/null || true
  chown -R "$PUID:$PGID" /downloads
  chmod -R u+rwX,g+rwX /downloads
fi

for path in /app/server.js /app/package.json /app/public /app/.next /app/node_modules; do
  if [ -e "$path" ]; then
    chown -R "$PUID:$PGID" "$path"
  fi
done

exec su -s /bin/sh nextjs -c 'exec "$@"' sh "$@"
