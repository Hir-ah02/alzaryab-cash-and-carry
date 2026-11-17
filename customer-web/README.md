# Al Zaryab Cash & Carry — Customer Website

The online shop for customers: browse the live catalogue, add to cart, check out with
**Cash on Delivery**, and track orders. It uses the **same Django API and PostgreSQL database**
as the admin portal and the mobile app, so products, prices, stock, accounts and orders are shared.
Website and app customers sign in with the same email and password.

**Stack:** React 19, Vite 8, TypeScript, Tailwind CSS 4, React Router 7, TanStack Query 5.

## Running locally

Needs the backend on `http://localhost:8000` (see [../backend/README.md](../backend/README.md)).

```bash
# Terminal 1: API
cd backend && .venv/bin/python manage.py runserver 8000

# Terminal 2: admin portal → http://localhost:5173
npm run dev

# Terminal 3: customer website → http://localhost:5174
cd customer-web
npm install        # first time only
npm run dev
```

Vite proxies `/api` and `/media` to Django, so the browser only talks to `localhost:5174`:
no CORS settings and no API address in the frontend. `API_PROXY_TARGET` (server-side only)
points the proxy at a different Django, e.g. `API_PROXY_TARGET=http://localhost:8001`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on :5174 |
| `npm run build` | Type check + production build into `dist/` |
| `npm test` | Unit tests (Vitest): API client, token storage, return-path safety, cart and checkout logic |
| `npm run test:e2e:isolated` | Browser tests (Playwright + installed Google Chrome) against an **isolated** copy: creates the temporary PostgreSQL schema `e2e_customer_web`, seeds test products and a staff user (random password), starts Django :8001, admin :5175 and shop :5176, runs every test, then drops the schema. Your real data is never touched. `KEEP_E2E=1` keeps the schema for inspection. |

## Pages

| Route | Page |
| --- | --- |
| `/` | Home: search, categories, products |
| `/products?search=&category=` | Catalogue with search and category filter, “Load more” paging |
| `/products/:id` | Product details, quantity, add to cart |
| `/cart` | Cart with live price/stock check |
| `/checkout` 🔒 | Address (choose or add), Cash on Delivery, note, server-calculated total, Place order |
| `/orders` 🔒, `/orders/:id` 🔒 | Order history, status tracker (refreshes every 30 s), cancel while Pending |
| `/account` 🔒, `/account/addresses` 🔒 | Profile, saved addresses (max 10, default) |
| `/login`, `/register`, `/forgot-password`, `/reset-password` | Customer sign-in (staff accounts are refused) |

🔒 = signed-in customers only; others are sent to sign in and brought back afterwards.

## How it fits together

Business rules stay on the server. The website never decides prices, stock or totals:

* **Cart check** (`src/cart/cartCheck.ts`): before checkout every cart product is re-read from the
  live catalogue; price, pack-size, availability changes must be accepted by the customer.
* **Quote** (`POST /api/customer/orders/quote/`): the server prices the order, adds the delivery fee
  and reports stock problems (“Only 2 left” → *Change to 2*).
* **Place order** (`POST /api/customer/orders/`): the server locks the product rows, re-checks stock
  and prices, deducts stock and records the order in one transaction; concurrent orders cannot oversell.
* **No duplicate orders:** each checkout sends a `requestId` saved in the browser *before* sending.
  If the answer is lost, “Try again” resends the same id and the server returns the existing order.

Code shared with the mobile app was **copied** from `mobile/src/` (each file says so at the top):
`api/*`, `cart/cartReducer.ts`, `cart/cartCheck.ts`, `checkout/submitOrder.ts`, `hooks/*`, `utils/*`.
Web-specific: `api/client.ts` (adapted), `auth/tokenStorage.ts`, `auth/AuthProvider.tsx`,
`cart/CartProvider.tsx`, `checkout/checkoutStore.ts` (browser storage instead of device storage).
If you change a business rule in one copy, change it in the other.

**Sessions:** the refresh token (7 days, single-use, rotated) is in `localStorage`; the 15-minute
access token is in memory and `sessionStorage` (this tab). Token refreshes are serialised across tabs
with the Web Locks API. As with the admin portal, scripts on this origin can read them, so production
hosting must send a strict Content-Security-Policy (see [../docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md)).

## Folder structure

```
src/
  api/          API calls and types (from the mobile app); client.ts = fetch, tokens, errors
  auth/         AuthProvider (session), tokenStorage, returnTo (safe ?next= redirects)
  cart/         cart rules (shared) and CartProvider (localStorage, synced across tabs)
  checkout/     submitOrder (shared) and checkoutStore (pending submission)
  components/   Header, Footer, ProductCard, QuantityStepper, AddressForm, OrderStatus, ui.tsx …
  hooks/        TanStack Query hooks (catalogue, customer, cart check)
  pages/        one file per page
  utils/        formatting and form validation (shared)
tests/unit/     Vitest
tests/e2e/      Playwright specs + seed.py (isolated test data)
scripts/e2e.sh  isolated browser-test runner
```
