#!/usr/bin/env bash
# Browser tests for the customer website against ISOLATED data.
#
# - Creates a temporary PostgreSQL schema (e2e_customer_web) inside the existing local
#   database, migrates and seeds it. The real data in the "public" schema is never touched.
# - Starts a separate Django on :8001, the admin portal on :5175 and the customer website
#   on :5176, all pointed at that schema. (Your normal :8000 / :5173 / :5174 keep running.)
# - All browser traffic comes from one IP, so the per-IP rate limits are raised for this
#   test server only (production limits are unchanged).
# - Runs Playwright, then stops the servers and drops the schema (KEEP_E2E=1 keeps it).
#
# Usage: npm run test:e2e:isolated [-- playwright args]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WEB="$ROOT/customer-web"
BACKEND="$ROOT/backend"
SCHEMA=e2e_customer_web
LOGS="$WEB/test-results/e2e-logs"
mkdir -p "$LOGS"

# Database connection from backend/.env (password never printed).
while IFS='=' read -r key value; do
  case "$key" in DB_NAME|DB_USER|DB_HOST|DB_PORT|DB_PASSWORD) export "$key=$value" ;; esac
done < <(grep -E '^DB_(NAME|USER|HOST|PORT|PASSWORD)=' "$BACKEND/.env")
export PGPASSWORD="${DB_PASSWORD:-}"
PSQL=(psql -X -q -v ON_ERROR_STOP=1 -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME")

export E2E_STAFF_EMAIL="e2e-staff@example.test"
export E2E_STAFF_PASSWORD="Staff-$(openssl rand -hex 12)"   # random per run, never stored
export E2E_API="http://localhost:8001/api"
export E2E_SHOP="http://localhost:5176"
export E2E_ADMIN="http://localhost:5175"

PIDS=()
cleanup() {
  for pid in "${PIDS[@]:-}"; do [ -n "$pid" ] && kill "$pid" 2>/dev/null || true; done
  if [ "${KEEP_E2E:-0}" != "1" ]; then
    "${PSQL[@]}" -c "DROP SCHEMA IF EXISTS $SCHEMA CASCADE;" && echo "Dropped schema $SCHEMA"
  fi
}
trap cleanup EXIT

for port in 8001 5175 5176; do
  if lsof -nP -iTCP:$port -sTCP:LISTEN >/dev/null 2>&1; then echo "Port $port is in use; stop it first." >&2; exit 1; fi
done

echo "Creating schema $SCHEMA…"
"${PSQL[@]}" -c "DROP SCHEMA IF EXISTS $SCHEMA CASCADE; CREATE SCHEMA $SCHEMA;"
(cd "$BACKEND" && DB_SCHEMA=$SCHEMA .venv/bin/python manage.py migrate --noinput -v 0)
(cd "$BACKEND" && DB_SCHEMA=$SCHEMA .venv/bin/python manage.py shell < "$WEB/tests/e2e/seed.py")

echo "Starting isolated servers…"
(cd "$BACKEND" && DB_SCHEMA=$SCHEMA CORS_ALLOWED_ORIGINS="$E2E_ADMIN" \
  LOGIN_THROTTLE_RATE=1000/min REGISTER_THROTTLE_RATE=1000/hour REFRESH_THROTTLE_RATE=1000/min \
  ANON_THROTTLE_RATE=5000/min USER_THROTTLE_RATE=5000/min \
  exec .venv/bin/python manage.py runserver 8001 --noreload) >"$LOGS/django.log" 2>&1 & PIDS+=($!)
(cd "$ROOT" && VITE_API_URL="$E2E_API" exec npx vite --port 5175 --strictPort) >"$LOGS/admin.log" 2>&1 & PIDS+=($!)
(cd "$WEB" && PORT=5176 API_PROXY_TARGET=http://localhost:8001 exec npx vite) >"$LOGS/shop.log" 2>&1 & PIDS+=($!)

for url in "$E2E_API/health/" "$E2E_ADMIN/" "$E2E_SHOP/api/health/"; do
  for _ in $(seq 1 60); do curl -sf -o /dev/null "$url" && break; sleep 0.5; done
  curl -sf -o /dev/null "$url" || { echo "Server at $url did not start (see $LOGS)" >&2; exit 1; }
done

cd "$WEB"
npx playwright test "$@"
