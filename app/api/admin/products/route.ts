import { NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/admin-auth";
import { type PricingMode, updateProductPricing } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const allowedPricingModes = new Set<PricingMode>(["member", "sale"]);

export async function POST(request: Request) {
  const url = new URL(request.url);
  if (!(await hasAdminSession())) {
    return NextResponse.redirect(new URL("/admin/login?error=invalid", url.origin), { status: 303 });
  }

  const formData = await request.formData();
  const sku = String(formData.get("sku") ?? "");
  const originalPriceHkd = Math.max(0, Number(formData.get("originalPriceHkd") ?? 0));
  const memberPriceHkd = Math.max(0, Number(formData.get("memberPriceHkd") ?? 0));
  const salePriceRaw = Number(formData.get("salePriceHkd") ?? 0);
  const requestedPricingMode = String(formData.get("pricingMode") ?? "member");
  const pricingMode: PricingMode = allowedPricingModes.has(requestedPricingMode as PricingMode)
    ? (requestedPricingMode as PricingMode)
    : "member";
  const active = formData.get("active") === "on";

  await updateProductPricing({
    sku,
    originalPriceHkd,
    memberPriceHkd,
    salePriceHkd: salePriceRaw > 0 ? salePriceRaw : null,
    pricingMode,
    active,
  });

  return NextResponse.redirect(new URL("/admin?status=pricing-saved", url.origin), { status: 303 });
}
