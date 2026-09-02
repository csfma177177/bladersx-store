type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json };

export type ProductSku = "BX-MUT-01" | "BX-MUT-02";
export type ProductKey = "black" | "navy";
export type PricingMode = "original" | "member" | "sale";

export type InventoryItem = {
  sku: ProductSku;
  size: "S" | "M" | "L" | "XL" | "2XL";
  quantity: number;
};

export type ProductRow = {
  sku: ProductSku;
  name: string;
  colour: string;
  price_hkd: number;
  original_price_hkd: number;
  member_price_hkd: number | null;
  sale_price_hkd: number | null;
  pricing_mode: PricingMode;
  active: boolean;
  updated_at?: string | null;
};

export type ProductVariantRow = {
  sku: ProductSku;
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

export type OrderInsert = {
  stripe_session_id: string;
  client_reference_id: string;
  status: string;
  currency: string;
  amount_total: number | null;
  customer_email: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  items: Json;
  checkout_url?: string | null;
  admin_notes?: string | null;
  paid_at?: string | null;
};

export const SKU_TO_PRODUCT_KEY: Record<ProductSku, ProductKey> = {
  "BX-MUT-01": "black",
  "BX-MUT-02": "navy",
};

export const DEFAULT_PRODUCTS: ProductRow[] = [
  {
    sku: "BX-MUT-01",
    name: "Utility Tee - Charcoal Grey",
    colour: "Charcoal Grey",
    price_hkd: 498,
    original_price_hkd: 498,
    member_price_hkd: 498,
    sale_price_hkd: null,
    pricing_mode: "member",
    active: true,
  },
  {
    sku: "BX-MUT-02",
    name: "Utility Tee - Navy",
    colour: "Field Navy",
    price_hkd: 498,
    original_price_hkd: 498,
    member_price_hkd: 498,
    sale_price_hkd: null,
    pricing_mode: "member",
    active: true,
  },
];

function normalizeProductRow(product: ProductRow): ProductRow {
  if (product.sku === "BX-MUT-01") {
    return {
      ...product,
      name: "Utility Tee - Charcoal Grey",
      colour: "Charcoal Grey",
    };
  }

  return product;
}

export function getEffectivePriceHkd(
  product: Pick<ProductRow, "original_price_hkd" | "member_price_hkd" | "sale_price_hkd" | "pricing_mode">,
) {
  if (product.pricing_mode === "sale" && product.sale_price_hkd && product.sale_price_hkd > 0) {
    return product.sale_price_hkd;
  }

  if (product.pricing_mode === "member" && product.member_price_hkd && product.member_price_hkd > 0) {
    return product.member_price_hkd;
  }

  return product.original_price_hkd;
}

export function getEffectivePriceLabel(product: Pick<ProductRow, "pricing_mode" | "sale_price_hkd" | "member_price_hkd">) {
  if (product.pricing_mode === "sale" && product.sale_price_hkd && product.sale_price_hkd > 0) {
    return "特價";
  }

  if (product.pricing_mode === "member" && product.member_price_hkd && product.member_price_hkd > 0) {
    return "會員價";
  }

  return null;
}

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

  const responseText = await response.text();
  if (!responseText) return null as T;

  return JSON.parse(responseText) as T;
}

export async function listProducts() {
  const [products, variants] = await Promise.all([
    supabaseFetch<ProductRow[]>(
      "/rest/v1/products?select=sku,name,colour,price_hkd,original_price_hkd,member_price_hkd,sale_price_hkd,pricing_mode,active,updated_at&order=sku.asc",
    ),
    supabaseFetch<ProductVariantRow[]>(
      "/rest/v1/product_variants?select=sku,size,stock_quantity,active,updated_at&order=sku.asc",
    ),
  ]);

  return { products: products.map(normalizeProductRow), variants };
}

export async function getStoreProducts() {
  if (!isSupabaseConfigured()) {
    return DEFAULT_PRODUCTS;
  }

  const products = await supabaseFetch<ProductRow[]>(
    "/rest/v1/products?select=sku,name,colour,price_hkd,original_price_hkd,member_price_hkd,sale_price_hkd,pricing_mode,active,updated_at&order=sku.asc",
  );

  return products.map(normalizeProductRow);
}

export async function listOrders(limit = 50) {
  return supabaseFetch<OrderRow[]>(
    `/rest/v1/orders?select=id,stripe_session_id,client_reference_id,status,fulfillment_status,currency,amount_total,customer_email,customer_name,customer_phone,items,admin_notes,paid_at,created_at&order=created_at.desc&limit=${limit}`,
  );
}

export async function getOrderById(id: string) {
  const rows = await supabaseFetch<OrderRow[]>(
    `/rest/v1/orders?select=id,stripe_session_id,client_reference_id,status,fulfillment_status,currency,amount_total,customer_email,customer_name,customer_phone,items,admin_notes,paid_at,created_at&id=eq.${encodeFilter(id)}&limit=1`,
  );

  return rows[0] ?? null;
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

export async function updateProductPricing(input: {
  sku: string;
  originalPriceHkd: number;
  memberPriceHkd: number | null;
  salePriceHkd: number | null;
  pricingMode: PricingMode;
  active: boolean;
}) {
  const originalPriceHkd = Math.max(0, input.originalPriceHkd);
  const memberPriceHkd = input.memberPriceHkd && input.memberPriceHkd > 0 ? Math.max(0, input.memberPriceHkd) : null;
  const salePriceHkd = input.salePriceHkd && input.salePriceHkd > 0 ? input.salePriceHkd : null;
  const effectivePriceHkd =
    input.pricingMode === "sale" && salePriceHkd
      ? salePriceHkd
      : input.pricingMode === "member" && memberPriceHkd
        ? memberPriceHkd
        : originalPriceHkd;

  return supabaseFetch<null>(`/rest/v1/products?sku=eq.${encodeFilter(input.sku)}`, {
    method: "PATCH",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify({
      price_hkd: effectivePriceHkd,
      original_price_hkd: originalPriceHkd,
      member_price_hkd: memberPriceHkd,
      sale_price_hkd: salePriceHkd,
      pricing_mode: input.pricingMode,
      active: input.active,
    }),
  });
}

export async function createOrder(input: OrderInsert) {
  return supabaseFetch<null>("/rest/v1/orders", {
    method: "POST",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify(input),
  });
}

export async function updateOrderAdmin(input: {
  id: string;
  fulfillmentStatus: string;
  adminNotes: string;
  paymentStatus?: string;
  paidAt?: string | null;
}) {
  const body: Record<string, unknown> = {
    fulfillment_status: input.fulfillmentStatus,
    admin_notes: input.adminNotes || null,
  };

  if (input.paymentStatus) {
    body.status = input.paymentStatus;
    body.paid_at = input.paymentStatus === "paid" ? (input.paidAt ?? new Date().toISOString()) : null;
  }

  return supabaseFetch<null>(`/rest/v1/orders?id=eq.${encodeFilter(input.id)}`, {
    method: "PATCH",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
}

export async function deleteOrderById(id: string) {
  return supabaseFetch<null>(`/rest/v1/orders?id=eq.${encodeFilter(id)}`, {
    method: "DELETE",
    headers: { prefer: "return=minimal" },
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
