# BLADERS X Store Deployment

This storefront is ready to move into a GitHub -> Vercel -> Supabase workflow.

## Architecture

- GitHub stores the site code and product assets.
- Vercel hosts the storefront and server-side checkout API.
- Stripe Checkout takes payment.
- Supabase stores products and order status.

## 1. Security first

Do not commit Stripe secret keys, webhook secrets, or Supabase service role keys.
Use Vercel Environment Variables for all secrets.

If a live Stripe secret key was pasted into chat or any public place, rotate it
in Stripe before using it again.

## 2. Supabase

Create a Supabase project, then run:

```sql
-- store-demo/supabase/schema.sql
```

Copy the SQL from `supabase/schema.sql` into the Supabase SQL Editor and run it.

Use these Vercel environment variables:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_server_side_service_role_key
ADMIN_ACCESS_TOKEN=your_long_random_admin_token
RESEND_API_KEY=re_your_resend_api_key
ORDER_NOTIFICATION_EMAIL=cs@fma-hk.com
ORDER_NOTIFICATION_FROM=BLADERS X Store <orders@your-verified-domain.com>
```

`RESEND_API_KEY` enables new-order email notifications. If it is not set,
orders still save normally, but no email will be sent. For production, verify
your sending domain in Resend and use that domain in `ORDER_NOTIFICATION_FROM`.

## 3. Stripe

Use these Vercel environment variables:

```env
STRIPE_SECRET_KEY=rotated_stripe_secret_key_from_dashboard
STRIPE_WEBHOOK_SECRET=whsec_from_stripe_webhook
```

For production, use a rotated live secret key that has never been pasted into
chat or committed to Git. This storefront now creates Checkout Session line
items dynamically, so product pricing can be controlled from the admin panel
instead of fixed Stripe Price IDs.

## 4. Vercel

Import the GitHub repository into Vercel and keep the project root as the
repository root (`.`).

Only set the project root to `store-demo` if this project is nested inside a
larger monorepo. If the GitHub repo already contains `package.json`, `app/`, and
`public/` at the top level, leave Root Directory blank.

Vercel will use `vercel.json`, which runs:

```bash
npm run build:vercel
```

## 5. Stripe webhook

After Vercel gives you a production URL, create a Stripe webhook endpoint:

```text
https://your-vercel-domain.com/api/stripe-webhook
```

Subscribe to:

```text
checkout.session.completed
```

Copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET`.

## 6. GitHub

Before pushing, check that `.env`, `.env.local`, and `.vercel` are ignored.
They are already covered by this project's `.gitignore`.

## 7. Admin panel

This project now includes an admin panel at:

```text
/admin/login
```

It supports:

- size-by-size stock control
- product original price / member price / sale price
- switch between member price and sale price
- order list viewing
- fulfillment status updates
- internal admin notes

For this to work properly, you should run the latest SQL in:

```text
store-demo/supabase/schema.sql
```

That schema adds:

- `product_variants` for per-size inventory
- `fulfillment_status` on orders
- `admin_notes` on orders

Without Supabase, the storefront can still load, but the admin panel cannot manage live stock or orders.
