#!/usr/bin/env bash
# Daily backup of the database and uploaded images. Run as a user that can read both, e.g. from cron:
#   15 2 * * * /srv/alzaryab/backend/deploy/backup.sh /var/backups/alzaryab
# Restore instructions: docs/DEPLOYMENT.md ("Backups and restore").
set -euo pipefail
DEST="${1:?usage: backup.sh DESTINATION_DIR}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y-%m-%d_%H%M)"
MEDIA_DIR="${MEDIA_DIR:-/srv/alzaryab/backend/media}"
mkdir -p "$DEST"
# Connection details come from PG* variables or ~/.pgpass (never put the password in this file).
pg_dump --format=custom --no-owner --dbname="${DB_NAME:-alzaryab_db}" --file="$DEST/db_$STAMP.dump"
tar -czf "$DEST/media_$STAMP.tar.gz" -C "$(dirname "$MEDIA_DIR")" "$(basename "$MEDIA_DIR")"
find "$DEST" -name 'db_*.dump' -mtime +"$KEEP_DAYS" -delete
find "$DEST" -name 'media_*.tar.gz' -mtime +"$KEEP_DAYS" -delete
echo "Backup written to $DEST ($STAMP)"
