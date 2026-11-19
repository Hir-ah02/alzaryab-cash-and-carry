#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────────────────────
# Run a Django management command from THIS computer against the hosted (Supabase) database,
# e.g. the first `migrate`, `createcachetable` and `createsuperuser` (Render's free plan has no
# shell or pre-deploy step).
#
#   cd backend && deploy/render/remote-manage.sh ~/Downloads/supabase-ca.crt migrate
#
# - Asks for DATABASE_URL without showing it; it lives only in this process (never written to a
#   file, never in shell history, never printed).
# - Uses TLS with certificate verification (verify-full) against the given CA certificate.
# - Shows host, user and database (no password) and asks before running anything.
# Your local backend/.env database is NOT used while DATABASE_URL is set.
# ─────────────────────────────────────────────────────────────────────────────────────────────
set -euo pipefail
CA="${1:?usage: remote-manage.sh PATH_TO_SUPABASE_CA_CERT COMMAND [ARGS…]}"; shift
[ $# -gt 0 ] || { echo "usage: remote-manage.sh PATH_TO_SUPABASE_CA_CERT COMMAND [ARGS…]" >&2; exit 2; }
[ -r "$CA" ] || { echo "CA certificate not readable: $CA" >&2; exit 2; }
cd "$(dirname "$0")/../.."
PY=.venv/bin/python

printf 'Paste the Supabase session-pooler DATABASE_URL (input hidden), then Enter: '
IFS= read -rs DATABASE_URL; echo
[ -n "$DATABASE_URL" ] || { echo "Nothing entered." >&2; exit 2; }
export DATABASE_URL DB_SSLMODE=verify-full DB_SSLROOTCERT="$CA"
# Production-mode settings for this one process (a throwaway signing key: these commands don't use it).
export DJANGO_DEBUG=False DJANGO_ALLOWED_HOSTS=localhost
export DJANGO_SECRET_KEY="$($PY -c 'import secrets; print(secrets.token_urlsafe(64))')"
unset DB_SCHEMA

target=$($PY -c "
import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from django.conf import settings
from config.database import describe
print(describe(settings.DATABASES['default']))")
echo "Target: $target"
echo "Command: manage.py $*"
read -rp "Type YES to run it against this database: " answer
[ "$answer" = "YES" ] || { echo "Cancelled."; exit 1; }
exec "$PY" manage.py "$@"
