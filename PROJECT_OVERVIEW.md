# Alzaryab Cash & Carry Admin Portal: Project Overview

Sep 26, 2026

## Purpose

The Admin Portal lets the owner of Alzaryab Cash & Carry manage the store's grocery inventory from one screen. They can see stock levels at a glance and add, edit, search and remove products.

- **Who uses it:** the store owner and authorized admin staff.
- **Problem it solves:** without a system, it's hard to know which items are running low or out of stock until a customer asks. The portal flags them automatically so they can be reordered in time.
- **Goal of this phase:** deliver a complete, clickable frontend that the client can review and approve before the backend (server and database) is built.

## Current status

The frontend is complete and ready for demo. There is no backend yet, so the portal runs on demo data stored in the browser.

| Area | Status |
| --- | --- |
| Login and session handling | Done (one demo admin account) |
| Dashboard with stock summary | Done |
| Product list with search, filters and pages | Done |
| Add, edit and remove products | Done |
| Product image upload | Done |
| Desktop, tablet and mobile layouts | Done |
| Backend server and database | Not started (next phase) |
| Multiple user accounts and roles | Not started (needs the backend) |

The demo data has 37 realistic products across 12 categories, with prices in PKR. Changes made in the demo are saved in that browser only and are not shared between devices.

## Features delivered

Six screens cover the full inventory workflow, from signing in to removing a product.

### Login

- Email and password sign-in with clear error messages for empty, invalid or wrong details.
- Show/hide password button.
- **Remember me:** stays signed in after the browser closes. Without it, the session ends when the tab closes, which is safer on a shared counter PC.
- Anyone not signed in is sent to the login page. After signing in, they return to the page they were trying to open.

### Dashboard

- Three summary cards: **Total Products**, **Low Stock** (1 to 5 units) and **Out of Stock** (0 units).
- The Low Stock and Out of Stock cards are clickable and open the product list already filtered.
- A **Low Stock Products** table lists the lowest items first, with edit and remove buttons on each row.
- A "Everything is well stocked" message appears when nothing is running low.

### Products list

- Full inventory table: image, name, category, unit, price (PKR), stock and a colored status badge.
- Search updates as you type.
- Filter by category and by stock status, and combine them with search.
- 10 products per page.
- Filters are kept in the page link, so they survive a refresh, work with the browser back button and can be shared with a colleague.
- Clear messages when there are no products or nothing matches, with a one-click **Clear filters** button.

### Add Product

- Form fields: product name, category, unit (e.g. 1 L, 500 g), stock quantity, price (PKR) and product image.
- Mistakes are checked as you go. On save, a summary lists every problem, and clicking one jumps to that field.
- Image upload by drag and drop or file picker, with preview, replace and remove.
- A success message confirms the save and returns to the product list.

### Edit Product

- The same form as Add Product, pre-filled with the current details.
- Shows a "Product not found" page if the product was removed or the link is wrong.
- **Unsaved-changes warning:** leaving the page with unsaved edits asks "Discard unsaved changes?" first.

### Remove Product

- A confirmation popup, "Remove Product?", prevents accidental removal.
- Removed products disappear from the inventory but their records are kept, not permanently erased.

### Layout and navigation

- Sidebar menu (Dashboard, Products, Add Product) that can collapse to icons and remembers the choice.
- Account menu with the user's name, role and **Logout**.
- On phones and tablets, the menu slides in from the side.

## Business rules

The same rules apply on every screen, so a product never shows one status on the dashboard and another in the list.

| Rule | Current setting |
| --- | --- |
| In Stock (green) | More than 5 units |
| Low Stock (amber) | 1 to 5 units |
| Out of Stock (red) | 0 units |
| Product name | Required, up to 80 characters |
| Category | Required, one of the 12 categories below |
| Unit | Required, e.g. 1 L, 500 g, 1 pack |
| Stock quantity | Required, whole number, 0 or more |
| Price | Required, above 0, up to 2 decimal places, in PKR |
| Product image | Required; JPG, PNG or WEBP; up to 5 MB; resized automatically to 600 px |
| Removing a product | Hidden from inventory, record kept for history and reports |

**Categories:** Fruits & Vegetables, Dairy & Eggs, Beverages, Snacks, Bakery, Rice & Flour, Cooking Oil, Spices, Frozen Foods, Personal Care, Household & Cleaning, Baby Care.

The low-stock limit of 5 is a single setting and can be changed on request.

## Tech stack

The portal uses a small, modern set of well-supported tools with only four runtime packages, which keeps it fast and easy to maintain.

