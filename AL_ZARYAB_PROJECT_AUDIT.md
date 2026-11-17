# Al Zaryab Cash & Carry — Comprehensive Project Audit

**Audit date:** 14 Nov 2026 · **Scope:** whole repository at `~/Project/cashandcarry` (admin portal, Django API,
PostgreSQL database, Expo mobile app, documentation) · **Mode:** inspection only — no application code,
configuration, dependencies or data were changed. The only file written is this report.

### How to read the evidence

| Label | Meaning |
| --- | --- |
| **Verified today** | Command or query run during this audit (14 Nov 2026) with the result shown. |
| **Verified 3 Nov** | Verified during the Task 8 release-preparation work (integration run in a temporary PostgreSQL schema, Chrome browser tests, concurrency tests). Not re-run today because those tests need write access to a temporary schema, and this audit is read-only. Code has not changed since (no file in the project is newer than the Task 8 documents, apart from build output). |
| **Code evidence** | Read from source code; not executed. |
| **Assumption** | Reasoned, not proven. Marked explicitly. |

There is **no Git repository**, so "has not changed since" is based on file modification times, not version history.

---

## 1. Executive Summary

Al Zaryab Cash & Carry consists of three working applications sharing one PostgreSQL database:

1. **Admin Portal** (React 19 + Vite) — staff sign-in, dashboard, products with images, categories, orders with
   status workflow. Connected to the real API (no mock data).
2. **Django REST API** (Django 5.2 LTS, DRF, SimpleJWT) — 25 endpoints for staff, the public catalogue and
   customers: catalogue, authentication with password reset, addresses, server-priced quotes, idempotent Cash on
   Delivery orders, cancellation, and inventory movement logging.
3. **Customer mobile app** (Expo SDK 58, React Native 0.88, TypeScript) — browsing, search, categories, cart,
   checkout, orders, profile, addresses, registration, login and password recovery, all using the live API.

**What was verified today:** all automated suites pass (backend 134 tests, 1 skipped by design; admin 42;
mobile 178 in 30 files), TypeScript compiles, both mobile production bundles export (iOS and Android), the admin
production build succeeds and contains no demo credentials, all 39 migrations are applied, and the API answers
correctly against the real database (health OK; protected endpoints refuse anonymous requests).

**Development stage:** feature-complete for a first release of a single-store, Cash-on-Delivery grocery
ordering system, **but not production-ready**.

**Main gaps and blockers:**

* **Never run on a physical phone, simulator or emulator.** Native runtime behaviour is unproven.
* **The real database has no sellable products** (both products are deactivated test leftovers), so the
  mobile catalogue is currently empty until the owner adds products.
* **Customer account deletion is missing** — required by Google Play and the App Store.
* **No hosting, domain, HTTPS, email provider, store accounts or final artwork** yet (configuration is
  prepared; external services need the owner).
* **No version control (Git) or CI** — every change so far is untracked.
* **New dependency advisories since 3 Nov:** 2 high-severity advisories in the admin portal's Vite dev server
  (development tooling; patch available) and Expo SDK 58 patch drift (`expo-doctor` 19/20).
* Retail-management features beyond online ordering (customer list, staff management, stock history UI,
  reports, in-store sales) are **not built**.

**Scalability:** measured at small scale only (1,011 products / 150 orders: every endpoint under 20 ms, no
N+1 queries, 3 Nov). There is **no load-test evidence** for 100,000 customers; several known changes (search
indexes, image thumbnails, shared cache, background jobs, object storage) are needed before that scale.

---

## 2. Project Architecture

```
┌────────────────────┐    HTTPS (prod) / HTTP (dev)    ┌───────────────────────────────┐
│ Admin Portal       │ ── Bearer JWT (staff) ────────▶ │ Django 5.2 + DRF  (/api/...)  │
│ React 19 + Vite    │                                 │  apps: core, accounts,        │
│ (browser)          │                                 │  catalog, inventory,          │
└────────────────────┘                                 │  customers, orders            │──▶ PostgreSQL 17
┌────────────────────┐                                 │  media/ (product images)      │    alzaryab_db
│ Customer app       │ ── Bearer JWT (customer) ─────▶ │                               │
│ Expo SDK 58 / RN   │    + public catalogue           └───────────────────────────────┘
└────────────────────┘
```

* **One user model** (`apps/accounts/models.py: User`) for staff and customers; `is_staff` separates the roles.
  Each login and refresh endpoint checks the role (`can_use_admin_portal`, `is_customer`), and every request is
  checked by the permission classes `IsStaff` / `IsCustomer` (`apps/core/permissions.py`).
* **Authentication:** stateless JWT (SimpleJWT) — 15-minute access tokens, 7-day refresh tokens with rotation and
  blacklisting; tokens carry a password fingerprint so a password change ends all sessions
  (`apps/accounts/tokens.py`, `apps/accounts/authentication.py`).
* **Server is the authority** for prices, delivery fee, totals and stock (`apps/orders/services.py`).
* **Media** (product images) on the API server's local disk (`backend/media/`).

## 3. Technology Stack

| Layer | Technology (installed versions, verified today) |
| --- | --- |
| Admin Portal | React 19.3, React DOM 19.3, React Router 7.18.4 (hash routing), Vite 8.3.0, lucide-react 1.47, plain CSS; tests with Node's built-in test runner |
| Backend | Python 3.13.3, Django 5.2.18 (LTS, supported to Apr 2028), DRF 3.16.1, SimpleJWT 5.5.1 (+ blacklist app), django-cors-headers 4.9.0, psycopg 3.3.7, Pillow 12.3.0, python-dotenv 1.2.4; production adds gunicorn (`requirements-prod.txt`, not installed locally) |
| Database | PostgreSQL 17.11 (Homebrew service `postgresql@17`), database `alzaryab_db` |
| Mobile | Expo SDK 58 (`expo` 58.0.22), React Native 0.88.1, React 19.3, TypeScript ~6.0, Expo Router 58.0.29, TanStack Query 5.104.5, expo-secure-store, AsyncStorage 2.2.0, expo-dev-client, expo-system-ui; Jest 30 + jest-expo + React Native Testing Library 14 |
| Build / release | EAS Build profiles in `mobile/eas.json` (not yet linked to an Expo account) |
| Deployment (prepared, not deployed) | gunicorn, systemd unit, nginx example, backup script (`backend/deploy/`) |

## 4. Repository Structure

