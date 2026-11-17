# Al Zaryab — Testing Guide for the Store Owner

This guide walks you through running the whole system on your Mac and testing it with your own phone:
the **database**, the **server (API)**, the **Admin Portal** in your browser, and the **customer app**
on your phone. No programming knowledge is needed: copy each command exactly.

You do **not** need Xcode or Android Studio. The customer app runs on your phone inside the free
**Expo Go** app.

---

## What you need

| What | Where to get it | Already on this Mac? |
| --- | --- | --- |
| **Homebrew** (installs PostgreSQL) | <https://brew.sh> | Yes |
| **PostgreSQL 17** (the database) | `brew install postgresql@17` | Yes |
| **Python 3.13** (runs the server) | <https://www.python.org/downloads/> | Yes (`backend/.venv`) |
| **Node.js 22 or newer** (runs the portal and app tools) | <https://nodejs.org> (LTS) | Yes (v26) |
| **Expo Go** on your phone | App Store (iPhone) or Google Play (Android). Search "Expo Go". It must support **SDK 58**. | Install on your phone |
| A Wi-Fi network | Your phone and Mac must be on the **same** Wi-Fi | — |

You will use the **Terminal** app (Applications → Utilities → Terminal). Each "terminal window" below
is a separate Terminal window or tab (⌘T opens a new tab). Leave them running while you test.

Your project folder is `~/Project/cashandcarry`. If it is somewhere else, change that part of the commands.

---

## Part A — Start everything

### 1. Start PostgreSQL (the database)

```bash
brew services start postgresql@17
```

Check it is running:

```bash
brew services list | grep postgresql
```

You should see `postgresql@17 started`. It keeps running in the background, even after a restart.

### 2. Find your Mac's Wi-Fi address (needed for the phone)

```bash
ipconfig getifaddr en0
```

You get something like `192.168.1.20`. Write it down — below it is called **YOUR-MAC-IP**.
(If nothing appears, your Mac may use a different network name: try `ipconfig getifaddr en1`.)

Open `backend/.env` in TextEdit and make sure the `DJANGO_ALLOWED_HOSTS` line includes it, for example:

```
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,192.168.1.20
```

Save the file. (Your Wi-Fi address can change when you reconnect; if the app later says it can't reach the
server, repeat this step.)

### 3. Start the server (Terminal window 1)

The first time only, prepare the database (safe to run again; it never deletes data):

```bash
cd ~/Project/cashandcarry/backend
.venv/bin/python manage.py migrate
```

Then start the server so your phone can reach it:

```bash
cd ~/Project/cashandcarry/backend
.venv/bin/python manage.py runserver 0.0.0.0:8000
```

Leave this window open. If macOS asks whether **Python** may accept incoming network connections, click
**Allow** (the phone needs this).

Check it works: open <http://localhost:8000/api/health/> in your browser. You should see
`{"status":"ok","database":"ok"}`.

### 4. Start the Admin Portal (Terminal window 2)

```bash
cd ~/Project/cashandcarry
npm install          # first time only
npm run dev
```

Open <http://localhost:5173> in Chrome or Safari.

**Signing in:** use your existing admin email and password. If you don't have an admin account yet (or
forgot it), create a **new** one — this never changes existing accounts:

```bash
cd ~/Project/cashandcarry/backend
.venv/bin/python manage.py createsuperuser
```

> After this update, everyone has to sign in once more (old sessions were ended by a security improvement).

### 5. Start the customer app (Terminal window 3)

```bash
cd ~/Project/cashandcarry/mobile
npm install          # first time only
npx expo start
```

A large QR code appears in the terminal.

### 6. Open the app on your phone

1. Make sure the phone is on the **same Wi-Fi** as the Mac (not mobile data).
2. **iPhone:** open the Camera app, point it at the QR code and tap the banner.
   **Android:** open Expo Go and tap **Scan QR code**.
3. The first load takes up to a minute. You should see the Al Zaryab home screen.

If the app says **"Can't reach Al Zaryab"**: check the phone's Wi-Fi, step 2 (address in
`DJANGO_ALLOWED_HOSTS`), that window 1 was started with `0.0.0.0:8000`, and that macOS allowed Python
connections (System Settings → Network → Firewall → Options). If your Wi-Fi blocks devices from talking
to each other (common on guest/office networks), use a home network or your phone's hotspot.

---

## Part B — Test the store

Tick each box as you go. If something doesn't look right, take a screenshot and note what you did.

