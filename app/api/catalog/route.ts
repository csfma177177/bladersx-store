import {
  DEFAULT_PRODUCTS,
  SKU_TO_PRODUCT_KEY,
  getEffectivePriceHkd,
  getEffectivePriceLabel,
  getStoreProducts,
} from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET() {
  const products = await getStoreProducts().catch(() => DEFAULT_PRODUCTS);

  const payload = products.map((product) => ({
    key: SKU_TO_PRODUCT_KEY[product.sku],
    sku: product.sku,
    name: product.name,
    colour: product.colour,
    active: product.active,
    originalPriceHkd: product.original_price_hkd,
    memberPriceHkd: product.member_price_hkd,
    salePriceHkd: product.sale_price_hkd,
    pricingMode: product.pricing_mode,
    effectivePriceHkd: getEffectivePriceHkd(product),
    effectivePriceLabel: getEffectivePriceLabel(product),
  }));

  return Response.json({ products: payload });
}
