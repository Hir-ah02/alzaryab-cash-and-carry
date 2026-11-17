# Al Zaryab — Deployment Guide

How to put the API, the Admin Portal and the customer app into production. **Nothing has been deployed
or published.** Every step marked 🔑 needs the owner's approval, an account, credentials, a domain or a
paid service, and must be done by (or with) the owner.

## 1. Status at a glance

| Area | Prepared in the code (done) | Still needed (owner) |
| --- | --- | --- |
| API security settings | Production mode refuses to start without a strong `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS` and a database password; HTTPS redirect, HSTS, secure cookies, security headers, JSON-only API, rate limits, logging; Django's `/admin/` off unless `DJANGO_ADMIN_PATH` is set | 🔑 Real secrets and domain names |
| API server | `requirements-prod.txt` (gunicorn), `deploy/gunicorn.conf.py`, `deploy/alzaryab-api.service` (systemd), `deploy/nginx.conf.example`, `deploy/api.env.example` | 🔑 A Linux server or hosting service |
| Database | Migrations, health check (`/api/health/`), `deploy/backup.sh` | 🔑 PostgreSQL hosting; restore test on the new server |
| Email (password reset) | SMTP settings from environment variables; deploy check warns if missing | 🔑 An email provider account (SMTP host, user, password, sender domain) |
| Admin Portal | Production build (`npm run build`), API address via `VITE_API_URL` | 🔑 Hosting for static files and a domain |
| Mobile app | App identifiers, EAS build profiles (development, preview, production), HTTPS-only API in release builds, minimal Android permissions | 🔑 Expo account, Google Play and Apple developer accounts, signing, final artwork, store listings, **account deletion**, device testing |

## 2. What runs where

```
Phone app (Expo / React Native) ──HTTPS──▶ API_DOMAIN  (nginx → gunicorn → Django) ──▶ PostgreSQL
Browser (Admin Portal static files) ─HTTPS─▶ ADMIN_DOMAIN (nginx)   └─▶ product images on disk (/media/)
```

`API_DOMAIN` and `ADMIN_DOMAIN` are placeholders, e.g. `api.<store-domain>` and `admin.<store-domain>`.
No domain has been chosen or bought.

## 3. Backend hosting

**Minimum:** 1 vCPU, 2 GB RAM, 20 GB SSD, Ubuntu 24.04 LTS (or similar), Python 3.12+, nginx, PostgreSQL 16/17
on the same server or as a managed service. This is plenty for one store; scale up later if needed.
A managed platform (Render, Railway, Fly.io, DigitalOcean App Platform…) also works: use the same environment
variables, run `gunicorn -c deploy/gunicorn.conf.py config.wsgi`, set `DJANGO_BEHIND_PROXY=true`, and give
it persistent disk storage for `/media/` (or keep a small VPS for simplicity).

### Server setup (VPS) 🔑

```bash
# as root, once
apt update && apt install -y python3-venv python3-dev nginx postgresql certbot python3-certbot-nginx
adduser --system --group --home /srv/alzaryab alzaryab
mkdir -p /srv/alzaryab /etc/alzaryab
# copy the project to /srv/alzaryab (backend/ and the built admin portal), e.g. with rsync from your Mac:
#   rsync -av --exclude .venv --exclude media --exclude .env backend/ root@SERVER:/srv/alzaryab/backend/
cd /srv/alzaryab/backend
python3 -m venv .venv
.venv/bin/pip install -r requirements-prod.txt
cp deploy/api.env.example /etc/alzaryab/api.env      # then fill in every value (see section 5)
chmod 600 /etc/alzaryab/api.env
```

> **Never copy the development `backend/.env` to a server.** It contains development values
> (`DJANGO_DEBUG=True`, local CORS origins, an empty database password).

Prepare the database and files (as the `alzaryab` user, with the production variables loaded):

```bash
set -a; . /etc/alzaryab/api.env; set +a
.venv/bin/python manage.py check --deploy        # must show only the two HSTS notes (see section 6)
.venv/bin/python manage.py migrate
.venv/bin/python manage.py collectstatic --noinput
.venv/bin/python manage.py createcachetable      # rate limits shared between workers (DJANGO_CACHE=database)
.venv/bin/python manage.py createsuperuser       # the owner's admin account (or restore existing data, section 9)
```

Start the API and web server:

