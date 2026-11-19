# Al Zaryab — Staging on Render + Supabase (backend)

Free staging setup for the Django API: **Render** (web service) + **Supabase** PostgreSQL
(Tokyo, `ap-northeast-1`, **session pooler**). The two React sites go to Netlify (separate guide).

> Not yet run against the real Render/Supabase accounts. Everything below was tested locally with
> simulated values (see "Verified locally"); follow the steps in order and check each result.

## 1. What changed in the backend for hosting

| Area | Behaviour |
| --- | --- |
| Database | `DATABASE_URL` (hosted) **or** the `DB_*` variables (local development, unchanged). See `config/database.py`. |
| TLS to the database | Production refuses to start without TLS. Default `verify-full`: encrypted **and** the server certificate + host name are checked against Supabase's CA certificate (`DB_SSLROOTCERT`). `require` (encrypted, not verified) is allowed but not recommended. |
| Rate-limit bypass | Fixed: forged `X-Forwarded-For` headers can no longer make one client look like many (`TRUSTED_PROXY_COUNT`). |
| Dependencies | Django 5.2.19, DRF 3.18.3 (fixes unauthenticated memory-exhaustion advisories), Pillow 13.0.0; installed from the hash-checked `requirements-prod.lock`. |
| Password reset | Off unless `PASSWORD_RESET_ENABLED=true` (no email on staging): the API answers 503 "contact the store". |
| Render specifics | gunicorn binds `0.0.0.0:$PORT`; `*.onrender.com` host allowed automatically; `/api/health/` exempt from the HTTPS redirect for Render's health checks. |
| Placeholders | Django refuses to start while a `<PLACEHOLDER>` from the template is left in any variable. |

**Static files:** none needed. The API returns JSON only, the browsable API is off in production and
Django's built-in admin stays off (`DJANGO_ADMIN_PATH` empty). No `collectstatic` step.

## 2. Supabase (dashboard)

1. **Connect → Session pooler**: copy the connection string (`postgresql://postgres.<ref>:[YOUR-PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres`) and put the database password in it. Keep it in your password manager only.
2. **Database settings → SSL configuration → Download certificate** (Supabase's CA certificate, e.g. `prod-ca-2021.crt`). It is public; it lets the API verify it is really talking to Supabase.
3. Same page: turn on **Enforce SSL on incoming connections** if available.
4. Check **Database → Backups** to see what the free plan keeps. Do not rely on staging data.

## 3. Render web service

Create **New → Web Service** from the GitHub repository:

| Setting | Value |
| --- | --- |
| Branch | `main` (after this branch is merged) |
| Root Directory | `backend` |
| Runtime | Python |
| Region | Singapore (closest to both Pakistan and the Tokyo database) |
| Instance | Free |
| **Build Command** | `pip install --upgrade pip && pip install --require-hashes -r requirements-prod.lock` |
| **Start Command** | `gunicorn -c deploy/gunicorn.conf.py config.wsgi` |
| Health Check Path | `/api/health/` |
| Auto-Deploy | Off for now (deploy deliberately) |

**Secret File:** Environment → Secret Files → add `supabase-ca.crt` with the certificate's contents
(Render mounts it at `/etc/secrets/supabase-ca.crt`).

**Environment variables:** enter them as listed in
[`backend/deploy/render/render.env.example`](../backend/deploy/render/render.env.example). Secrets
(`DJANGO_SECRET_KEY`, `DATABASE_URL`) are typed only into Render; never into a file, chat or Git.

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(64))"   # DJANGO_SECRET_KEY (Render's "Generate" is too short)
```

## 4. Create the tables (once, from your computer, before the first deploy)

Render's free plan has no shell and no pre-deploy step, so run these from your laptop. The helper asks
for `DATABASE_URL` **without showing it**, keeps it only in memory, connects with `verify-full` using the
downloaded certificate, shows the target (no password) and asks for `YES` before each command.

```bash
cd ~/Project/cashandcarry/backend
deploy/render/remote-manage.sh ~/Downloads/<supabase-ca>.crt migrate
deploy/render/remote-manage.sh ~/Downloads/<supabase-ca>.crt createcachetable
deploy/render/remote-manage.sh ~/Downloads/<supabase-ca>.crt createsuperuser      # staging admin account
deploy/render/remote-manage.sh ~/Downloads/<supabase-ca>.crt check --deploy --database default
```

Your local database is not touched while these run. For later releases with new migrations, run
`migrate` the same way **before** deploying the new code.

## 5. Deploy and confirm the client-IP setting

1. Deploy. In Logs, gunicorn should report `Listening at: http://0.0.0.0:<PORT>`.
2. `curl https://<service>.onrender.com/api/health/` → `{"status":"ok","database":"ok"}`.
3. **Confirm `TRUSTED_PROXY_COUNT`** (it decides which address the rate limits use). With
   `LOG_CLIENT_IP_HEADERS=true`, from your computer:

   ```bash
   curl -s https://ifconfig.me; echo                     # your public IP
   curl -s -H "X-Forwarded-For: 192.0.2.99" https://<service>.onrender.com/api/health/
   ```

   In Render Logs find `client-ip check: … X-Forwarded-For='192.0.2.99, <your IP>…' … rate-limit key …`.
   - The **rate-limit key must be your public IP** → setting is correct.
   - Key is `192.0.2.99` (the forged value) → `TRUSTED_PROXY_COUNT` is too high: lower it.
   - Key is a Render/Cloudflare address → too low: set it to the number of entries from your IP to
     the end of the X-Forwarded-For list (counting your IP).
