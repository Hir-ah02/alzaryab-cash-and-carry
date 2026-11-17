# Alzaryab Cash & Carry — Backend

Django REST Framework API backed by PostgreSQL. The React admin portal lives in the parent folder.

**Stack:** Python 3.13, Django 5.2 LTS, Django REST Framework 3.16, SimpleJWT 5.5, psycopg 3, Pillow, django-cors-headers, python-dotenv.

## Setup

Requires PostgreSQL 17 running locally with the `alzaryab_db` database and `alzaryab_user` role.

```bash
cd backend
python3.13 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env          # then set DJANGO_SECRET_KEY and DB_PASSWORD
.venv/bin/python manage.py migrate
.venv/bin/python manage.py runserver   # http://127.0.0.1:8000
```

### Create the first admin account

Run this yourself in a terminal (it asks for a username, email and password; the password is hashed
by Django and never shown):

```bash
cd backend
.venv/bin/python manage.py createsuperuser
```

The **email address** is what you type on the portal's login page. More staff accounts can be added in
Django admin (`/admin/` → Users → tick **Staff status**). Only active staff users can sign in to the portal.

## Endpoints

### Authentication (JWT)

| Method | Path | Body | Result |
| --- | --- | --- | --- |
| POST | `/api/auth/login/` | `{email, password}` | 200 `{access, refresh, user}`; 401 wrong email or password; 403 not a staff account; 429 after 10 attempts a minute |
| POST | `/api/auth/refresh/` | `{refresh}` | 200 `{access, refresh}`; the old refresh token is revoked (rotation). 401 if expired, revoked, or the user is no longer active staff |
| POST | `/api/auth/logout/` | `{refresh}` | 204; the refresh token is revoked |
| GET | `/api/auth/me/` | — | The signed-in admin: `{id, username, email, name, initials, role}` |

Send the access token as `Authorization: Bearer <access>`. Access tokens last 15 minutes, refresh
tokens 7 days (`JWT_ACCESS_MINUTES`, `JWT_REFRESH_DAYS`). Revoked tokens are kept in the
`token_blacklist_*` tables; run `manage.py flushexpiredtokens` occasionally (e.g. daily) to clear old ones.

### Admin portal: products and categories (staff only)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/products/?search=&category=&stock=in\|low\|out&page=&page_size=` | Active products, newest first, 10 per page (max 100) |
| POST | `/api/products/` | Create (multipart/form-data with `image`, or JSON without) |
| GET | `/api/products/{id}/` | One active product (404 if missing or removed) |
| PUT / PATCH | `/api/products/{id}/` | Update (incl. `description`, `isAvailable`); `image: null` removes the image |
| DELETE | `/api/products/{id}/` | Soft delete: hidden from inventory, row kept |
| GET | `/api/products/summary/` | `{total, inStock, lowStock, outOfStock}` |
| GET | `/api/products/{id}/stock-movements/` | Stock change history |
| GET | `/api/categories/?include_inactive=true` | Categories A–Z (not paginated; active only by default) |
| POST | `/api/categories/` | Create |
| PUT / PATCH | `/api/categories/{id}/` | Update; `"active": true` reactivates |
| DELETE | `/api/categories/{id}/` | Deactivate (refused while it has active products) |

### Admin portal: orders (staff only)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/orders/?search=&status=&page=&page_size=` | Search by reference, customer name, email or phone; `status` is a status or `open` |
| GET | `/api/orders/{id}/` | Items, totals, customer, delivery address, history, `allowedTransitions` |
| POST | `/api/orders/{id}/status/` | `{status, note?}`; must follow the lifecycle below |
| GET | `/api/orders/summary/` | `{total, open, today, byStatus, deliveredRevenue, last7DaysRevenue}` |