```bash
cp deploy/alzaryab-api.service /etc/systemd/system/ && systemctl daemon-reload && systemctl enable --now alzaryab-api
cp deploy/nginx.conf.example /etc/nginx/sites-available/alzaryab   # replace API_DOMAIN / ADMIN_DOMAIN
ln -s /etc/nginx/sites-available/alzaryab /etc/nginx/sites-enabled/ && nginx -t && systemctl reload nginx
certbot --nginx -d API_DOMAIN -d ADMIN_DOMAIN
curl https://API_DOMAIN/api/health/      # {"status":"ok","database":"ok"}
```

## 4. PostgreSQL

* **Authentication:** password authentication only (`scram-sha-256` in `pg_hba.conf`). **Never `trust`.**
  The development Mac uses `trust` for convenience; production refuses to start without `DB_PASSWORD`.
* **Role:** one application role that owns only the application database, without superuser,
  `CREATEDB` or `CREATEROLE` rights (this is how `alzaryab_user` is set up locally).
* **Network:** listen on localhost only (same server), or require SSL (`sslmode=require`) for a managed
  database; restrict access to the API server's IP.
* **Managed options:** DigitalOcean, Render, Neon, Supabase, AWS RDS… choose one with daily backups
  and point-in-time recovery. 🔑

```sql
-- on a self-hosted server (psql as postgres)
CREATE ROLE alzaryab_user LOGIN PASSWORD '<long random password>';
CREATE DATABASE alzaryab_db OWNER alzaryab_user;
```

## 5. Environment variables

All production configuration comes from environment variables (template: `backend/deploy/api.env.example`).

