# Al Zaryab — Customer App (React Native)

The customer shopping app for Android and iOS. It talks to the Django API in [`../backend`](../backend/README.md).

**Stack:** Expo SDK 58 · React Native 0.88 · React 19 · TypeScript · Expo Router · TanStack Query ·
expo-secure-store (tokens) · AsyncStorage (cart, cached profile) · Jest (jest-expo) + React Native Testing Library.

**Status:** customer app complete for ordering (Task 7): browsing, search, cart, registration, sign-in, profile,
delivery addresses, Cash on Delivery checkout, order history and order details with cancellation, all against the
live API. Not yet run on a phone or simulator. See [What's left](#whats-left).

---

## Getting started

Requires Node.js 22+ (tested on 26) and the backend running.

```bash
cd mobile
npm install
npx expo start          # then press a for Android, i for iOS, or scan the QR code with Expo Go
```

Start the API in another terminal. **For phones and emulators it must listen on all interfaces**, not only
`127.0.0.1`:

```bash
cd backend
.venv/bin/python manage.py runserver 0.0.0.0:8000
```

### Connecting to the local backend

By default (development, `EXPO_PUBLIC_API_URL` not set) the app talks to **the computer running
`npx expo start`, on port 8000**. Expo tells the app that computer's address, so no IP address is
written into the code. Details are in `src/config/api.ts`.

| Where the app runs | What to do |
| --- | --- |
| **iOS Simulator** (same Mac) | Nothing. It reaches the Mac directly. |
| **Android Emulator** | Usually nothing. If it can't connect, create `mobile/.env.local` with `EXPO_PUBLIC_API_URL=http://10.0.2.2:8000/api` (10.0.2.2 is the emulator's name for your computer). |
| **Physical phone (Expo Go)** | Phone and computer on the **same Wi-Fi**. Run Django on `0.0.0.0:8000` and add your computer's LAN address to `DJANGO_ALLOWED_HOSTS` in `backend/.env` (e.g. `localhost,127.0.0.1,192.168.1.20`). Find the address in System Settings → Wi-Fi → Details (macOS). If it still can't connect, set `EXPO_PUBLIC_API_URL=http://<that-address>:8000/api` in `mobile/.env.local`. |
| **Release build** | `EXPO_PUBLIC_API_URL` **must** be the public **https://** API, set as an EAS environment variable for the `preview`/`production` environment; without it (or with `http://`) the app shows "not connected to a server". |

`.env.local` is git-ignored; see `.env.example`. Values in `EXPO_PUBLIC_` variables are built into the app in plain
text, so never put secrets there. After changing them, restart Expo with `npx expo start --clear`.

Product images use the address Django builds from the incoming request, so they load from the same host the
app called. CORS does not apply to native apps.

### Running on devices

- **Android:** install the Expo Go app (SDK 58) on a phone, or create an emulator in Android Studio, then press
  `a` in the Expo terminal.
- **iOS:** the iOS Simulator needs Xcode (Mac App Store). Press `i` in the Expo terminal. On an iPhone, install Expo
  Go and scan the QR code with the Camera app.

All libraries used are included in Expo Go, so no custom native build is needed yet.

### Checking the full flow on a device

1. Home: products and photos load; scroll to the bottom and more load; pull down to refresh.
2. Search: type "mi" (nothing yet), then "milk"; results appear after a short pause; clear with ×; try "zzz".
3. Categories: counts match the number of products in each category list.
4. Product: change the quantity, Add to cart, see the confirmation and the cart tab badge. Out-of-stock products
   can't be added.
5. Cart: + / − / remove / Clear cart; close and reopen the app, the cart is still there.
6. In the admin portal change a cart product's price and mark another out of stock; reopen the cart: both are
   listed, checkout is disabled until **Accept changes**.
7. Turn on airplane mode: the cart still works, checkout says you're offline; turn it off and tap **Check again**.
8. Continue to checkout while signed out: sign in (or register) and you land back on checkout with the cart intact.
9. Checkout: totals come from the server (delivery fee included); add an address from checkout and it is selected;
   place the order and see the confirmation; the cart empties.
10. Turn on airplane mode just before tapping Place order: "We couldn't confirm your order", cart kept; turn it
    off, Try again: the same order appears (check the admin portal: only one order).
