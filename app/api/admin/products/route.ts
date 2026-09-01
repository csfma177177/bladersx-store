import { NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/admin-auth";
import { type PricingMode, updateProductPricing } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const allowedPricingModes = new Set<PricingMode>(["original", "member", "sale"]);

function parseOptionalPrice(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.max(0, parsed);
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  if (!(await hasAdminSession())) {
    return NextResponse.redirect(new URL("/admin/login?error=invalid", url.origin), { status: 303 });
  }

  const formData = await request.formData();
  const sku = String(formData.get("sku") ?? "");
  const originalPriceHkd = Math.max(0, Number(formData.get("originalPriceHkd") ?? 0));
  const memberPriceHkd = parseOptionalPrice(formData.get("memberPriceHkd"));
  const salePriceHkd = parseOptionalPrice(formData.get("salePriceHkd"));
  const requestedPricingMode = String(formData.get("pricingMode") ?? "original");
  const pricingMode: PricingMode = allowedPricingModes.has(requestedPricingMode as PricingMode)
    ? (requestedPricingMode as PricingMode)
    : "original";
  const active = formData.get("active") === "on";

  await updateProductPricing({
    sku,
    originalPriceHkd,
    memberPriceHkd,
    salePriceHkd,
    pricingMode,
    active,
  });

  return NextResponse.redirect(new URL("/admin?status=pricing-saved", url.origin), { status: 303 });
}
