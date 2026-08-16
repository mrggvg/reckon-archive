#!/usr/bin/env bash
#
# Takes a compressed dump of the ledger and prunes old ones.
#
#   scripts/backup.sh                       dump to ./backups
#   scripts/backup.sh /mnt/somewhere-else   dump there
#
# A database on a free tier has no point-in-time recovery and, on some
# providers, no daily snapshot either. This is the copy that exists because you
# made it. Run it from cron:
#
#   0 3 * * *  cd /path/to/reckon && DATABASE_URL=... scripts/backup.sh >> /var/log/reckon-backup.log 2>&1
#
# Restore one with:
#
#   pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" backups/reckon-2026-08-16.dump

set -euo pipefail

DEST="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/backups}"
KEEP="${KEEP:-30}"
URL="${DATABASE_URL:-postgres://reckon:reckon@localhost:5432/reckon}"

# pg_dump has to match the server's major version, and the one that certainly
# does is inside the dev container. A local client is used when the database is
# somewhere else — a hosted one, say.
COMPOSE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/db/compose.yaml"
if [ -z "${DATABASE_URL:-}" ] && docker compose -f "$COMPOSE" ps --status running 2>/dev/null | grep -q db; then
  dump() { docker compose -f "$COMPOSE" exec -T db pg_dump "$@" "$URL"; }
  restore_list() { docker compose -f "$COMPOSE" exec -T db pg_restore --list; }
elif command -v pg_dump >/dev/null; then
  dump() { pg_dump "$@" "$URL"; }
  restore_list() { pg_restore --list; }
else
  echo "no pg_dump: install postgresql-client, or start the dev container" >&2
  exit 1
fi

mkdir -p "$DEST"
STAMP="$(date +%Y-%m-%d-%H%M)"
FILE="$DEST/reckon-$STAMP.dump"

# Custom format: compressed, and restorable table by table if it ever comes to
# that. Written to a partial name first so an interrupted run can't leave
# something that looks like a good backup.
# Straight to stdout, so the container variant needs no shared volume.
dump --format=custom --no-owner --no-privileges > "$FILE.partial"
mv "$FILE.partial" "$FILE"

SIZE="$(du -h "$FILE" | cut -f1)"
echo "$(date +%FT%T) ✓ $FILE ($SIZE)"

# A backup you never verify is a rumour. Read the archive's own table of
# contents back; a truncated or corrupt dump fails here rather than on the day
# you need it.
if ! restore_list < "$FILE" >/dev/null 2>&1; then
  echo "$(date +%FT%T) ✗ $FILE did not read back — keeping it, but it is suspect" >&2
  exit 1
fi

# Prune, newest kept.
mapfile -t OLD < <(ls -1t "$DEST"/reckon-*.dump 2>/dev/null | tail -n +"$((KEEP + 1))")
for f in "${OLD[@]:-}"; do
  [ -n "$f" ] || continue
  rm -f "$f"
  echo "$(date +%FT%T) · pruned $(basename "$f")"
done
