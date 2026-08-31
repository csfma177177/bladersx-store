type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json };

export type InventoryItem = {
  sku: "BX-MUT-01" | "BX-MUT-02";
  size: "S" | "M" | "L" | "XL" | "2XL";
  quantity: number;
};

export type ProductRow = {
  sku: string;
  name: string;
  colour: string;
  price_hkd: number;
  active: boolean;
  updated_at?: string | null;
};

export type ProductVariantRow = {
  sku: string;
  size: string;
  stock_quantity: number;
  active: boolean;
  updated_at?: string | null;
};

export type OrderRow = {
  id: string;
  stripe_session_id: string;
  client_reference_id: string;
  status: string;
  fulfillment_status: string;
  currency: string;
  amount_total: number | null;
  customer_email: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  items: Json;
  admin_notes: string | null;
  paid_at: string | null;
  created_at: string;
};

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { url, serviceRoleKey };
}

export function isSupabaseConfigured() {
  const { url, serviceRoleKey } = getSupabaseConfig();
  return Boolean(url && serviceRoleKey);
}

async function supabaseFetch<T>(path: string, init: RequestInit = {}) {
  const { url, serviceRoleKey } = getSupabaseConfig();
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase is not configured.");
  }

  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  if (response.status === 204) return null as T;
  return response.json() as Promise<T>;
}

export async function listProducts() {
  const [products, variants] = await Promise.all([
    supabaseFetch<ProductRow[]>(
      "/rest/v1/products?select=sku,name,colour,price_hkd,active,updated_at&order=sku.asc",
    ),
    supabaseFetch<ProductVariantRow[]>(
      "/rest/v1/product_variants?select=sku,size,stock_quantity,active,updated_at&order=sku.asc",
    ),
  ]);

  return { products, variants };
}

export async function listOrders(limit = 50) {
  return supabaseFetch<OrderRow[]>(
    `/rest/v1/orders?select=id,stripe_session_id,client_reference_id,status,fulfillment_status,currency,amount_total,customer_email,customer_name,customer_phone,items,admin_notes,paid_at,created_at&order=created_at.desc&limit=${limit}`,
  );
}

function encodeFilter(value: string) {
  return encodeURIComponent(value);
}

export async function updateProductVariant(input: {
  sku: string;
  size: string;
  stockQuantity: number;
  active: boolean;
}) {
  return supabaseFetch<null>(
    `/rest/v1/product_variants?sku=eq.${encodeFilter(input.sku)}&size=eq.${encodeFilter(input.size)}`,
    {
      method: "PATCH",
      headers: { prefer: "return=minimal" },
      body: JSON.stringify({
        stock_quantity: Math.max(0, input.stockQuantity),
        active: input.active,
      }),
    },
  );
}

export async function updateOrderAdmin(input: {
  id: string;
  fulfillmentStatus: string;
  adminNotes: string;
}) {
  return supabaseFetch<null>(`/rest/v1/orders?id=eq.${encodeFilter(input.id)}`, {
    method: "PATCH",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify({
      fulfillment_status: input.fulfillmentStatus,
      admin_notes: input.adminNotes || null,
    }),
  });
}

export async function loadInventorySnapshot(items: InventoryItem[]) {
  if (!isSupabaseConfigured() || items.length === 0) return null;

  const skuFilters = Array.from(new Set(items.map((item) => item.sku)))
    .map((sku) => `"${sku}"`)
    .join(",");

  return supabaseFetch<ProductVariantRow[]>(
    `/rest/v1/product_variants?select=sku,size,stock_quantity,active&sku=in.(${skuFilters})`,
  );
}

export async function applyPaidOrderInventory(items: InventoryItem[]) {
  if (!isSupabaseConfigured() || items.length === 0) return;

  const snapshot = await loadInventorySnapshot(items);
  if (!snapshot) return;

  for (const item of items) {
    const variant = snapshot.find((entry) => entry.sku === item.sku && entry.size === item.size);
    if (!variant) continue;

    const nextQuantity = Math.max(0, variant.stock_quantity - item.quantity);
    await updateProductVariant({
      sku: item.sku,
      size: item.size,
      stockQuantity: nextQuantity,
      active: variant.active,
    });
  }
}
