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
- **Shopkeepers** register at `/seller/register` in 3 steps:
  1. Enter their email → a 6-digit code is emailed (valid 10 minutes, resend after 60 s).
     An email that is already registered is refused.
  2. Enter the code (5 wrong tries locks it; request a new one).
  3. Enter shop details. The shop is saved as **pending** and the admin gets an email.

  After the admin approves the shop, the seller gets an email, the shop goes live, and they
  can add products at `/seller` and manage orders at `/seller/orders`:
  1. Message the buyer on WhatsApp (button pre-fills the message) → tick **Confirmed**
  2. Pack the order → tick **Packed**
  3. Deliver and collect cash → tick **Delivered**
  (Cancelling returns the items to stock.)
- **Admin** logs in at `/login` with the `.env.local` credentials and approves shops at `/admin`
  (pending registrations are listed first). Shops are hidden from customers, and can't add
  products, until approved.

## Settings (`.env.local`)

| Variable | Meaning |
|---|---|
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | First admin account (created when the database is first made) |
| `DEFAULT_COUNTRY_CODE` | Used to turn `03xx…` numbers into WhatsApp links (92 = Pakistan, 91 = India) |
| `CURRENCY` | Label shown before prices |
| `COOKIE_SECURE` | Set `true` when the site is served over HTTPS |
| `EMAIL_USER`, `EMAIL_PASS` | SMTP login for sending emails. For Gmail use a 16-character [App Password](https://myaccount.google.com/apppasswords). Leave empty locally to print emails in the terminal |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_FROM` | Optional: non-Gmail SMTP server and "From" header |
| `APP_URL` | Public site address used for links in emails (e.g. `https://yourshop.vercel.app`) |
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `BLOB_READ_WRITE_TOKEN` | Production database and image storage (see `.env.example`) |

`ADMIN_EMAIL` also receives the "New Seller Registration Pending Approval" emails.
Database tables and new columns are created automatically on startup; there is no separate
migration command.

## Current limits (ideas for next steps)

- One product per order (no shopping cart yet).
- Emails are sent only for seller sign-up and approval; order updates still go over WhatsApp.
- No login rate-limiting or password reset yet — add before going public.
- SQLite + local photo storage suits one server. For hosting like Vercel you would
  switch to a hosted database and image storage.