```
cashandcarry/
├── src/                     Admin Portal source (70 files, ~6.8k lines incl. CSS)
│   ├── pages/               Login, Logout, Dashboard, Products, Add/Edit Product, Categories, Orders, OrderDetail
│   ├── components/          26 UI components (forms, tables, modals, badges, ImageUpload, ProtectedRoute…)
│   ├── services/            apiClient, authService, session, productService, categoryService, orderService (+ 4 test files)
│   ├── context/, layout/, utils/, styles/, data/categories.js (fallback list)
├── public/                  favicon + 14 unused demo product SVGs (public/products/)
├── dist/                    Admin production build (up to date with source; verified today by identical hash)
├── backend/                 Django project (apps ~4.3k lines, config ~0.4k)
│   ├── config/              settings.py, settings_test.py, urls.py, wsgi/asgi
│   ├── apps/                core, accounts, catalog, inventory, customers, orders (each with tests.py)
│   ├── deploy/              gunicorn.conf.py, alzaryab-api.service, nginx.conf.example, api.env.example, backup.sh
│   ├── media/products/      2 uploaded images
│   ├── requirements.txt, requirements-prod.txt, .env (local, not shown), .env.example, README.md
├── mobile/                  Expo app (src ~6.0k lines, __tests__ ~2.9k lines, 30 test files)
│   ├── src/app/             Expo Router routes ((tabs), (customer), product, category, search, login, register, forgot/reset-password)
│   ├── src/screens/         17 screens · src/components/ 24 components · src/api, auth, cart, checkout, hooks, lib, config, theme, utils
│   ├── app.json, eas.json, package.json, README.md, .env.example
├── docs/                    UAT_TESTING_GUIDE.md, DEPLOYMENT.md, SECURITY_REVIEW.md
├── README.md                Admin portal guide + links
├── PROJECT_OVERVIEW.md/.docx  Sep 2026 overview of the original demo-only frontend — OUTDATED (see §12)
└── .gitignore               Present, but there is no Git repository
```

**Configuration and environment dependencies:** `backend/.env` (development values; database password empty
because local PostgreSQL uses trust authentication), `.env.development` (`VITE_API_URL=http://localhost:8000/api`,
not secret), mobile `EXPO_PUBLIC_API_URL` (optional in development; HTTPS required in release builds). Production
variables are documented in `backend/deploy/api.env.example` and `docs/DEPLOYMENT.md`.

---

## 5. Admin Portal Status

**API connectivity:** all data goes through `src/services/apiClient.js` (bearer token, automatic refresh on 401,
"Session expired" handling). Endpoints used: `/auth/login|refresh|logout|me`, `/products/` (+ `summary`,
`{id}`), `/categories/` (+ `include_inactive`), `/orders/` (+ `summary`, `{id}`, `{id}/status/`). No mock data in
use (the old demo data and demo login were removed in Task 3; verified today: no demo credentials in source or build).

| Feature | Status | Evidence |
| --- | --- | --- |
| Login (email/password, show/hide, Remember me, validation, wrong-password and rate-limit messages) | **Implemented and verified** | `src/pages/LoginPage.jsx`, `src/context/AuthContext.jsx`, `authService.test.js` (passes today); Chrome E2E incl. wrong password and "Too many attempts" (3 Nov) |
| Protected routes, logout, session expiry | **Implemented and verified** | `ProtectedRoute.jsx`, `LogoutPage.jsx`; Chrome E2E: redirect to login, logout revokes refresh token, password change ends session with "Session expired" (3 Nov) |
| Dashboard (total / low / out-of-stock cards, low-stock table) | **Implemented and verified** | `DashboardPage.jsx` → `/products/summary/`; Chrome E2E cards matched DB counts (3 Nov) |
| Products: list, search, category & stock filters (in URL), pagination | **Implemented and verified** | `ProductsPage.jsx`, `productService.test.js` (today); E2E (3 Nov) |
| Add / edit / remove (soft delete) product | **Implemented and verified** | `AddProductPage.jsx`, `EditProductPage.jsx`, `RemoveProductModal.jsx`, `ProductForm.jsx`; E2E add + edit (3 Nov), remove (Task 3) |
| Product image upload (JPG/PNG/WEBP ≤ 5 MB, preview, server-side content check) | **Implemented and verified** | `ImageUpload.jsx`, `utils/image.js`; backend `apps/catalog/validators.py`; E2E upload served to mobile catalogue (3 Nov) |
| Categories: list, add, rename, deactivate (refused while it has active products) | **Implemented and verified** | `CategoriesPage.jsx`; E2E (Task 4 and 3 Nov) |
| Inventory: stock editing with movement log | **Partially implemented** | Stock is edited on the product form and each change is logged (`inventory_stockmovement`, verified 3 Nov). **No stock-history screen**: backend `GET /api/products/{id}/stock-movements/` exists but no admin service calls it (grep today). No bulk stock adjustment, suppliers or purchase orders. |
| Orders: list, search, status filter, summary cards, detail, status workflow (Confirm → Preparing → Out for Delivery → Delivered, Cancel with reason) | **Implemented and verified** | `OrdersPage.jsx`, `OrderDetailPage.jsx`, `orderService.test.js` (today); E2E full lifecycle, stock restored on cancel (3 Nov) |
| Customer management | **Partially implemented** | Customer name, email, phone, order count and join date appear **only inside an order** (`OrderDetailPage.jsx:259-272`). No customer list, search, profile or deactivation; the API has no staff customer endpoints. |
| Staff / admin user management | **Missing** | No UI or API; staff accounts are created with `manage.py createsuperuser`. |
| Reports / analytics (sales, top products) | **Missing** (beyond the orders summary card: delivered revenue, last 7 days) | `/api/orders/summary/` only |
| Error handling and validation | **Implemented and verified** | Field validation (`utils/validation.js`), API error mapping, toasts, error/empty/skeleton states; covered by service tests (today) |
| Responsive design | **Implemented but untested on devices** | CSS media queries (`styles/pages.css` 8, `layout.css` 2, `global.css` 1); collapsible sidebar. Only desktop viewport (1366×900) exercised in E2E. |
| Category dropdown fallback | **Placeholder** | `src/utils/useCategories.js` falls back to the hardcoded `src/data/categories.js` list when the API can't be reached (server still validates on save). |
| Automated UI tests | **Missing** | Only service/utility tests (42) in the repo. The Chrome E2E scripts used on 3 Nov live in a temporary session folder, **not in the repository**. |

