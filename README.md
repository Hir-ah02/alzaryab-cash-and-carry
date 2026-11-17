# Alzaryab Cash & Carry — Admin Portal

Inventory management portal for the Alzaryab Cash & Carry grocery store.
The store owner can log in, see stock levels at a glance, and add, edit, search and remove products.

This folder is the **React frontend**. It talks to the Django REST API in [`backend/`](backend/README.md),
which stores everything in PostgreSQL. All data access goes through `src/services/`.

**Stack:** React 19 + Vite, React Router 7 (hash routing), lucide-react icons, plain CSS with
CSS variables, Inter font. Backend: Django 5.2, Django REST Framework, SimpleJWT, PostgreSQL 17.

**Guides:** [first-time testing for the owner](docs/UAT_TESTING_GUIDE.md) ·
[deployment](docs/DEPLOYMENT.md) · [security review](docs/SECURITY_REVIEW.md) ·
[API](backend/README.md) · [customer app](mobile/README.md)

---

## Running the app

Requires Node.js 22 or newer, and the backend running (see [backend/README.md](backend/README.md)).

```bash
# Terminal 1: API on http://localhost:8000
cd backend && .venv/bin/python manage.py runserver

# Terminal 2: portal on http://localhost:5173
npm install      # first time only
npm run dev
```

`npm run dev` reads the API address from `.env.development` (`VITE_API_URL=http://localhost:8000/api`).

```bash
npm test         # service tests (Node's built-in test runner, no extra packages)
npm run build    # production build into dist/
npm run preview  # serve the production build locally
```

For a production build, set `VITE_API_URL` to the public API address at build time, or serve the
API from the same domain under `/api` (the default). The build uses `base: './'` and hash URLs
(`#/products`), so `dist/` works from any static host or sub-folder.

## Signing in

There are no built-in accounts. Create the owner's account on the server once:

```bash
cd backend && .venv/bin/python manage.py createsuperuser
```

Sign in with that email address and password. Only **staff** accounts can use the portal.

- **Remember me** keeps you signed in after the browser closes (session stored in `localStorage`).
- Without it, the session lasts until the tab is closed (`sessionStorage`).
- Access tokens last 15 minutes and are renewed automatically; after 7 days without use, or once
  the server revokes the session, you are sent back to the login page with a "Session expired" notice.

## Features

| Page | Route | What it does |
| --- | --- | --- |
| Login | `#/login` | Email and password sign-in with validation, error alert, show/hide password, "Remember me". |
| Dashboard | `#/` | Total / Low Stock / Out of Stock cards (the last two link to filtered lists) and a Low Stock Products table. |
| Products | `#/products` | Live search, category and stock filters (kept in the URL), 10 per page from the server, plus loading, error and empty states. |
| Add Product | `#/products/new` | Validated form with image upload (drag and drop, JPG/PNG/WEBP, 5 MB limit). Image required. |
| Edit Product | `#/products/:id/edit` | Same form, pre-filled; keeps the current image unless you change it; handles "product not found". |
| Remove Product | modal | Confirmation dialog. Removal is a soft delete: the record is kept but hidden. |
| Categories | `#/categories` | Add, rename, deactivate and reactivate categories (a category with active products can't be deactivated). |
| Orders | `#/orders` | Open orders / today / delivered sales cards; search by order number, customer or phone; status filter; 10 per page. |
| Order details | `#/orders/:id` | Items and totals, customer and delivery details, history, and buttons for the next allowed status or cancelling (stock is returned). |

Products also have an optional **description** and an **Available to customers** switch. Unticking it
hides the product from the store (marked "Hidden" in the list) without removing it.

**Stock rule** (in `src/utils/stock.js`, matched by the backend): stock above 5 is **In Stock**, 1–5 is
**Low Stock**, 0 is **Out of Stock**.

The server checks everything again (prices, duplicates, image type and size); its messages appear on
the matching form field.

## Folder structure

```
public/
  products/            Old demo images (no longer used by the app)
src/
  components/          Reusable UI: Button, IconButton, TextField, PasswordField, SearchInput,
                       Select, NumberField, Checkbox, Alert, StatusBadge, SummaryCard, Pagination,
                       ImageUpload, ConfirmModal, RemoveProductModal, ProductForm, EmptyState,
                       ErrorState, SkeletonRows, ProductThumb, Logo, ProtectedRoute,
                       OrderStatusBadge, TextArea
  context/             AuthContext (session) and ToastContext (useToast())
  data/                categories.js (fallback list if the category API can't be reached)
  layout/              AdminLayout, Sidebar, Header, PageIntro, navItems.js (sidebar menu config)
  pages/               LoginPage, LogoutPage, DashboardPage, ProductsPage, AddProductPage, EditProductPage,
                       CategoriesPage, OrdersPage, OrderDetailPage
  services/            apiClient.js, session.js, authService.js, productService.js, categoryService.js, orderService.js
                       ← the only files that talk to the API; *.test.js beside them
  styles/              tokens.css (design tokens), global.css, components.css, layout.css, pages.css
  utils/               stock rule, order status labels, formatting, validation, image checks, hooks, useCategories
  App.jsx              Routes
  main.jsx             Entry point and providers
```

### How the services fit together

| File | Role |
| --- | --- |
| `apiClient.js` | `apiRequest()`: adds the access token, refreshes it once on a 401, turns failures into `ApiError` with a safe message (`status`, `fields` for per-field errors) |
| `session.js` | Reads and writes the stored session `{ access, refresh, user }` |
| `authService.js` | `login`, `logout` (revokes the refresh token), `fetchCurrentUser` |
| `productService.js` | `listProducts` → `{ items, total }`, `getProduct`, `createProduct`, `updateProduct`, `removeProduct`, `summarize` |
| `categoryService.js` | `listCategories`, `listAllCategories`, `createCategory`, `updateCategory`, `deactivateCategory`, `reactivateCategory` (dropdowns use the `useCategories()` hook) |
| `orderService.js` | `listOrders` → `{ items, total }`, `getOrder`, `updateOrderStatus`, `getOrderSummary` |

### Adding a sidebar module later

Sidebar items are built from `src/layout/navItems.js`. To add a module (for example Orders), add
an item or a new group there, then register its route in `src/App.jsx`.

### Design tokens

Every colour, spacing, radius, shadow and type style is a CSS variable in
`src/styles/tokens.css`. Change a value there and the whole portal updates.