| Variable | Required | Meaning |
| --- | --- | --- |
| `DJANGO_DEBUG` | yes | `False` in production |
| `DJANGO_SECRET_KEY` | yes | 50+ random characters: `python -c "import secrets; print(secrets.token_urlsafe(64))"`. Changing it signs everyone out. |
| `DJANGO_ALLOWED_HOSTS` | yes | `API_DOMAIN` |
| `DJANGO_BEHIND_PROXY` | with nginx/PaaS | `true` so Django trusts the proxy's HTTPS header |
| `CSRF_TRUSTED_ORIGINS` | if Django admin is used | `https://API_DOMAIN` |
| `CORS_ALLOWED_ORIGINS` | yes | `https://ADMIN_DOMAIN` (the Admin Portal's address) |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` | yes | PostgreSQL connection |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS` | yes | SMTP provider for password-reset codes (e.g. Brevo, Mailgun, Amazon SES, Google Workspace) 🔑 |
| `DEFAULT_FROM_EMAIL` | yes | e.g. `Al Zaryab <no-reply@store-domain>` (set up SPF/DKIM for that domain at the provider) |
| `DJANGO_CACHE` | recommended | `database` (run `createcachetable` once) so rate limits work across workers |
| `SECURE_HSTS_SECONDS` | optional | defaults to 1 day; raise to `31536000` once HTTPS is confirmed everywhere |
| `DJANGO_ADMIN_PATH` | optional | enables Django's built-in admin at a hard-to-guess path; leave empty to keep it off |
| `ORDER_DELIVERY_FEE`, `ORDER_FREE_DELIVERY_FROM` | owner decision | delivery fee (default 150.00) and optional free-delivery threshold |
| `PASSWORD_RESET_CODE_MINUTES` | optional | reset code lifetime (default 15) |
| `DJANGO_LOG_LEVEL` | optional | `INFO` (default) or `WARNING` |
| Rate limits: `LOGIN_THROTTLE_RATE`, `REGISTER_THROTTLE_RATE`, `REFRESH_THROTTLE_RATE`, `PASSWORD_RESET_THROTTLE_RATE`, `PASSWORD_RESET_CONFIRM_THROTTLE_RATE`, `ANON_THROTTLE_RATE`, `USER_THROTTLE_RATE` | optional | defaults 10/min, 20/hour, 60/min, 10/hour, 20/hour, 300/min, 600/min |

## 6. HTTPS and domains 🔑

1. Buy or choose a domain; create DNS **A records** for `API_DOMAIN` and `ADMIN_DOMAIN` pointing to the server.
2. `certbot --nginx -d API_DOMAIN -d ADMIN_DOMAIN` (free Let's Encrypt certificates, renewed automatically).
3. Django redirects HTTP to HTTPS and sends HSTS for 1 day. After a week without HTTPS problems set
   `SECURE_HSTS_SECONDS=31536000`. Only set `SECURE_HSTS_INCLUDE_SUBDOMAINS=true` if **every** subdomain of
   the domain uses HTTPS (that's what `manage.py check --deploy` warning W005 refers to; W021 "preload"
   is optional).
4. The mobile app's production build only accepts an `https://` API address.

## 7. Product images (media)

Uploads are saved under `backend/media/products/` with random file names (never reused, so nginx can cache
them for a long time). nginx serves `/media/` directly. Include the folder in backups (section 9).
Moving images to object storage (S3, Cloudflare R2, Spaces) is possible later but not set up.

## 8. Admin Portal hosting

```bash
cd ~/Project/cashandcarry
VITE_API_URL=https://API_DOMAIN/api npm run build      # creates dist/
rsync -av dist/ root@SERVER:/srv/alzaryab/admin/
```

The build is plain static files (hash URLs, works from any folder). The nginx example serves it with
strict security headers, including a Content-Security-Policy that only allows the portal's own files and
the API. Any static host (Netlify, Cloudflare Pages, S3 + CloudFront) also works; set the same headers there.
Remember to put `https://ADMIN_DOMAIN` in `CORS_ALLOWED_ORIGINS`.

## 8a. Customer website hosting (not deployed yet)

The customer website (`customer-web/`) is a static build (`npm run build` → `customer-web/dist/`).
It calls the API on **its own domain** under `/api` and loads images from `/media`, so the web
server for `SHOP_DOMAIN` must:

1. Serve `customer-web/dist/` with a fallback to `index.html` for unknown paths
   (`try_files $uri /index.html;`): the site uses normal URLs such as `/products/12`.
2. Proxy `/api/` to gunicorn and serve `/media/` exactly as the `API_DOMAIN` block does
   (no CORS entry is needed because the browser stays on one origin).
3. Send security headers including a strict Content-Security-Policy, e.g.
   `default-src 'self'; img-src 'self' data:; connect-src 'self'; style-src 'self' 'unsafe-inline';
   frame-ancestors 'none'; base-uri 'self'` (login tokens are kept in browser storage).
4. Add `SHOP_DOMAIN` to `DJANGO_ALLOWED_HOSTS` (and `CSRF_TRUSTED_ORIGINS` if Django's admin is used).
5. Behind nginx, set `proxy_set_header X-Forwarded-For $remote_addr;` (not
   `$proxy_add_x_forwarded_for`) so visitors can't fake their IP to bypass the per-IP rate limits.
6. Review the anonymous rate limit (`ANON_THROTTLE_RATE`, default 300/min per IP): many customers
   behind one shared IP (office, mobile carrier) share that limit.

## 9. Backups, restore and monitoring

**Backups:** `backend/deploy/backup.sh` writes a compressed database dump and an archive of the images,
keeping 14 days. Schedule it daily and copy the folder off the server (another provider, or download weekly):

```bash
# crontab -e (as a user with database access via ~/.pgpass)
15 2 * * * /srv/alzaryab/backend/deploy/backup.sh /var/backups/alzaryab
```

The script was tested against the development database (19 tables captured; archive verified with
`pg_restore --list`).

**Restore** (onto an empty database, e.g. a new server):

```bash
createdb -O alzaryab_user alzaryab_db
pg_restore --no-owner --role=alzaryab_user -d alzaryab_db /var/backups/alzaryab/db_YYYY-MM-DD_HHMM.dump
tar -xzf /var/backups/alzaryab/media_YYYY-MM-DD_HHMM.tar.gz -C /srv/alzaryab/backend/
```

A full restore has **not been tested** (it needs a second database, which wasn't created during
development). Test it once on the production server before going live, and then every few months.

**Moving the current data to production:** take a backup on the Mac with the same script, then restore it
on the server as above.

**Monitoring:**
* Uptime: a free monitor (e.g. UptimeRobot, Better Stack) checking `https://API_DOMAIN/api/health/`
  every 5 minutes (503 means the database is unreachable).
* Logs: `journalctl -u alzaryab-api -f` (API) and `/var/log/nginx/`. Passwords, tokens and reset codes
  are never logged.
* Disk space for backups and images; certificate renewal (`certbot renew --dry-run`).
* Optional error tracking (e.g. Sentry) is not set up (owner decision).

## 10. Mobile app builds (EAS) 🔑

The app is built in Expo's cloud (EAS Build), so **no Xcode or Android Studio is needed**.

| Profile | Use | Output |
| --- | --- | --- |
| `development` | Development client for testing native code | Android APK / iOS internal build |
| `preview` | Install on testers' phones before release | Android APK, iOS ad-hoc/internal |
| `production` | Store release | Android App Bundle (.aab), iOS App Store build |

```bash
npm install -g eas-cli
cd mobile
eas login                        # 🔑 free Expo account
eas init                         # links the project (adds its ID to app.json)
# API address per environment (never in the code):
eas env:create --environment production --name EXPO_PUBLIC_API_URL --value https://API_DOMAIN/api --visibility plaintext
eas env:create --environment preview    --name EXPO_PUBLIC_API_URL --value https://API_DOMAIN/api --visibility plaintext
eas build --platform android --profile preview      # first test build
eas build --platform all --profile production       # 🔑 store builds; EAS creates and keeps signing keys
eas submit --platform android                       # 🔑 only after approval
eas submit --platform ios                           # 🔑 only after approval
```

* **App identifiers:** `pk.alzaryab.customer` (Android package and iOS bundle ID) is a placeholder.
  **Confirm before the first store upload; it can never change afterwards.** It should be based on a
  domain the store owns.
* **Version:** `1.0.0` in `app.json`; build numbers increase automatically (EAS remote versioning).
* **Signing:** let EAS generate and store the Android upload key and iOS certificates (🔑 approval).
  Back up the Android keystore from the Expo dashboard.

### Artwork needed (not provided yet)

The current icons are the Expo template images and **must be replaced** with the store's branding:

| File (mobile/assets) | Size | Notes |
| --- | --- | --- |
| `icon.png` | 1024×1024 PNG | App Store icon: no transparency, no rounded corners |
| `android-icon-foreground.png` | 1024×1024 PNG | Logo centred in the middle 66% (safe zone), transparent background |
| `android-icon-background.png` | 1024×1024 PNG | Solid colour or simple pattern (currently brand green #15803D) |
| `android-icon-monochrome.png` | 1024×1024 PNG | Single-colour silhouette for Android themed icons |
| Splash screen | 1024×1024 PNG logo | Shown while the app starts |
| Google Play feature graphic | 1024×500 | Store listing |
| Screenshots | Phone screenshots of Home, product, cart, checkout, orders | Play: at least 2; App Store: 6.9" and 6.5" iPhone sizes (and iPad if `supportsTablet` stays `true`) |

## 11. Google Play requirements 🔑

* Google Play Console developer account (one-time US$25). New **personal** accounts must run a closed
  test with at least 12 testers for 14 days before production access; an **organization** account
  (needs a D-U-N-S number) does not.
* Privacy policy URL (hosted web page) describing the data collected: name, email, phone, delivery
  addresses, order history; no location, no payment card data.
* **Data safety form** matching the above (data encrypted in transit; users can request deletion).
* **Account deletion:** apps that let users create accounts must let them delete the account in the app
  and through a web link. **Not implemented yet — release blocker** (see the final report).
* Content rating questionnaire, target audience, app category (Shopping), contact email.
* Target API level: EAS/Expo SDK 58 builds target the current required level.
* Upload the `.aab` to the **internal testing** track first.

## 12. Apple App Store requirements 🔑

* Apple Developer Program membership (US$99/year), App Store Connect app record using the confirmed
  bundle ID.
* Privacy policy URL and **App Privacy** answers (same data as above, linked to the user's identity,
  not used for tracking).
* **Account deletion inside the app** (Guideline 5.1.1(v)) — **release blocker**, as for Google Play.
* A demo customer account for the reviewer (create one on the production server; give the email and
  password in App Review notes) and a working production API during review.
* Export compliance: the app only uses standard HTTPS, declared with `ITSAppUsesNonExemptEncryption = false`.
* Screenshots (see section 10). `supportsTablet` is `true`: either test on iPad and provide iPad
  screenshots, or set it to `false` before the first submission (owner decision).
* Test with TestFlight before submitting.

## 13. Go-live checklist

- [ ] All 🔑 items above approved and done
- [ ] Account deletion implemented (store requirement)
- [ ] Final artwork in `mobile/assets`, identifiers confirmed
- [ ] `manage.py check --deploy` shows only the HSTS notes; `/api/health/` is OK over HTTPS
- [ ] Email provider configured; a real password-reset email received and used
- [ ] Backups scheduled, copied off-site, and one restore tested
- [ ] Uptime monitor on `/api/health/`
- [ ] Preview build tested on at least one Android phone and one iPhone (full checklist in
      `docs/UAT_TESTING_GUIDE.md`)
- [ ] Delivery fee and free-delivery threshold confirmed by the store
- [ ] Privacy policy published; store listings completed