### Customer app

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/catalog/products/?search=&category=&page=` | Public | Active, available products only; `stockStatus` / `inStock`, no exact counts |
| GET | `/api/catalog/products/{id}/` | Public | One product on sale |
| GET | `/api/catalog/categories/` | Public | Categories with products on sale |
| POST | `/api/customer/auth/register/` | Public | `{email, password, firstName, lastName?, phone?}` → 201 tokens; never staff |
| POST | `/api/customer/auth/login/` | Public | Customers only (admin accounts get 403) |
| POST | `/api/customer/auth/refresh/` · `/logout/` | — | As for admins, but customer tokens only |
| POST | `/api/customer/auth/password-reset/` | Public | `{email}` → 202, same answer whether or not the account exists; customers get a 6-digit code by email |
| POST | `/api/customer/auth/password-reset/confirm/` | Public | `{email, code, password}` → 200; ends every existing session. 400 `code: invalid_code` or `password: [...]` |
| GET / PATCH | `/api/customer/profile/` | Customer | Name and phone (email is the login and can't change here) |
| CRUD | `/api/customer/addresses/` | Customer | Up to 10 addresses; first is the default; `isDefault: true` moves it |
| GET / POST | `/api/customer/orders/` | Customer | Own order history (newest first, 10 per page) / place an order |
| POST | `/api/customer/orders/quote/` | Customer | `{items}` → server prices, delivery fee and total; nothing is reserved or saved |
| GET | `/api/customer/orders/{id}/` | Customer | Own order only (others' orders are 404) |
| POST | `/api/customer/orders/{id}/cancel/` | Customer | `{reason?}`; only while Pending |

Admins and customers share the one `User` model (`is_staff` tells them apart). Each kind of account can
only sign in, refresh tokens and call the endpoints of its own app.

**Placing an order:** the app sends `{items: [{productId, quantity}], addressId, paymentMethod:
"cash_on_delivery", note?, requestId}`. Prices, delivery fee and totals are always calculated on the
server. In one transaction the product rows are locked, every line is checked (active, available, enough
stock), stock is deducted and a stock movement is logged. If anything fails, nothing changes. Send a new
random `requestId` (UUID) per checkout: repeating it returns the existing order instead of a duplicate.
Stock problems return 400 `{detail, items: [{productId, message, available?}]}`.

**Quote before ordering:** `POST /api/customer/orders/quote/` with the same `items` returns
`{items: [{productId, productName, unit, unitPrice, quantity, lineTotal}], subtotal, deliveryFee, total,
freeDeliveryFrom}` (decimal strings; `freeDeliveryFrom` is null when there is no offer), or the same 400 stock
problems placing would give. It uses the same checks and pricing code as placing an order but locks and writes
nothing, so the app can show the authoritative total before the customer confirms. A quote is not a promise:
the order is checked and priced again when placed.

**Order lifecycle:** Pending → Confirmed → Preparing → Out for Delivery → Delivered. Staff can cancel at
any stage before Delivered; customers only while Pending. Delivered and Cancelled are final. Every change
is kept in the order's history with who made it.

**Stock on cancellation:** cancelling returns every item's quantity to stock (logged as
`order_cancelled`). Delivered orders can't be cancelled, so delivered stock is never returned.

**Delivery fee:** `ORDER_DELIVERY_FEE` (default Rs. 150) and optional free delivery from
`ORDER_FREE_DELIVERY_FROM`. Both are placeholders until the store confirms its prices.
Payment is Cash on Delivery only: it becomes `paid` when the order is delivered and `void` if cancelled.

**Rules** (same as the admin portal): stock 0 is out, 1–5 is low (`LOW_STOCK_THRESHOLD`), above 5 is in. Price is
above 0 with up to 2 decimals. Images are JPG, PNG or WEBP up to 5 MB, checked by content, stored under
`media/products/` with a random name; only the path is saved in PostgreSQL.

## Production security

Production settings are built in and switch on when `DJANGO_DEBUG` is off (the default). Full instructions:
[`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md); review of every finding: [`../docs/SECURITY_REVIEW.md`](../docs/SECURITY_REVIEW.md).

- **Fails closed.** With `DEBUG` off the server refuses to start without a strong `DJANGO_SECRET_KEY`, explicit
  `DJANGO_ALLOWED_HOSTS` and a `DB_PASSWORD` (no trust authentication). HTTPS redirect, HSTS, secure cookies and
  security headers are on; CORS allows nothing unless `CORS_ALLOWED_ORIGINS` is set; the API answers JSON only;
  Django's own `/admin/` is off unless `DJANGO_ADMIN_PATH` is set.
- **Sessions end on password change.** Every JWT carries a fingerprint of the password hash
  (`apps/accounts/tokens.py`), so changing or resetting a password signs that account out everywhere at once.
- **Rate limits:** login 10/min, registration 20/hour, refresh 60/min, password reset 10/hour and confirm
  20/hour per IP, plus 300/min per IP and 600/min per account overall. Counters live in Django's cache: set
  `DJANGO_CACHE=database` (and run `createcachetable`) when running several server processes.
- **Password reset** (`apps/customers/password_reset.py`): 6-digit emailed code, stored as an HMAC, 15-minute
  expiry, single use, 5 tries, per-account limits (1/min, 5/hour, 10/day). In development emails (and codes) are
  printed in the `runserver` console; production needs an SMTP provider (`EMAIL_*` variables).
- **Deployment files:** `requirements-prod.txt` (gunicorn), `deploy/gunicorn.conf.py`, `deploy/alzaryab-api.service`,
  `deploy/nginx.conf.example`, `deploy/api.env.example`, `deploy/backup.sh`.
- `manage.py check --deploy` with production variables reports only the optional HSTS subdomain/preload notes.
- **Admin token storage.** The portal keeps tokens in `localStorage`/`sessionStorage`. Mitigated by a strict
  Content-Security-Policy (nginx example) and 15-minute access tokens; moving the refresh token to an `httpOnly`
  cookie needs the portal and API on the same site (hosting decision).

## Tests

```bash
.venv/bin/python manage.py test --settings=config.settings_test
```

The suite uses an in-memory SQLite database and a temporary media folder, so it never touches `alzaryab_db`.
`ConcurrentOrderTests` needs PostgreSQL and is skipped on SQLite.

To check behaviour on PostgreSQL without touching real data, use a throwaway schema inside the same database
(`DB_SCHEMA` makes Django use it instead of `public`):

```bash
psql -U alzaryab_user -h 127.0.0.1 -d alzaryab_db -c "create schema scratch"
DB_SCHEMA=scratch .venv/bin/python manage.py migrate
DB_SCHEMA=scratch .venv/bin/python manage.py runserver   # or shell, etc.
psql -U alzaryab_user -h 127.0.0.1 -d alzaryab_db -c "drop schema scratch cascade"
```

## Layout

```
config/            settings, root URLs, WSGI/ASGI; settings_test.py for the test suite
apps/core/         health check, permissions, pagination, API error handling
apps/accounts/     custom User model (email login, unique email), JWT login/refresh/logout/me
apps/catalog/      Category and Product models, admin APIs, public catalogue (public.py); migration 0002 seeds 12 categories
apps/inventory/    stock rule (stock.py) and StockMovement log (linked to orders)
apps/customers/    Address model; customer register/login/profile/addresses API
apps/orders/       Order, OrderItem, OrderStatusChange; services.py (placing orders, status changes, restocking)
```

New modules are added as apps under `apps/`
with `python manage.py startapp <name> apps/<name>`, then registered in `INSTALLED_APPS` as `apps.<name>`.
