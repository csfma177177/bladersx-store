import { NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/admin-auth";
import { updateOrderAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const allowedFulfillmentStatuses = new Set(["pending", "processing", "shipped", "completed"]);

export async function POST(request: Request) {
  const url = new URL(request.url);
  if (!(await hasAdminSession())) {
    return NextResponse.redirect(new URL("/admin/login?error=invalid", url.origin), { status: 303 });
  }

  const formData = await request.formData();
  const id = String(formData.get("id") ?? "");
  const requestedStatus = String(formData.get("fulfillmentStatus") ?? "pending");
  const fulfillmentStatus = allowedFulfillmentStatuses.has(requestedStatus) ? requestedStatus : "pending";
  const adminNotes = String(formData.get("adminNotes") ?? "").trim();

  await updateOrderAdmin({ id, fulfillmentStatus, adminNotes });
  return NextResponse.redirect(new URL("/admin?status=order-saved", url.origin), { status: 303 });
}
