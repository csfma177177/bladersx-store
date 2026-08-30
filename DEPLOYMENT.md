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
```

## 3. Stripe

Create two Stripe Products and Prices:

- `BX-MUT-01`: Utility Tee - Black
- `BX-MUT-02`: Utility Tee - Navy

Use these Vercel environment variables:

```env
STRIPE_SECRET_KEY=rotated_stripe_secret_key_from_dashboard
STRIPE_PRICE_BLACK=price_for_black_tee
STRIPE_PRICE_NAVY=price_for_navy_tee
STRIPE_WEBHOOK_SECRET=whsec_from_stripe_webhook
```

For production, use live Stripe products, live Price IDs, and a rotated live
secret key that has never been pasted into chat or committed to Git.

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