| Layer | Technology | Why |
| --- | --- | --- |
| UI framework | React 19 | Industry standard, large talent pool, reusable components |
| Build tool | Vite 8 | Fast development server and small production files |
| Routing | React Router 7 (hash links, e.g. `#/products`) | Works on any web host with no server setup; powers the unsaved-changes warning |
| Icons | lucide-react | Clean, consistent icon set |
| Styling | Plain CSS with CSS variables (design tokens) | No extra framework; colors and spacing change from one file |
| Font | Inter (Google Fonts) | Highly readable for tables and numbers |
| Data (this phase) | Browser storage with simulated network delay | Lets the full app be demoed before the backend exists |

Requirements: Node.js 20 or newer for development. The finished site is static files that run in any modern browser.

## Architecture

The app is built so the backend can be plugged in without redesigning the screens. All data goes through two service files. The screens never read or write data directly.

- **Pages** (the screens) call the **services**.
- **Services** (`productService.js`, `authService.js`) currently read and write browser storage. Later, each function is swapped for a call to the real server, keeping the same names and results.
- **Components** are reusable building blocks (buttons, fields, tables, popups), so new screens reuse the same look.
- **Design tokens** in one file (`tokens.css`) hold every color, spacing, radius and font size.
- **Sidebar menu** is built from one list (`navItems.js`), so new modules such as Orders can be added in a few lines.

### Folder structure

| Folder | Contents |
| --- | --- |
| `src/pages/` | Login, Logout, Dashboard, Products, Add Product, Edit Product |
| `src/components/` | 24 reusable UI pieces: buttons, fields, image upload, popups, badges, pagination, empty and error states |
| `src/layout/` | Page frame, sidebar, header, menu configuration |
| `src/services/` | Product and login data access (the only files that touch data) |
| `src/context/` | Signed-in session and pop-up notifications |
| `src/utils/` | Stock rule, validation, price formatting, image resizing |
| `src/data/` | 37 demo products and the category list |
| `src/styles/` | Design tokens and page styles |
| `public/products/` | 14 product illustrations used by the demo data |

## Quality and safeguards

Every screen handles loading, errors and empty results, so the user is never left looking at a blank page.

- **Loading:** placeholder rows appear while data loads.
- **Errors:** a clear message with a **Try again** button if data can't be loaded.
- **Empty results:** helpful messages with a next step, such as "Add your first product" or "Clear filters".
- **Confirmations:** green or red pop-up messages after every save, update, removal and logout.
- **Mistake prevention:** confirmation before removing, a warning before losing unsaved edits, and a double-click guard on save buttons.
- **Responsive:** works on desktop, tablet and phone.
- **Accessibility:** full keyboard use, screen-reader labels, visible focus outlines and readable color contrast.
- **Easy hosting:** the build runs from any static host or sub-folder with no server configuration.

## Running and deploying

Three commands run the portal locally, and the build output can be uploaded to any web host as it is.

| Command | What it does |
| --- | --- |
| `npm install` | Installs the dependencies |
| `npm run dev` | Starts the app at http://localhost:5173 |
| `npm run build` | Creates the production files in `dist/` |
| `npm run preview` | Serves the production build locally for a final check |

To deploy, upload the `dist/` folder to any static host, such as Netlify, cPanel, Amazon S3 or GitHub Pages.

**Demo login:** `admin@alzaryab.pk` / `admin123` (account name Zaryab Khan, role Owner).

## Next steps

The next phase is the backend, so data is stored on a server and shared across every device and user.

1. **Client review:** walk through the demo, collect feedback and confirm the scope.
2. **Backend and database:** build the server with the endpoints below, then connect the two service files to it.
3. **User accounts:** real logins for the owner and staff, with roles and permissions.
4. **Go live:** deploy the frontend and backend, then load the store's real product list.

### Planned server endpoints

| Action | Endpoint |
| --- | --- |
| List and search products | `GET /products?search=&category=&stock=` |
| Get one product | `GET /products/:id` |
| Add a product (with image) | `POST /products` |
| Update a product | `PUT /products/:id` |
| Remove a product (records kept) | `DELETE /products/:id` |
| Dashboard counts | `GET /products/summary` |
| Sign in | `POST /auth/login` |
| Sign out | `POST /auth/logout` |

### Possible future modules

- Orders and sales
- Customers and suppliers
- An archive to view and restore removed products
- Stock movement history and reports
- An adjustable low-stock limit, per product or per category