**Build:** `vite build` succeeds today (404 kB JS, 125 kB gzipped); output identical to the committed `dist/`.

---

## 6. Backend Status

### 6.1 Django apps

| App | Responsibility | Key files |
| --- | --- | --- |
| `core` | Health check, permissions (`IsStaff`, `IsCustomer`), pagination (10 default, max 100), exception handler (DB conflicts → 409), deploy checks | `views.py`, `permissions.py`, `pagination.py`, `exceptions.py`, `checks.py` |
| `accounts` | Custom `User` (email login, unique case-insensitive email, unique phone), staff login/refresh/logout/me, password-bound JWTs | `models.py`, `views.py`, `serializers.py`, `tokens.py`, `authentication.py` |
| `catalog` | `Category`, `Product` (soft delete, availability, stock, image), staff CRUD + summary + stock history, public catalogue | `models.py`, `views.py`, `public.py`, `serializers.py`, `validators.py` |
| `inventory` | `StockMovement` log (initial, adjustment, order, order_cancelled), stock status rules (0 out, 1–5 low) | `models.py`, `services.py`, `stock.py` |
| `customers` | Registration, profile, `Address` book (≤10, one default), password reset (`PasswordResetCode`) | `views.py`, `serializers.py`, `password_reset.py`, `models.py` |
| `orders` | `Order`, `OrderItem`, `OrderStatusChange`; quote, idempotent placement with row locks, lifecycle, cancellation with restock; admin order API | `models.py`, `services.py`, `views.py`, `serializers.py` |

### 6.2 Models and relationships (code evidence, matches DB — see §7)

* `User` 1—* `Address`, `Order`, `PasswordResetCode`, `StockMovement.created_by`, `OrderStatusChange.changed_by`
* `Category` 1—* `Product` (PROTECT)
* `Product` 1—* `StockMovement`, `OrderItem`
* `Order` 1—* `OrderItem`, `OrderStatusChange`, `StockMovement` (order link)
* Orders copy the delivery address and line prices (history never changes when addresses or prices change).

### 6.3 API inventory (verified today from Django's URL configuration)

Every route also has an automatic `.json` format-suffix variant (DRF router), omitted below.

