# Al Zaryab — Security and Production Review (Task 8)

Scope: Django REST API, PostgreSQL configuration, React Admin Portal, Expo customer app.
Severity: **Critical** (exploitable now, serious impact) · **High** · **Medium** · **Low** · **Info**.

## Findings

| # | Severity | Area | Finding | Status |
| --- | --- | --- | --- | --- |
| 1 | High | Auth | Changing or resetting a password did not end existing sessions: access tokens stayed valid up to 15 min and rotated refresh tokens could be renewed indefinitely. | **Fixed.** Every JWT carries an HMAC fingerprint of the password hash (`apps/accounts/tokens.py`); tokens issued before a password change are refused by the API and by both refresh endpoints. Password reset also blacklists all outstanding refresh tokens. One-time effect: existing sessions sign in again after this update. |
| 2 | High | Config | No production security settings (HTTPS redirect, HSTS, secure cookies, proxy header); a development `.env` or weak secret could reach production. | **Fixed.** With `DEBUG` off: start-up refuses a weak/placeholder `DJANGO_SECRET_KEY`, missing/`*` `DJANGO_ALLOWED_HOSTS` and an empty `DB_PASSWORD` (no trust auth); HTTPS redirect, HSTS (1 day, raise later), secure cookies, `X-Frame-Options: DENY`, nosniff, referrer policy; CORS allows nothing unless configured. `DEBUG` defaults to off. Custom `check --deploy` warnings for email and non-HTTPS CORS. |
| 3 | High | Stores | Google Play and the App Store require in-app **account deletion** for apps with account creation. | **Open — owner decision** on what to keep (orders are business records). Release blocker. |
| 4 | Medium | Auth | No password reset: customers who forgot their password were locked out. | **Fixed.** 6-digit emailed code: HMAC-stored, 15-minute expiry, single use, locked after 5 wrong tries, newer code cancels older, per-account limits (1/min, 5/hour, 10/day), per-IP limits, identical answers whether or not the account exists, email sent in the background (timing), no codes/emails in logs. |
| 5 | Medium | Auth | Django's built-in `/admin/` login had no rate limit and was always exposed. | **Fixed.** Off in production unless `DJANGO_ADMIN_PATH` is set (use an unguessable path). |
| 6 | Medium | API | Token refresh unthrottled; no overall per-IP / per-account limits. | **Fixed.** `refresh` 60/min, anonymous 300/min per IP, signed-in 600/min per account (all configurable). |
| 7 | Medium | Admin | Admin tokens are kept in `localStorage`/`sessionStorage`, readable by any injected script (XSS). | **Mitigated.** No third-party scripts; React escapes output; the nginx example sends a strict Content-Security-Policy; access tokens last 15 min. Full fix (refresh token in an httpOnly, SameSite cookie) depends on serving the portal and API from the same site — owner hosting decision. |
| 8 | Medium | Mobile | A release build could be configured with an `http://` API address. | **Fixed.** Release builds accept only `https://` (iOS ATS also blocks plain HTTP). |
| 9 | Medium | Mobile | Android manifest requested storage and "draw over other apps" permissions the app doesn't use (Play policy review). | **Fixed.** Blocked in `app.json`; the release manifest has only INTERNET and VIBRATE. |
| 10 | Medium | API | Customer and admin order lists were unordered on PostgreSQL (pages could repeat or skip orders). | **Fixed in Task 7** (explicit newest-first ordering, verified on PostgreSQL). |
| 11 | Low | API | Browsable HTML API enabled in production. | **Fixed.** JSON only when `DEBUG` is off. |
| 12 | Low | Ops | No logging configuration; scanners' bad Host headers would flood logs with tracebacks. | **Fixed.** Structured logs to stdout; 4xx not logged as errors; `DisallowedHost` silenced; nginx example drops unknown hosts. |
| 13 | Low | Ops | Rate-limit counters are per process by default. | **Configured.** `DJANGO_CACHE=database` (+ `createcachetable`) shares them; set in the production template. |
| 14 | Low | Mobile | Expo Doctor: 5 packages behind SDK 58 patch versions; no dev client for a development build profile; Android ignored the light-only UI setting. | **Fixed.** `expo install --fix`, `expo-dev-client`, `expo-system-ui`; Expo Doctor 20/20. |
| 15 | Low | Deps | `npm audit` (mobile): 28 moderate advisories in build tooling (glob/minimatch via Expo CLI and Jest). Not part of the app bundle; the suggested "fix" downgrades Expo to SDK 53. | **Accepted.** Re-check after future Expo updates. Admin portal: 0 advisories. Backend: Django 5.2.18 (LTS, supported to April 2028) and DRF 3.16.1 are the latest patches of their series. |
| 16 | Low | Auth | Registration says when an email is already registered (account enumeration). | **Accepted** (normal sign-up UX; registration is rate-limited). Password reset reveals nothing. |
| 17 | Low | Admin | Dead demo-login CSS. Unused demo product SVGs in `public/products/` are still copied into the build (no credentials). | CSS **removed**; the SVGs can be deleted by the owner. No demo credentials in the source or build (verified). |
| 18 | Info | DB | Local PostgreSQL uses `trust` authentication. | Development only; production refuses an empty `DB_PASSWORD` and the guide requires `scram-sha-256`. `alzaryab_user` has no superuser/CREATEDB/CREATEROLE rights. |
| 19 | Info | Ops | No automated backups or monitoring existed. | **Prepared.** `deploy/backup.sh` (tested with `pg_dump`), restore steps, health-check monitoring guidance. Restore itself not yet tested. |

## Checked and in good order

* **Passwords:** PBKDF2 (Django default), Django password validators (length, common, numeric, similarity),
  never logged or returned; constant-time login with a dummy hash for unknown emails.
* **JWT:** 15-minute access tokens, 7-day refresh tokens with rotation and blacklisting, logout revokes,
  staff and customer tokens only work on their own endpoints (role checked at login, refresh and every request).
* **Authorization:** secure by default (`IsAuthenticated`); public endpoints opt in. Customers only ever see
  their own profile, addresses and orders (others' return 404) — verified live with two customers.
  Customers cannot use admin endpoints (403) and staff cannot use customer endpoints (403).
* **Input validation:** serializers on every write; prices and totals always computed by the server;
  quantity and line limits; order idempotency per customer (`requestId`).
* **Uploads:** images only (JPEG/PNG/WEBP verified by Pillow, extension must match, ≤5 MB), random file
  names, served with `nosniff`.
* **CSRF:** the API uses bearer tokens (no cookies), so CSRF does not apply; Django admin keeps Django's CSRF
  protection with `CSRF_TRUSTED_ORIGINS`.
* **Secrets:** all from environment variables; `.env` is development-only; no secrets in the mobile app
  (`EXPO_PUBLIC_*` holds only the API address); tokens in the device keychain/keystore (SecureStore).
* **Concurrency (PostgreSQL):** 12 buyers for 5 units → exactly 5 orders; no deadlocks; 8 identical
  submissions → 1 order; double cancellation restores stock once; 3 simultaneous resets with one code → 1 wins.