4. Set `LOG_CLIENT_IP_HEADERS=false` and redeploy (the log contains IP addresses).

## 6. Smoke test (API only)

```bash
API=https://<service>.onrender.com/api
curl -s $API/catalog/categories/
curl -s -o /dev/null -w '%{http_code}\n' $API/customer/orders/                 # 401 (sign-in required)
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'Content-Type: application/json' \
     -d '{"email":"x@example.com"}' $API/customer/auth/password-reset/          # 503 (reset off)
```

Then sign in to the admin portal (once Netlify is set up) with the account from §4.

## Known limits of the free staging setup

- **Product images are not kept**: Render's free instances have no persistent disk; files uploaded
  through the admin portal disappear on every deploy, restart or sleep. Fix before real use: store
  media in Supabase Storage (S3-compatible API) or a paid persistent disk.
- **Sleep**: free Render services stop after ~15 minutes without traffic; the next request waits
  about a minute. Supabase free projects pause after a period of inactivity.
- **Distance**: Render Singapore ↔ Supabase Tokyo adds latency to every database query
  (fine for staging; host both in one region for production).
- **Websites**: call the Render API directly (CORS, `CORS_ALLOWED_ORIGINS`) rather than through a
  Netlify proxy rewrite: an extra proxy hop would make every customer share Netlify's IP address for
  rate limiting. The customer website currently calls `/api` on its own origin and needs a build-time
  API address first (next task).

## Verified locally (19 Nov 2026)

- 163 backend tests (hosted-database parsing and TLS rules, rate-limit bypass, password-reset switch,
  Render port binding, health-check redirect exemption, client-IP diagnostic).
- `manage.py check --deploy` with simulated Render variables and a fake database host: no errors.
- gunicorn started exactly as Render will (`PORT=10000`, `DEBUG=False`): listens on `0.0.0.0:10000`,
  plain-HTTP health check 200, other HTTP requests redirected to HTTPS, unknown host 400.
- `requirements-prod.lock` installs with `--require-hashes`.

Not verified: real Supabase TLS certificate chain with `verify-full` through the session pooler, Render
build/runtime, Render's proxy depth (§5), Supabase free-plan backups.