### 7. Add products (Admin Portal)

- [ ] In the portal, click **Add Product**. Enter a name (e.g. *Olpers Milk*), choose a category, unit
      (*1 L*), price (*320*), stock (*20*) and a photo (JPG/PNG/WEBP up to 5 MB). Click **Save**.
- [ ] Add 3–4 more products in different categories. Give one a stock of **2** (low stock) and one
      a stock of **0** (out of stock).
- [ ] The **Dashboard** shows the new totals; **Products** lists them; search and filters work.
- [ ] **Categories**: add a category, rename it.

### 8. Register a customer (phone)

- [ ] Tap the **Account** tab → **Create an account**. Use a real email address you can open.
- [ ] Try a weak password (e.g. *12345678*) — the app should explain why it's not allowed.
- [ ] Finish registering. You are signed in and see your name on the Account tab.

### 9. Browse products (phone)

- [ ] **Home** shows your products with photos and prices in Rs. Pull down to refresh.
- [ ] Out-of-stock products show **Out of stock**; the low-stock one shows **Only a few left**.
- [ ] **Search**: type part of a product name.
- [ ] **Categories**: open a category; only its products are shown.
- [ ] Open a product: photo, description, price, stock and quantity buttons are there.

### 10. Add to the cart (phone)

- [ ] On a product, choose a quantity and tap **Add to cart**. The **Cart** tab shows a badge.
- [ ] In the **Cart**, change quantities with **+ / −**, remove an item, check the subtotal.
- [ ] Close the app completely and reopen it: the cart is still there.
- [ ] The out-of-stock product cannot be added.

### 11. Place a test order (phone)

- [ ] In the Cart, tap **Continue to checkout**.
- [ ] Add a delivery address (name, phone, house/street, area, city).
- [ ] Check the summary: subtotal, **delivery fee**, total, and **Cash on Delivery**.
- [ ] Add a note (optional) and tap **Place order**.
- [ ] You see **"Thank you! Your order has been placed"** with an order number like `AZ-…`.
      The cart is now empty.

### 12. View and update the order (Admin Portal)

- [ ] Click **Orders**. The new order is at the top with the customer's name.
- [ ] Open it: items, totals, customer phone/email, delivery address and your note are shown.
- [ ] Click **Confirm Order**, then **Start Preparing**, **Send Out for Delivery**, **Mark as Delivered**.
- [ ] Check **Products**: the ordered quantities were taken off the stock.

### 13. Check the order on the phone

- [ ] **Account → All orders**: the order is listed. Pull down to refresh after each admin change.
- [ ] Open it: the status matches the portal, the timeline shows each step, payment shows **Paid**
      after delivery.
- [ ] Place a second order and, while it is still **Pending**, tap **Cancel order** on the phone.
      It shows **Cancelled**, and in the portal the stock goes back up.

### 14. Password reset (phone)

- [ ] Sign out (**Account → Sign out**). Your cart stays on the phone.
- [ ] Tap **Sign in → Forgot password?**, enter your email, tap **Email me a code**.
- [ ] **During local testing no real email is sent.** The email, with the 6-digit code, is printed in
      **Terminal window 1** (look for *"Your Al Zaryab password reset code is"*). Real emails need an
      email provider set up for the live server (see `docs/DEPLOYMENT.md`).
- [ ] Enter the code and a new password. Sign in with the new password.
- [ ] Try the old code again — it no longer works.

### 15. Profile and addresses (phone)

- [ ] **Account → Edit profile**: change your name or phone and save.
- [ ] **Delivery addresses**: add a second address, make it the default, delete one (it asks first).

---

## Stopping everything

Press **Ctrl + C** in each Terminal window. PostgreSQL keeps running in the background (that's fine);
to stop it: `brew services stop postgresql@17`.

## If something goes wrong

| Problem | What to do |
| --- | --- |
| Portal shows "Can't reach the server" | Is Terminal window 1 still running? Restart it (step 3). |
| Phone: "Can't reach Al Zaryab" | See the note under step 6. |
| Phone shows a red error screen | Shake the phone → **Reload**. Send a screenshot to your developer. |
| Expo Go says the project needs a different SDK | Update Expo Go from the App Store / Play Store. |
| "Too many attempts. Please wait a minute" | Normal protection after several wrong passwords. Wait a minute. |
| Product photos don't show on the phone | The server must be started with `0.0.0.0:8000` and your Mac's address added in step 2. |
