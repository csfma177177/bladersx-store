import {
  DEFAULT_PRODUCTS,
  getEffectivePriceHkd,
  getEffectivePriceLabel,
  getStoreProducts,
  loadInventorySnapshot,
  type ProductRow,
} from "@/lib/supabase-admin";

type CheckoutItem = {
  sku: "BX-MUT-01" | "BX-MUT-02";
  size: string;
  quantity: number;
};

const allowedSizes = new Set(["S", "M", "L", "XL", "2XL"]);

export const runtime = "nodejs";

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status });
}

function normaliseItems(items: unknown): CheckoutItem[] | null {
  if (!Array.isArray(items) || items.length === 0 || items.length > 10) return null;

  const normalised: CheckoutItem[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") return null;
    const raw = item as Partial<CheckoutItem>;
    const quantity = Math.max(1, Math.min(5, Number(raw.quantity) || 1));
    if ((raw.sku !== "BX-MUT-01" && raw.sku !== "BX-MUT-02") || !allowedSizes.has(String(raw.size))) {
      return null;
    }
    normalised.push({ sku: raw.sku, size: String(raw.size), quantity });
  }

  return normalised;
}

async function getCatalogueMap() {
  const products = await getStoreProducts().catch(() => DEFAULT_PRODUCTS);
  return products.reduce<Record<CheckoutItem["sku"], ProductRow>>((acc, product) => {
    acc[product.sku] = product;
    return acc;
  }, {} as Record<CheckoutItem["sku"], ProductRow>);
}

async function createSupabaseOrder(record: Record<string, unknown>) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return;

  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/orders`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json",
      prefer: "return=minimal",
    },
    body: JSON.stringify(record),
  });

  if (!response.ok) {
    console.error("Supabase order insert failed", await response.text());
  }
}

async function validateInventory(items: CheckoutItem[], catalogue: Record<CheckoutItem["sku"], ProductRow>) {
  const snapshot = await loadInventorySnapshot(
    items
      .filter((item): item is CheckoutItem & { size: "S" | "M" | "L" | "XL" | "2XL" } => allowedSizes.has(item.size))
      .map((item) => ({
        sku: item.sku,
        size: item.size as "S" | "M" | "L" | "XL" | "2XL",
        quantity: item.quantity,
      })),
  );

  if (!snapshot) return null;

  const unavailable = items.find((item) => {
    const product = catalogue[item.sku];
    const variant = snapshot.find((entry) => entry.sku === item.sku && entry.size === item.size);
    return !product?.active || !variant || !variant.active || variant.stock_quantity < item.quantity;
  });

  return unavailable
    ? `${catalogue[unavailable.sku].name} / ${unavailable.size} 暫時缺貨，請更新購物車後再試。`
    : null;
}

export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return json({ error: "Stripe is not configured yet." }, 503);
  }

  let payload: { items?: unknown };
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid JSON payload." }, 400);
  }

  const items = normaliseItems(payload.items);
  if (!items) return json({ error: "A valid cart is required." }, 400);

  const catalogue = await getCatalogueMap();
  const inventoryError = await validateInventory(items, catalogue);
  if (inventoryError) return json({ error: inventoryError }, 409);

  const params = new URLSearchParams();
  const origin = new URL(request.url).origin;
  const clientReferenceId = `bx-${crypto.randomUUID()}`;
  const amountTotal = items.reduce(
    (sum, item) => sum + getEffectivePriceHkd(catalogue[item.sku]) * 100 * item.quantity,
    0,
  );

  items.forEach((item, index) => {
    const product = catalogue[item.sku];
    const unitAmount = getEffectivePriceHkd(product) * 100;

    params.append(`line_items[${index}][price_data][currency]`, "hkd");
    params.append(`line_items[${index}][price_data][unit_amount]`, String(unitAmount));
    params.append(`line_items[${index}][price_data][product_data][name]`, product.name);
    params.append(`line_items[${index}][price_data][product_data][description]`, `${product.colour} / SIZE ${item.size} / ${getEffectivePriceLabel(product)}`);
    params.append(`line_items[${index}][quantity]`, String(item.quantity));
    params.append(`metadata[item_${index}_sku]`, item.sku);
    params.append(`metadata[item_${index}_size]`, item.size);
    params.append(`metadata[item_${index}_quantity]`, String(item.quantity));
    params.append(`metadata[item_${index}_unit_price_hkd]`, String(getEffectivePriceHkd(product)));
    params.append(`metadata[item_${index}_price_label]`, getEffectivePriceLabel(product));
  });

  params.append("mode", "payment");
  params.append("success_url", `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`);
  params.append("cancel_url", `${origin}/?checkout=cancelled`);
  params.append("client_reference_id", clientReferenceId);
  params.append("billing_address_collection", "auto");
  params.append("phone_number_collection[enabled]", "true");
  params.append("shipping_address_collection[allowed_countries][0]", "HK");
  params.append("metadata[store]", "BLADERS X LIVE TOURNAMENT HUB");

  const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  const stripeData = await stripeResponse.json() as {
    id?: string;
    url?: string;
    error?: { message?: string };
  };

  if (!stripeResponse.ok || !stripeData.id || !stripeData.url) {
    return json({ error: stripeData.error?.message || "Stripe Checkout could not be created." }, 502);
  }

  await createSupabaseOrder({
    stripe_session_id: stripeData.id,
    client_reference_id: clientReferenceId,
    status: "checkout_created",
    currency: "hkd",
    amount_total: amountTotal,
    items: items.map((item) => ({
      ...item,
      unit_price_hkd: getEffectivePriceHkd(catalogue[item.sku]),
      price_label: getEffectivePriceLabel(catalogue[item.sku]),
    })),
    checkout_url: stripeData.url,
  });

  return json({ url: stripeData.url });
}
