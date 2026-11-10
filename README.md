# MainBazar Haripur

One online place for all of Haripur's shops. Shopkeepers register, upload products
(clothes, shoes, etc.), and customers order with **Cash on Delivery**. Buyer and seller
talk on **WhatsApp**.

## Run it on your laptop

1. Install Node.js 20+ from https://nodejs.org
2. In this folder:
   ```
   npm install
   cp .env.example .env.local     # then edit ADMIN_EMAIL / ADMIN_PASSWORD
   npm run dev
   ```
3. Open http://localhost:3000

The database (`data/mainbazar.db`) and uploaded photos (`data/uploads/`) are created
automatically on first run. **Back up the `data/` folder** — it holds everything.

## How it works

- **Customers** browse `/products` and `/shops`, open a product, fill in the order form
  (no account needed) and get an order code + tracking page (`/order/CODE`).
- **Shopkeepers** register at `/seller/register`, add products at `/seller`, and manage
  orders at `/seller/orders`:
  1. Message the buyer on WhatsApp (button pre-fills the message) → tick **Confirmed**
  2. Pack the order → tick **Packed**
  3. Deliver and collect cash → tick **Delivered**
  (Cancelling returns the items to stock.)
- **Admin** logs in at `/login` with the `.env.local` credentials and approves shops at `/admin`.
  Shops are hidden from customers until approved.

## Settings (`.env.local`)

| Variable | Meaning |
|---|---|
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | First admin account (created when the database is first made) |
| `DEFAULT_COUNTRY_CODE` | Used to turn `03xx…` numbers into WhatsApp links (92 = Pakistan, 91 = India) |
| `CURRENCY` | Label shown before prices |
| `COOKIE_SECURE` | Set `true` when the site is served over HTTPS |

## Current limits (ideas for next steps)

- One product per order (no shopping cart yet).
- No email/SMS notifications; WhatsApp messages are sent by tapping the buttons.
- No login rate-limiting or password reset yet — add before going public.
- SQLite + local photo storage suits one server. For hosting like Vercel you would
  switch to a hosted database and image storage.