11. My orders: the order is listed; open it; Cancel order (Pending only) asks first, then shows Cancelled.
12. Account: edit name/phone; manage addresses (add, edit, make default, delete); sign out (the cart stays).

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Expo dev server |
| `npm test` | Unit, component, screen and navigation tests (Jest) |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`) |
| `npx expo-doctor` | Checks Expo configuration and dependency versions |
| `npx expo export --platform ios --platform android` | Builds the production JavaScript bundles (a quick "does it compile" check without a simulator) |
| `eas build --profile development \| preview \| production` | Native builds in Expo's cloud (needs an Expo account; see `eas.json` and `docs/DEPLOYMENT.md`) |

## Project structure

```
src/
  app/                    Routes (Expo Router). Every file is a screen; keep other code out.
    _layout.tsx           Providers (React Query, Auth, Cart) and the root stack with route guards
    (tabs)/               Home · Categories · Cart · Account
    product/[id].tsx      Product details, quantity, Add to cart
    category/[name].tsx   Products in a category (infinite scroll)
    search.tsx            Search by product name
    login.tsx, register.tsx                              Only reachable while signed out
    (customer)/           Signed-in customers only: checkout, profile, addresses (list, new, [id]),
                          orders (history), orders/[id] (details, cancel, order confirmation)
  screens/                Screen components used by the routes (Home, Search, Categories, CategoryProducts,
                          ProductDetail, Cart, Login, Register, Account, Profile, Addresses, AddressForm,
                          Checkout, Orders, OrderDetail)
  components/             Design-system pieces: AppText, Button, TextField, Card, ProductCard, ProductGrid
                          (infinite list), ProductImage, QuantityStepper, CartLine, CartCheckStatus, Notice,
                          StockBadge, CategoryChip, SearchEntry, SectionHeader, StateViews (loading/empty/error),
                          FormScreen (keyboard-safe form), PasswordField, AddressCard, OrderStatusBadge, SummaryRow
  api/                    client.ts (fetch, timeouts, errors, token refresh), errors.ts, types.ts (API shapes),
                          catalog.ts, auth.ts, customer.ts, orders.ts, money.ts
  auth/                   tokenStorage.ts (SecureStore), AuthProvider.tsx (session context),
                          returnTo.ts (where to continue after signing in)
  checkout/               checkoutStore.ts (chosen address, pending submission + requestId), submitOrder.ts
  cart/                   cartReducer.ts (pure rules), CartProvider.tsx (AsyncStorage persistence),
                          cartCheck.ts (compare the cart with the live catalogue)
  hooks/                  useCatalog.ts (product pages, categories, product), useCartCheck.ts, useDebouncedValue.ts,
                          useCustomer.ts (addresses, orders, quote, cancel)
  lib/                    queryClient.ts (retry policy, query keys, app-focus refresh, first-page refresh)
  config/                 api.ts (API address resolution)
  theme/                  Colours, spacing, radius, type scale, shadows
  utils/                  format.ts (Rs. prices, dates, stock and payment labels), validation.ts (form rules
                          mirroring the server)
