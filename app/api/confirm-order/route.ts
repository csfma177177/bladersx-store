import {
  createOrder,
  DEFAULT_PRODUCTS,
  getEffectivePriceHkd,
  getStoreProducts,
  isSupabaseConfigured,
  loadInventorySnapshot,
  type InventoryItem,
  type ProductRow,
} from "@/lib/supabase-admin";

type OrderItem = {
  sku: "BX-MUT-01" | "BX-MUT-02";
  size: string;
  quantity: number;
};

type OrderPayload = {
  customer?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
  items?: unknown;
};

const allowedSizes = new Set(["S", "M", "L", "XL", "2XL", "3XL"]);

export const runtime = "nodejs";

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status });
}

function normaliseItems(items: unknown): OrderItem[] | null {
  if (!Array.isArray(items) || items.length === 0 || items.length > 10) return null;

  const normalised: OrderItem[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") return null;
    const raw = item as Partial<OrderItem>;
    const quantity = Math.max(1, Math.min(5, Number(raw.quantity) || 1));
    if ((raw.sku !== "BX-MUT-01" && raw.sku !== "BX-MUT-02") || !allowedSizes.has(String(raw.size))) {
      return null;
    }
    normalised.push({ sku: raw.sku, size: String(raw.size), quantity });
  }

  return normalised;
}

function normaliseCustomer(customer: OrderPayload["customer"]) {
  const firstName = String(customer?.firstName ?? "").trim();
  const lastName = String(customer?.lastName ?? "").trim();
  const email = String(customer?.email ?? "").trim().toLowerCase();
  const phone = String(customer?.phone ?? "").trim();

  if (!firstName || !lastName || !email || !phone) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;

  return { firstName, lastName, email, phone };
}

async function getCatalogueMap() {
  const products = await getStoreProducts().catch(() => DEFAULT_PRODUCTS);
  return products.reduce<Record<OrderItem["sku"], ProductRow>>((acc, product) => {
    acc[product.sku] = product;
    return acc;
  }, {} as Record<OrderItem["sku"], ProductRow>);
}

async function validateInventory(items: OrderItem[], catalogue: Record<OrderItem["sku"], ProductRow>) {
  const snapshot = await loadInventorySnapshot(
    items.map((item) => ({
      sku: item.sku,
      size: item.size as InventoryItem["size"],
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
    ? `${catalogue[unavailable.sku].name} / ${unavailable.size} 暫時缺貨，請更新購物袋後再試。`
    : null;
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return json({ error: "Order system is not configured yet. Please connect Supabase first." }, 503);
  }

  let payload: OrderPayload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid JSON payload." }, 400);
  }

  const customer = normaliseCustomer(payload.customer);
  if (!customer) {
    return json({ error: "請完整填寫名、姓、電郵同電話號碼。" }, 400);
  }

  const items = normaliseItems(payload.items);
  if (!items) {
    return json({ error: "A valid cart is required." }, 400);
  }

  const catalogue = await getCatalogueMap();
  const inventoryError = await validateInventory(items, catalogue);
  if (inventoryError) return json({ error: inventoryError }, 409);

  const orderReference = `BX-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const manualSessionId = `manual-${crypto.randomUUID()}`;
  const amountTotal = items.reduce(
    (sum, item) => sum + getEffectivePriceHkd(catalogue[item.sku]) * 100 * item.quantity,
    0,
  );

  try {
    await createOrder({
      stripe_session_id: manualSessionId,
      client_reference_id: orderReference,
      status: "checkout_created",
      currency: "hkd",
      amount_total: amountTotal,
      customer_email: customer.email,
      customer_name: `${customer.firstName} ${customer.lastName}`,
      customer_phone: customer.phone,
      items: items.map((item) => ({
        ...item,
        product_name: catalogue[item.sku].name,
        colour: catalogue[item.sku].colour,
        unit_price_hkd: getEffectivePriceHkd(catalogue[item.sku]),
      })),
      checkout_url: null,
      admin_notes: "Manual payment follow-up required.",
      paid_at: null,
    });
  } catch {
    return json({ error: "訂單已填好，但系統暫時未能儲存。請稍後再試，或者直接聯絡 admin。"}, 500);
  }

  return json({
    ok: true,
    orderReference,
  });
}
