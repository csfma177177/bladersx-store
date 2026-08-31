import { NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/admin-auth";
import { updateProductVariant } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const url = new URL(request.url);
  if (!(await hasAdminSession())) {
    return NextResponse.redirect(new URL("/admin/login?error=invalid", url.origin), { status: 303 });
  }

  const formData = await request.formData();
  const sku = String(formData.get("sku") ?? "");
  const size = String(formData.get("size") ?? "");
  const stockQuantity = Math.max(0, Number(formData.get("stockQuantity") ?? 0));
  const active = formData.get("active") === "on";

  await updateProductVariant({ sku, size, stockQuantity, active });
  return NextResponse.redirect(new URL("/admin?status=inventory-saved", url.origin), { status: 303 });
}