__tests__/                Jest tests (*-test.ts / *-test.tsx)
```

## How it works

**API client** (`src/api/client.ts`): every request has a 15-second timeout and returns parsed JSON or throws an
`ApiError` with a message that is safe to show (`status`, `code`, `fields` for form errors, `items` for order
stock problems). Network failures and timeouts are reported as such; server errors never show internals.

**Authentication** (`src/auth/`): access and refresh tokens live only in the device keychain/keystore
(`expo-secure-store`). On a 401 the client refreshes the token once (one shared request for parallel calls),
saves the rotated pair and retries. If the refresh token is rejected, tokens are deleted and the customer is
signed out (`sessionExpired` is set so the sign-in screen can explain). A refresh that fails because of the
network does **not** sign anyone out. The profile (name, email, phone) is cached in AsyncStorage so the app
opens instantly offline. Sign-out deletes everything locally and revokes the refresh token on the server.

**Sign-in and registration**: forms validate before sending (the same rules as the server: email, phone
10–15 digits, password at least 8 characters and not only numbers; the server also rejects common passwords).
Passwords stay in the screen's state only: never stored, logged or cached. Buttons ignore repeated taps while a
request is running. Server field errors appear under the matching field; staff accounts are told to use the admin
portal. Registration always creates an ordinary customer. After signing in, the app continues where the customer
was heading: Cart → Continue to checkout → Sign in → Checkout. The cart is never touched by signing in or out.

**Forgot password**: Sign in → *Forgot password?* → enter the email → a 6-digit code arrives by email (during
local testing it is printed in the Django `runserver` window) → enter it with a new password. The answer never
reveals whether an email is registered; a new code can be requested after 60 seconds. After a reset the customer
is signed out on every device and signs in with the new password.

**Protected screens**: the `(customer)` group uses `Stack.Protected` with `redirectTo="/login"`. While the saved
session is being restored the guard stays open, so a deep link isn't bounced before the keychain is read.

**Browsing** (`useProductPages`, `ProductGrid`): Home, Search and category pages load 20 products at a time from
`GET /catalog/products/` and fetch the next page when the list nears its end (infinite scroll, following the
API's `next` link). The server only returns active, available products in active categories; out-of-stock products
are shown with an "Out of stock" badge and can't be added to the cart. Pull-to-refresh reloads just the first page.

**Search**: by product name (the API matches names, case-insensitive). A request is sent only after typing pauses
for 300 ms and the text has at least 2 letters; pressing Search sends it at once. Equivalent searches ("Milk " and
"milk") share one cache entry, and a newer search cancels the one in flight.

**Product page**: quantity stepper (whole numbers from 1 up to the per-product limit of 100, matching the server),
Add to cart with on-screen and screen-reader confirmation, and a link to the product's category.

**Cart** (`src/cart/`): stored on the device in AsyncStorage (only product ids, names, units, display prices,
photo URLs and quantities; nothing sensitive) so it survives restarts and works before sign-in. Saved carts are
validated when loaded (bad rows dropped, duplicates merged, quantities capped). Every sum is done in whole paisa,
so totals never show floating-point errors. The subtotal is an estimate; the server prices every order.

**Cart check before checkout** (`cartCheck.ts`, `useCartCheck`): each time the cart opens, and again when
Continue to checkout is pressed, every cart product is re-read from `GET /catalog/products/{id}/` (at most 4
requests at a time). Price changes, pack-size changes, products no longer on sale (404) and sold-out products are
listed, and checkout stays disabled until the customer taps **Accept changes** (sold-out and removed products are
then taken out, prices and units updated). Low stock is mentioned but never promised. If the check can't run
(offline, server error) the cart still works but checkout is not offered. The server checks stock and prices again
when the order is placed.

**Addresses**: list, add, edit, delete (with confirmation) and make default, using exactly the API's fields
(label, recipient, phone, house/street, apartment/landmark, area, city, postal code, instructions). The server
keeps exactly one default and only ever shows a customer their own addresses (others' are 404). Up to 10.

**Checkout (Cash on Delivery)**: the Place order button is enabled only when (1) the cart check found nothing
to accept, (2) the server has priced the cart with `POST /customer/orders/quote/` (subtotal, delivery fee and total
shown are the server's; stock problems such as "Only 2 left" appear with a fix button), and (3) a delivery address
is selected. Pressing it checks and prices once more; if the total moved, the customer sees the new one first.

**Placing the order safely**: each checkout gets a new random `requestId`, saved on the device *before* the
request is sent, together with the exact items, address and note.
- *Order created* (201, or 200 if this requestId already created it): only the ordered quantities leave the cart,
  the saved submission is deleted and the confirmation is shown.
- *Refused* (any 4xx: stock, address, validation, session ended): no order exists. The cart is kept, the saved
  submission is deleted and the reason is shown. If the session ended, the customer signs in and returns to
  checkout.
- *Uncertain* (timeout, lost connection, 5xx, app closed mid-request): the order may exist. The cart is kept and
  checkout shows "We couldn't confirm your order" with **Try again**, which resends exactly the same submission
  and requestId. The server answers with the order it already created, so a retry can never make a second order.
  The customer can also open My orders, or start over (after a warning to check My orders first). A new requestId
  is never generated automatically for an uncertain attempt.

**Orders**: history newest first, 10 per page with infinite scroll and pull-to-refresh (reference, date, status,
total, payment status). Details show items, unit prices, subtotal, delivery fee, total, the delivery address,
note, payment method and status, and the status timeline. **Cancel order** appears only when the server says
the order can be cancelled (Pending), asks for confirmation, and shows the server's answer.

**Data fetching**: TanStack Query, with retries only for network/timeout/5xx errors. Data is reused for a minute,
unused data is dropped after five, and stale screens refresh when the app returns to the foreground. When the cart
check finds the catalogue has changed, product lists and categories are refreshed too. Leaving a screen cancels its
requests. Everything under the `customer` query key is removed on sign-out.

**Performance**: virtualised lists (only a few screens of rows are rendered), memoised product cards and cart rows,
stable cart actions, and product photos cached on disk (Django gives each upload a new file name, so iOS can reuse
cached photos without revalidating; Android caches by default and decodes photos at display size to save memory).

### API contracts used

Checked against the live API (every field of every response): `GET /catalog/products/`, `/catalog/products/{id}/`,
`/catalog/categories/`; `POST /customer/auth/register/`, `/login/`, `/refresh/`, `/logout/`;
`GET/PATCH /customer/profile/`; `/customer/addresses/`; `GET/POST /customer/orders/`, `GET /customer/orders/{id}/`,
`POST /customer/orders/{id}/cancel/`, `POST /customer/orders/quote/` (added in Task 7). Shapes are in `src/api/types.ts`; full descriptions in
[`../backend/README.md`](../backend/README.md).

## Design system

Defined in `src/theme/index.ts` and shared with the admin portal's identity: fresh green (`#15803D`) for actions,
warm gold (`#F5B800`) for the logo and badges, soft neutral background. System fonts, a type scale from caption
(12) to display (28), a 4-point spacing scale, 48-point minimum touch targets, labelled controls for screen readers,
and text that scales with the device's font size (capped at 160%).

## What's left

| Task | Work |
| --- | --- |
| **Before release** | First run on real phones (Android and iOS), **account deletion** (required by Google Play and the App Store; needs the owner's data-retention decision), push notifications for order status (optional) |
| **Before publishing** | App icon and splash screen from the client's real artwork (the template icons are placeholders), confirm the app identifiers (`pk.alzaryab.customer` is a placeholder), `eas init`, production `EXPO_PUBLIC_API_URL` (HTTPS) in EAS environments, store listings, privacy policy. See [`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md) |

### Dependency versions

All packages match the versions Expo SDK 58 expects (`npx expo-doctor`: 20/20). Update them together with
`npx expo install --fix` rather than one by one.
