import { createHmac, timingSafeEqual } from "crypto";

export const runtime = "nodejs";

type StripeCheckoutSession = {
  id: string;
  client_reference_id?: string | null;
  amount_total?: number;
  currency?: string;
  customer_details?: {
    email?: string;
    name?: string;
    phone?: string;
  };
};

function parseStripeSignature(header: string | null) {
  if (!header) return null;

  const values = new Map<string, string[]>();
  for (const part of header.split(",")) {
    const [key, value] = part.split("=");
    if (!key || !value) continue;
    const list = values.get(key) ?? [];
    list.push(value);
    values.set(key, list);
  }

  const timestamp = values.get("t")?.[0];
  const signatures = values.get("v1") ?? [];
  return timestamp && signatures.length ? { timestamp, signatures } : null;
}

function verifySignature(payload: string, header: string | null, secret: string) {
  const parsed = parseStripeSignature(header);
  if (!parsed) return false;

  const expected = createHmac("sha256", secret).update(`${parsed.timestamp}.${payload}`).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  return parsed.signatures.some((signature) => {
    const signatureBuffer = Buffer.from(signature, "hex");
    return signatureBuffer.length === expectedBuffer.length && timingSafeEqual(signatureBuffer, expectedBuffer);
  });
}

async function updateSupabaseOrder(session: StripeCheckoutSession) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return;

  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/orders?on_conflict=stripe_session_id`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json",
      prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      stripe_session_id: session.id,
      client_reference_id: session.client_reference_id ?? `stripe-${session.id}`,
      status: "paid",
      amount_total: session.amount_total ?? null,
      currency: session.currency ?? "hkd",
      customer_email: session.customer_details?.email ?? null,
      customer_name: session.customer_details?.name ?? null,
      customer_phone: session.customer_details?.phone ?? null,
      paid_at: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    console.error("Supabase order update failed", await response.text());
  }
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return Response.json({ error: "Stripe webhook is not configured yet." }, { status: 503 });

  const payload = await request.text();
  if (!verifySignature(payload, request.headers.get("stripe-signature"), webhookSecret)) {
    return Response.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  const event = JSON.parse(payload) as {
    type?: string;
    data?: { object?: StripeCheckoutSession };
  };

  if (event.type === "checkout.session.completed" && event.data?.object?.id) {
    await updateSupabaseOrder(event.data.object);
  }

  return Response.json({ received: true });
}