| Endpoint | Method | Purpose | Authentication | Status |
| --- | --- | --- | --- | --- |
| `/api/health/` | GET | Liveness + DB check | Public | Verified today (200) |
| `/api/auth/login/` | POST | Staff login → tokens | Public (rate-limited 10/min) | Verified (tests today, E2E 3 Nov) |
| `/api/auth/refresh/` | POST | Rotate staff tokens | Refresh token (60/min) | Verified (tests; 401 on junk today) |
| `/api/auth/logout/` | POST | Blacklist refresh token | Refresh token | Verified (tests, E2E) |
| `/api/auth/me/` | GET | Current staff user | Staff (`IsAdminUser`) | Verified (tests; 401 anonymous today) |
| `/api/categories/` | GET, POST | List (incl. inactive) / create | Staff | Verified (tests, E2E) |
| `/api/categories/{id}/` | GET, PUT, PATCH, DELETE | Read / rename / reactivate / deactivate | Staff | Verified (tests, E2E) |
| `/api/products/` | GET, POST | Search/filter/paginate / create (multipart image) | Staff | Verified (tests, E2E) |
| `/api/products/{id}/` | GET, PUT, PATCH, DELETE | Read / update / soft-delete | Staff | Verified (tests, E2E) |
| `/api/products/summary/` | GET | Dashboard counts | Staff | Verified |
| `/api/products/{id}/stock-movements/` | GET | Stock history | Staff | Implemented and tested; **unused by the admin UI** |
| `/api/orders/` | GET | Search/filter orders (newest first) | Staff | Verified (tests, E2E, PostgreSQL ordering 3 Nov) |
| `/api/orders/summary/` | GET | Counts and revenue | Staff | Verified |
| `/api/orders/{id}/` | GET | Detail incl. customer, history, allowed transitions | Staff | Verified |
| `/api/orders/{id}/status/` | POST | Lifecycle transition (+ restock on cancel) | Staff | Verified (tests, E2E, concurrency) |
| `/api/catalog/products/` | GET | Public catalogue (search, category, paging) | Public | Verified today (returns 0 products — none on sale) |
| `/api/catalog/products/{id}/` | GET | Public product | Public | Verified today (404 for deactivated product) |
| `/api/catalog/categories/` | GET | Categories with products on sale | Public | Verified today (`[]`) |
| `/api/customer/auth/register/` | POST | Create customer (never staff) | Public (20/hour) | Verified (tests, live 3 Nov) |
| `/api/customer/auth/login/` | POST | Customer login (staff refused 403) | Public | Verified |
| `/api/customer/auth/refresh/` | POST | Rotate customer tokens | Refresh token | Verified |
| `/api/customer/auth/logout/` | POST | Revoke refresh token | Refresh token | Verified |
| `/api/customer/auth/password-reset/` | POST | Email a 6-digit code (generic answer) | Public (10/hour/IP + per-account caps) | Verified with file-based email (3 Nov); **real email delivery not verified** |
| `/api/customer/auth/password-reset/confirm/` | POST | Set new password, end sessions | Public (20/hour/IP) | Verified (tests, live, concurrency) |
| `/api/customer/profile/` | GET, PATCH | Own profile (email read-only) | Customer | Verified |
| `/api/customer/addresses/` (+ `{id}/`) | GET, POST, PUT, PATCH, DELETE | Own address book | Customer | Verified (incl. isolation between customers) |
| `/api/customer/orders/` | GET, POST | Own history / place COD order (`requestId` idempotency) | Customer | Verified |
| `/api/customer/orders/quote/` | POST | Server prices, fee, total, stock problems | Customer | Verified |
| `/api/customer/orders/{id}/` | GET | Own order | Customer | Verified (others' → 404) |
| `/api/customer/orders/{id}/cancel/` | POST | Cancel while Pending | Customer | Verified |
| `/admin/` | — | Django built-in admin | Session | On in development; **off in production** unless `DJANGO_ADMIN_PATH` is set |

**Backend capabilities with no frontend:** stock-movement history; Django admin. **Frontend needs with no
backend:** customer list/management, staff management, account deletion, reports, push notifications.

### 6.4 Business logic, security and configuration (code evidence + tests)

* **Orders** (`apps/orders/services.py: place_order, quote_order, change_status`): products locked in id order
  (`select_for_update`), every line re-checked (active, available, category active, stock, ≤100 per item, ≤50
  lines), priced from the database, stock deducted and logged in one transaction; `requestId` unique per customer
  prevents duplicates; cancellation restores stock exactly once. DB constraints back this (§7).
* **Uploads:** Pillow-verified format, extension must match, ≤5 MB, random file names (`apps/catalog/validators.py`).
* **Security settings** (`config/settings.py`): fail-closed production mode (refuses weak secret key, missing
  allowed hosts, empty DB password), HTTPS redirect, HSTS (1 day default), secure cookies, security headers,
  JSON-only renderer, CORS allow-list, rate limits (scoped + per-IP + per-account). `check --deploy` with
  production placeholder values today: only `security.W005`/`W021` (HSTS subdomains/preload — owner decisions).
* **Error handling:** DRF errors + 409 for DB integrity conflicts (`apps/core/exceptions.py`); safe JSON errors in
  production (verified 3 Nov).
* **Logging:** structured stdout logging; 4xx not logged as errors; no passwords/tokens/codes logged. No
  error-tracking service.
* **Email:** console backend in development (reset codes printed in the `runserver` window); SMTP from
  environment variables in production (no provider configured).
* **Tests (verified today):** 134 tests — accounts 21, catalog 47, core 1, customers 32, orders 33; 1 skipped
  (`ConcurrentOrderTests` requires PostgreSQL; its scenarios passed on PostgreSQL on 3 Nov, 14/14).
* **Environment checks today:** `manage.py check` — no issues; `makemigrations --check` — no changes.

---

## 7. Database Status

**Connection (from `backend/.env`, password not shown):** PostgreSQL 17.11 on `localhost:5432`, database
`alzaryab_db`, role `alzaryab_user`, `DB_PASSWORD` empty (local trust authentication — development only;
production settings refuse to start without a password). Role privileges (verified today): not superuser,
cannot create databases; owns `alzaryab_db`. Database size 9.9 MB. Only the `public` schema exists (all temporary
test schemas from earlier tasks were dropped).

**Migration status (verified today):** 39 project migrations applied across accounts (4), catalog (2), customers
(2), inventory (2), orders (1) plus Django/SimpleJWT apps; `django_migrations` has 41 rows; no pending model changes.

### 7.1 Tables verified in the running database (exact row counts today)

| Table | Rows | Notes |
| --- | --- | --- |
| `accounts_user` | 2 | 1 active superuser (staff); 1 **deactivated** non-staff account (test account left from Task 3) |
| `catalog_category` | 12 | All active (seeded by migration `catalog.0002_seed_categories`) |
| `catalog_product` | 2 | **Both deactivated and unavailable** (soft-deleted test products) → public catalogue is empty |
| `inventory_stockmovement` | 4 | 2 initial + 2 adjustments (from the test products) |
| `customers_address`, `customers_passwordresetcode` | 0 | |
| `orders_order`, `orders_orderitem`, `orders_orderstatuschange` | 0 | No orders ever placed in the real database |
| `token_blacklist_outstandingtoken` / `blacklistedtoken` | 7 / 4 | All 7 outstanding tokens already expired (no cleanup job) |
| Django tables (`auth_permission` 64, `django_content_type` 16, sessions 0, admin log 0, groups 0) | — | |

### 7.2 Integrity (verified today in `pg_constraint` / `pg_indexes`)

* **Foreign keys:** 15 on application tables (product→category, movement→product/order/user, address→user,
  order→user, item→order/product, status change→order/user, reset code→user). Delete rules are enforced by Django
  (`on_delete`); in PostgreSQL they are `NO ACTION`.
* **Check constraints:** product price > 0, stock ≥ 0; movement change ≠ 0, quantity after ≥ 0; order subtotal ≥ 0,
  fee ≥ 0, **total = subtotal + fee**, status in the allowed set; item quantity > 0, unit price > 0, **line total =
  price × quantity**; reset-code attempts ≥ 0.
* **Unique constraints/indexes:** case-insensitive email (`user_email_unique_ci`), phone (`user_phone_unique`),
  category name case-insensitive, active product name+unit, order reference, `(customer, request_id)`
  (idempotency), one line per product per order, **one default address per customer** (partial unique).
* **Performance indexes:** `product_active_stock_idx (is_active, stock)`, `order_status_created_idx (status,
  -created_at)`, `reset_code_user_created_idx`, plus FK indexes. **No trigram/full-text index** (`pg_trgm` not
  installed) — "contains" searches scan the table.

### 7.3 Data integrity concerns

* Test leftovers in the real database: deactivated test user, 2 soft-deleted products and their 4 stock movements,
  expired token rows. Harmless, but they should be cleaned or documented before go-live (owner decision; do not
  delete without approval).
* No periodic cleanup of expired JWT rows (`flushexpiredtokens`) or used/expired reset codes — tables grow forever.
* Order history keeps customers' personal data (delivery name, phone, address) — relevant for account deletion and
  privacy policy (owner decision on retention).

### 7.4 Scalability considerations (schema)

Fine for one store. For 100k+ customers: add trigram indexes for product/order search, an index on
`orders_order (customer_id, created_at DESC)` for history, change login lookups to use the existing
`lower(email)` index (currently `email__iexact`, which PostgreSQL can't serve from that index), and partition or
archive `inventory_stockmovement` and token tables over time (assumption: volumes unknown).

---

## 8. Mobile Application Status

**Architecture:** Expo Router file routes (`mobile/src/app`), screens in `src/screens`, TanStack Query for server
data (caching, retries only for network/5xx, cancellation, app-focus refresh), React contexts for auth
(`AuthProvider`) and cart (`CartProvider`), a small external store for checkout (`checkout/checkoutStore.ts`).
Tokens in SecureStore (keychain/keystore); cart, cached profile and pending order submission in AsyncStorage.
One API client (`src/api/client.ts`) with 15 s timeouts (30 s for placing orders), single-flight token refresh,
safe error messages.

**Network configuration:** `src/config/api.ts` — development uses the Expo host's LAN address on port 8000 (no
hardcoded IP; Android emulator falls back to 10.0.2.2); release builds require `EXPO_PUBLIC_API_URL` and accept
only `https://`. **Expo Go on a phone needs:** same Wi-Fi, Django on `0.0.0.0:8000`, the Mac's LAN IP in
`DJANGO_ALLOWED_HOSTS` (local `.env` currently allows only `localhost,127.0.0.1`), firewall allowing Python —
documented in `docs/UAT_TESTING_GUIDE.md`. **Never tried on a phone.**

**Image loading/caching:** React Native `Image` with `cache: 'force-cache'` (iOS) and Android's default cache,
`resizeMethod="resize"` on Android, placeholder on missing/failed images (`src/components/ProductImage.tsx`).
The API serves **full-size uploads (up to 5 MB) even for thumbnails** — no server-side resizing.

**iOS/Android compatibility:** both production JavaScript bundles export today (2.9 MB each). Native projects were
generated successfully with `expo prebuild` in a throwaway copy on 3 Nov (identifiers, minimal Android
permissions, iOS HTTPS-only). **No native build, simulator, emulator or device run has ever been performed.**

### 8.1 Screen-by-screen assessment

Answers to: (1) exists, (2) UI complete, (3) data source, (4) interactions work, (5) API-connected,
(6) tested, (7) remaining. "Tests" = Jest + React Native Testing Library screen tests against a stateful fake of
the real API (passing today); "live" = exercised against the real Django API in a temporary schema (Task 7/8).

| Screen (route) | 1 | 2 | 3 Data | 4 | 5 | 6 Tested | 7 Remaining |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Home `(tabs)/index` | Yes | Yes | Real API | Yes | Yes | Tests + live catalogue contract | Device run; real products in DB |
| Categories `(tabs)/categories` | Yes | Yes | Real API | Yes | Yes | Tests + live | Device run |
| Category products `category/[name]` | Yes | Yes | Real API (infinite scroll) | Yes | Yes | Tests + live | Device run |
| Search `search` | Yes | Yes | Real API (debounced, cancellable) | Yes | Yes | Tests + live | Name-only search (backend) |
| Product details `product/[id]` | Yes | Yes | Real API | Yes (quantity, add to cart) | Yes | Tests | Device run |
| Cart `(tabs)/cart` | Yes | Yes | Local (AsyncStorage) + live re-check | Yes | Yes (`/catalog/products/{id}/` per item) | Tests + live check | One request per cart item (no batch endpoint) |
| Checkout `(customer)/checkout` | Yes | Yes | Server quote + addresses | Yes (idempotent submit, retry) | Yes | Tests (success, retry, expiry, failures) + live | Device run; COD only |
| Order confirmation (`orders/[id]?placed=1`) | Yes | Yes | Real API | Yes | Yes | Tests | — |
| Order history `(customer)/orders` | Yes | Yes | Real API (paged) | Yes | Yes | Tests + live | — |
| Order details `(customer)/orders/[id]` | Yes | Yes | Real API | Yes (cancel when allowed) | Yes | Tests + live | No push notifications for status changes |
| Account / profile `(tabs)/account`, `(customer)/profile` | Yes | Yes | Real API | Yes (edit name/phone, sign out) | Yes | Tests + live | **Account deletion missing** |
| Addresses list/new/edit `(customer)/addresses/*` | Yes | Yes | Real API | Yes | Yes | Tests + live (isolation) | — |
| Login `login` | Yes | Yes | Real API | Yes (return to checkout) | Yes | Tests + live | — |
| Register `register` | Yes | Yes | Real API | Yes | Yes | Tests + live | — |
| Forgot / reset password | Yes | Yes | Real API | Yes | Yes | Tests + live (file email) | Real email provider |

**Loading/error states:** skeletons, loading, empty, offline and error-with-retry states on every data screen
(verified by tests). **Accessibility:** labelled controls, 48-pt targets, screen-reader roles (code evidence;
not tested with VoiceOver/TalkBack). **Not present:** push notifications, online payment, wish lists, reviews,
promotions, multi-language (Urdu) UI, offline browsing beyond the saved cart.

**Release configuration:** identifiers `pk.alzaryab.customer` (placeholder awaiting owner confirmation), EAS
profiles defined, `eas init` not run, template app icons and splash (placeholders), `supportsTablet: true`
without iPad testing.

---

## 9. API and Integration Status

| Integration question | Status | Evidence |
| --- | --- | --- |
| Admin ↔ Django | **Verified** | Unit tests today; Chrome E2E against production build (3 Nov, 36/36 combined checks) |
| Mobile ↔ Django | **Verified in tests and against the live API contract; NOT verified on a device** | Jest suites today; live contract runs (Task 6: 36/36, Task 7: 65 checks, Task 8: customer journey) |
| Django ↔ PostgreSQL | **Verified** | Health today; migrations applied; concurrency 14/14 on PostgreSQL (3 Nov) |
| Product created in admin appears in mobile | **Verified (3 Nov)** | E2E: product with image added in Chrome → public catalogue returned it with a working image URL and "low" stock |
| Product updates synchronise | **Verified (3 Nov)** | Price/stock edit in admin reflected in public catalogue; mobile cart check detects price changes (Task 6 live run) |
| Inventory changes reflected | **Verified (3 Nov)** | Order deducts stock once; cancellation restores it; admin edits logged as movements |
| Authentication across roles | **Verified** | Staff tokens refused on customer API and vice versa (403); staff refused by customer login; tests today |
| Cart validation uses authoritative backend data | **Verified** | Cart re-reads each product and the server quote before checkout; server re-checks on placement (tests + live) |
| Orders submitted and persisted | **Verified (3 Nov)** | Order stored, idempotent resend returns same order, history newest first |
| Backend errors handled | **Verified in tests** | Stock problems, invalid address, expired session, network loss, 5xx → clear messages; cart kept |

**Mismatches / gaps:** stock history API unused; no staff customer endpoints; mobile cart check makes one request per
item (no batch endpoint); no push/real-time order updates (pull-to-refresh only).

---

## 10. Testing and Build Results

| Check | Result (14 Nov unless noted) |
| --- | --- |
| Backend `manage.py check` | **PASS** — no issues |
| Backend `check --deploy` (simulated production values) | **PASS with 2 optional warnings** (HSTS subdomains / preload) |
| Migrations applied / pending changes | **PASS** — all applied; none pending |
| Backend tests (in-memory SQLite) | **PASS** — 134 run, 1 skipped (PostgreSQL-only) |
| Admin tests | **PASS** — 42/42 |
| Admin production build | **PASS** — no demo credentials in output |
| Mobile TypeScript | **PASS** |
| Mobile tests | **PASS** — 178/178 in 30 files |
| Mobile Expo config | **PASS** |
| `expo-doctor` | **19/20** — 8 packages behind newer SDK 58 patch releases published after 3 Nov |
| iOS + Android bundle export | **PASS** (2.9 MB each) |
| Read-only API probe against real DB | **PASS** — health OK, empty catalogue, 401 on protected endpoints |
| `npm audit` admin | **2 high** (Vite 8.3.0 dev server; source-map-js) — new since 3 Nov; fix available |
| `npm audit` mobile | 27 (1 low, 26 moderate) in build tooling (glob, minimatch, node-forge, deepmerge) — not in the app bundle |
| Integration E2E (Chrome + customer API, temp schema) | **PASS 36/36 (3 Nov)** — not re-run (needs write access) |
| PostgreSQL concurrency | **PASS 14/14 (3 Nov)** — not re-run |
| Performance (1,011 products, 150 orders) | **PASS (3 Nov)** — all endpoints < 20 ms, no N+1 — not re-run |
| Native prebuild | **PASS (3 Nov)** — not re-run |
| Physical device / simulator / emulator | **NOT TESTED** — none available; Xcode/Android Studio not installed |
| Real email delivery | **NOT TESTED** — no provider |
| Backup restore | **NOT TESTED** (backup creation tested 3 Nov) |
| Load testing | **NOT DONE** |

**Missing tests:** admin UI component/E2E tests in the repository; reproducible integration/E2E suite in the repo
(the scripts used live in a temporary folder); device/accessibility testing; load tests; restore drill; CI pipeline.

---

## 11. Security and Scalability Assessment

### 11.1 Security (current state)

| Area | Assessment |
| --- | --- |
| Authentication | Strong: JWT with short access life, rotation, blacklist, password-bound tokens, constant-time login, role-separated endpoints, rate limits. |
| Password storage | Django PBKDF2 (verified in DB on 3 Nov); validators for length, common, numeric, similarity. |
| Authorization & data isolation | Secure-by-default permissions; customers see only their own data (verified with two accounts). |
| Sensitive data | Mobile tokens in SecureStore; admin tokens in browser storage (**XSS exposure**, mitigated by CSP in the nginx example, not eliminated). No secrets in mobile config. |
| API security | Input validation on every write; server-side pricing; idempotency; upload validation; CORS allow-list; JSON-only in production. |
| Secrets management | Environment variables; development `.env` must never be deployed (documented). |
| Transport | HTTPS enforced by settings in production and by the app in release builds — **not yet deployed**. |
| Dependencies | Admin Vite advisories (high, dev tooling) need patching; mobile tooling advisories accepted. |
| Process | **No version control or CI**: no audit trail, no reviews, no rollback. |

### 11.2 Readiness for 100,000+ customers

**No load test has been run; capacity for 100,000 customers (or any concurrent-user number) is unproven.**
Measured evidence covers ~1,000 products and 150 orders only.

| Area | Current | Needed for scale |
| --- | --- | --- |
| Pagination | All lists paginated (max 100) | Keyset pagination for very deep pages (offset cost) |
| Query performance | Constant query counts; indexes on hot filters | Trigram search indexes; `(customer_id, created_at)` order index; email lookup using `lower(email)` index |
| Concurrency / inventory consistency | Row locks, constraints, idempotency (verified) | Fine; monitor lock contention on hot products under load |
| Order processing | ~53 queries for a 20-line order (16 ms) | Bulk stock updates/movement inserts if order volume grows |
| Caching | Per-process cache unless `DJANGO_CACHE=database` | Redis for rate limits and catalogue caching |
| Media | Local disk, full-size images | Object storage + CDN, generated thumbnails |
| Background work | Reset email sent in a thread | Task queue (e.g. Celery/RQ) for email, notifications, cleanups |
| Deployment | Single-server design (gunicorn + nginx) | Multiple app servers behind a load balancer, managed PostgreSQL with replicas |
| Monitoring | Health endpoint + logs | Error tracking, metrics, alerting, uptime monitor |
| Backup & recovery | Backup script (tested); restore untested | Managed backups with point-in-time recovery; regular restore drills |

**Immediate development blockers** are listed in §12/§15 Phase 1–2; the scale items above are **future
improvements** (Phase 6) and not needed for a single-store launch.

---

## 12. Technical Debt and Known Issues

| ID | Severity | Issue | Location |
| --- | --- | --- | --- |
| TD-01 | High | Customer **account deletion missing** (Google Play / App Store requirement) | `mobile/src/screens/AccountScreen.tsx`, `backend/apps/customers/` |
| TD-02 | High | **No device testing** ever performed (iOS or Android) | `mobile/` |
| TD-03 | High | **No version control or CI** (no Git repository despite `.gitignore`) | project root |
| TD-04 | High | Admin dev tooling advisories: Vite 8.3.0 (cross-origin script execution via dev server, file disclosure) and source-map-js DoS; patch available | `package.json`, `package-lock.json` |
| TD-05 | Medium | Real database has **no active products** (only 2 deactivated test products); catalogue empty for testing/launch | `alzaryab_db.catalog_product` |
| TD-06 | Medium | Admin tokens in `localStorage`/`sessionStorage` (XSS-readable) | `src/services/session.js` |
| TD-07 | Medium | Real email delivery not configured or tested | `backend/config/settings.py` (EMAIL_*) |
| TD-08 | Medium | No stock-history screen although the API exists | `src/pages/` vs `apps/catalog/views.py` (`stock-movements`) |
| TD-09 | Medium | No customer management or staff management screens/APIs | admin portal, backend |
| TD-10 | Medium | E2E/integration test scripts not in the repository; no admin UI tests | `src/**/*.test.js` only |
| TD-11 | Medium | Full-size images served to mobile lists (no thumbnails); local-disk media | `apps/catalog/`, `backend/media/` |
| TD-12 | Medium | Search uses `icontains`, login uses `email__iexact` (table scans at scale) | `apps/catalog/public.py`, `apps/catalog/views.py`, `apps/accounts/views.py` |
| TD-13 | Medium | No scheduled cleanup of expired JWTs and reset codes | token_blacklist tables, `customers_passwordresetcode` |
| TD-14 | Medium | Rate limiting per process unless `DJANGO_CACHE=database` is set in production | `config/settings.py` |
| TD-15 | Low | `PROJECT_OVERVIEW.md` / `.docx` describe the old demo-only frontend ("no backend", demo data) | project root |
| TD-16 | Low | Expo SDK 58 patch drift (`expo-doctor` 19/20; 8 packages) | `mobile/package.json` |
| TD-17 | Low | Mobile build-tool advisories (27, moderate/low) | `mobile/package-lock.json` |
| TD-18 | Low | Hardcoded category fallback list | `src/data/categories.js`, `src/utils/useCategories.js` |
| TD-19 | Low | 14 unused demo product SVGs shipped in the admin build | `public/products/`, `dist/products/` |
| TD-20 | Low | Placeholder values awaiting owner: delivery fee Rs 150 / free-delivery threshold, app identifiers, template icons/splash, `supportsTablet` | `config/settings.py`, `mobile/app.json`, `mobile/assets/` |
| TD-21 | Low | Test leftovers in real DB (deactivated test user, 2 test products, 4 movements, expired tokens) | `alzaryab_db` |
| TD-22 | Low | Cart check makes one request per cart item (no batch endpoint) | `mobile/src/cart/cartCheck.ts` |
| TD-23 | Low | Registration reveals whether an email is registered (accepted UX trade-off) | `apps/customers/serializers.py` |
| TD-24 | Low | `/api/auth/me/` uses DRF `IsAdminUser` while other staff endpoints use `IsStaff` (equivalent today; inconsistent) | `apps/accounts/views.py: MeView` |
| TD-25 | Info | Local PostgreSQL trust authentication (development only; production refuses it) | `backend/.env` |

No **Critical** issues were found in the code. No duplicate business logic of note: pricing/validation is shared
between quote and placement (`apps/orders/services.py`), and cart rules live in one reducer.

---

## 13. Feature Completion Matrix

Percentages are given only where evidence supports them; they measure the scope of a **single-store Cash on
Delivery ordering system** (the scope defined in Tasks 1–8), not a full retail-management suite.

| Area | Estimate | Basis |
| --- | --- | --- |
| Admin Portal | ~80% | All planned screens implemented and E2E-verified; missing stock history UI, customer list, staff management, reports. |
| Backend | ~90% | All endpoints for current scope implemented and tested (134 tests); missing account deletion, staff/customer management APIs, scheduled cleanup. |
| Database | ~90% | Schema, constraints, migrations complete and verified; missing scale indexes and cleanup jobs; contains test leftovers, no real catalogue. |
| Mobile application | ~85% code / **0% device-verified** | All 17 screens implemented and tested in Jest; never run on a device; account deletion and real artwork missing. |
| API integrations | ~90% | Verified in tests and live runs; device-level integration unverified. |
| Authentication | ~95% | Login, refresh, logout, reset, role separation verified; admin token storage hardening and account deletion pending. |
| Inventory | ~70% | Stock, movements, low/out status, order deduction/restock verified; no history UI, purchasing, suppliers, stock counts. |
| Cart | ~95% | Complete and tested; device verification pending. |
| Checkout | ~90% | COD checkout with server quote, idempotency and recovery tested; device verification and online payments (out of scope) pending. |
| Orders | ~90% | Full lifecycle verified both sides; no notifications to customers. |
| Testing | ~60% | Strong unit/integration coverage; no device, load, admin-UI or CI testing; E2E scripts not in repo. |
| Deployment | ~35% | Configuration and documentation prepared and checked; nothing hosted; no domain, email, store accounts, signing or CI/CD. |

---

## 14. Remaining Development Tasks

Owner decisions required before some tasks: data retention for account deletion, app identifiers, domain/hosting,
email provider, delivery fee, Google Play account type, iPad support, admin token storage approach.

* Patch admin dev dependencies; align Expo patch versions.
* Initialise version control and CI (needs owner approval — earlier tasks were told not to initialise Git).
* Physical-device UAT (owner-run, `docs/UAT_TESTING_GUIDE.md`) and fixes.
* Account deletion (backend + mobile + web link for Google Play).
* Real catalogue: owner adds products; decide what to do with test leftovers.
* Stock history screen; customer list; staff management; basic sales reports.
* Admin refresh-token cookie (after hosting decision).
* Scheduled cleanups (expired tokens, reset codes); image thumbnails.
* Reproducible E2E suite in the repository; admin UI tests; CI pipeline.
* Hosting, HTTPS, email provider, backups with restore drill, monitoring.
* Store accounts, artwork, privacy policy, listings, EAS builds, TestFlight / internal testing.
* Scale work (search indexes, Redis, object storage + CDN, task queue, load testing).

---

## 15. Prioritized Development Roadmap

Effort is engineering time for one developer, excluding owner decisions and store review times.

### Phase 1 — Critical Fixes

| ID | Task | App | Priority | Depends on | Effort | Acceptance criteria |
| --- | --- | --- | --- | --- | --- | --- |
| P1-01 | Patch Vite/source-map-js (`npm audit fix`) and re-test admin | Admin | High | — | 0.5 h | `npm audit` 0 high; 42 tests + build pass |
| P1-02 | `npx expo install --fix`; re-run mobile checks | Mobile | Medium | — | 0.5 h | `expo-doctor` 20/20; 178 tests, tsc, exports pass |
| P1-03 | Initialise Git, first commit, `.gitignore` review (no secrets/media/.env) | All | High | Owner approval | 1 h | Repository with clean history; `git status` clean; no secrets tracked |
| P1-04 | Update `PROJECT_OVERVIEW.md` / `.docx` to current state | Docs | Low | — | 1 h | Overview matches this audit |
| P1-05 | Decide on test leftovers in `alzaryab_db` (keep/delete) | DB | Low | Owner decision | 0.5 h | Decision recorded; any cleanup backed up first |

### Phase 2 — Complete Core Features

| ID | Task | App | Priority | Depends on | Effort | Acceptance criteria |
| --- | --- | --- | --- | --- | --- | --- |
| P2-01 | Customer account deletion: API (password re-check, anonymise personal data, keep orders per retention policy, revoke tokens), mobile flow, web deletion link | Backend, Mobile | High | Owner retention decision | 2–3 d | Customer can delete account in app; login impossible afterwards; orders retained anonymised; tests added |
| P2-02 | Stock history screen using `/products/{id}/stock-movements/` | Admin | Medium | — | 1 d | History table with reason, user, date, before/after; tests |
| P2-03 | Customer list and detail (search, orders, deactivate) — new staff endpoints | Admin, Backend | Medium | — | 2–3 d | Staff can find a customer and see their orders; customers cannot access |
| P2-04 | Staff accounts management (invite/create, deactivate, reset) | Admin, Backend | Medium | Owner roles decision | 2–3 d | Owner manages staff without `manage.py` |
| P2-05 | Basic reports (sales by day, top products, low stock export) | Admin, Backend | Low | — | 2 d | Report pages with date range; totals match orders |
| P2-06 | Scheduled cleanup (`flushexpiredtokens`, reset codes) via cron/management command | Backend | Medium | — | 0.5 d | Command + documented schedule; tables stop growing |
| P2-07 | Server-generated product thumbnails | Backend, Mobile | Medium | — | 1–2 d | Lists load thumbnails (< 100 kB); originals unchanged |

### Phase 3 — End-to-End Integration

| ID | Task | App | Priority | Depends on | Effort | Acceptance criteria |
| --- | --- | --- | --- | --- | --- | --- |
| P3-01 | Owner adds the real catalogue (products, prices, images) | Admin (owner) | High | — | owner time | Mobile catalogue shows real products |
| P3-02 | Physical-device UAT on Android and iPhone via Expo Go (`docs/UAT_TESTING_GUIDE.md`) | Mobile, all | Critical | P3-01 | 0.5–1 d + fixes | Every checklist item passes on both platforms; issues logged and fixed |
| P3-03 | EAS development/preview builds on devices (native modules, SecureStore, dev client) | Mobile | High | Expo account, P3-02 | 1 d | Preview APK and iOS internal build install and pass the checklist |
| P3-04 | Move the integration/E2E scripts into the repository (temporary-schema runner) | All | Medium | P1-03 | 1–2 d | One command runs admin Chrome E2E + customer API journey + concurrency checks |

### Phase 4 — Testing and Quality Assurance

| ID | Task | App | Priority | Depends on | Effort | Acceptance criteria |
| --- | --- | --- | --- | --- | --- | --- |
| P4-01 | CI pipeline running backend, admin and mobile tests + builds | All | High | P1-03 | 1 d | Every change runs all suites; failures block merges |
| P4-02 | Admin UI tests (component or Playwright) | Admin | Medium | P3-04 | 2 d | Login, products, orders flows automated |
| P4-03 | Accessibility pass with VoiceOver/TalkBack | Mobile | Medium | P3-02 | 1 d | Core flows usable with screen readers |
| P4-04 | Load test (catalogue, checkout) on staging | Backend | Medium | P5-01 | 2 d | Documented throughput/latency targets met for expected launch traffic |
| P4-05 | Backup restore drill | Ops | High | P5-01 | 0.5 d | Restore into a fresh database succeeds; data verified |

### Phase 5 — Production Deployment

| ID | Task | App | Priority | Depends on | Effort | Acceptance criteria |
| --- | --- | --- | --- | --- | --- | --- |
| P5-01 | Provision server/managed PostgreSQL, domain, HTTPS (follow `docs/DEPLOYMENT.md`) | Backend, Admin | High | Owner hosting/domain decision | 1–2 d | `check --deploy` clean except HSTS notes; health OK over HTTPS |
| P5-02 | Email provider (SMTP, SPF/DKIM) | Backend | High | Owner account | 0.5 d | Real reset email received and used |
| P5-03 | Admin refresh token in httpOnly cookie (if portal and API share a site) | Admin, Backend | Medium | P5-01 decision | 1–2 d | No tokens in Web Storage; CSRF-protected refresh |
| P5-04 | Monitoring, uptime checks, error tracking, log retention | Ops | Medium | P5-01 | 0.5–1 d | Alerts on downtime and server errors |
| P5-05 | Store readiness: artwork, identifiers, privacy policy, data safety/app privacy, listings, signing via EAS | Mobile | High | P2-01, owner accounts | 2–3 d + review time | Internal testing (Play) and TestFlight builds approved |
| P5-06 | Production releases (Google Play closed testing → production; App Store review) | Mobile | High | P5-05, P3-03 | owner/store time | Apps live in both stores |

### Phase 6 — Scalability and Future Enhancements

| ID | Task | App | Priority | Depends on | Effort | Acceptance criteria |
| --- | --- | --- | --- | --- | --- | --- |
| P6-01 | Search indexes (`pg_trgm`), order-history index, case-insensitive email lookup on index | Backend, DB | Medium | — | 1 d | EXPLAIN shows index use; search < 50 ms at 1M rows (test data) |
| P6-02 | Redis for cache/rate limits; catalogue response caching | Backend | Medium | P5-01 | 1–2 d | Shared limits across servers; cache hit rate measured |
| P6-03 | Object storage + CDN for media | Backend | Medium | P5-01 | 1–2 d | Images served from CDN; uploads still validated |
| P6-04 | Task queue for email/notifications/cleanups | Backend | Medium | P5-01 | 2 d | Emails sent by workers with retries |
| P6-05 | Push notifications for order status | Mobile, Backend | Medium | P6-04, store setup | 3–4 d | Customer notified on each status change |
| P6-06 | Batch product endpoint for cart validation | Backend, Mobile | Low | — | 0.5–1 d | Cart check in one request |
| P6-07 | Online payments (if the business wants them) | All | Low | Owner decision, provider | 5–10 d | Provider integration with webhooks and reconciliation |
| P6-08 | Horizontal scaling and load testing to the 100k-customer target | All | Low (later) | P6-01–04 | 3–5 d | Load test evidence meets defined targets |

---

## 16. Recommended Next Development Task

**Start with Phase 1 housekeeping (P1-01, P1-02 — about one hour), then P2-01: customer account deletion.**

* P1-01/P1-02 remove the new high-severity tooling advisories and the Expo drift, so all checks are green again.
* Account deletion is the only **code** blocker for both app stores and has no technical dependencies — it needs
  one owner decision first: *which data to delete and which order records to keep (anonymised) for the business*.
* **In parallel, the owner should run P3-01 and P3-02** (add real products, then test on their own phone using
  `docs/UAT_TESTING_GUIDE.md`): device behaviour is the largest unverified area of the project, and its findings
  should be fixed before further feature work.
* Approve **P1-03 (Git)** as early as possible so all further work is tracked and reviewable.
