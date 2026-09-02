import { NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/admin-auth";
import { applyPaidOrderInventory, deleteOrderById, getOrderById, updateOrderAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const allowedFulfillmentStatuses = new Set(["pending", "processing", "shipped", "completed"]);

export async function POST(request: Request) {
  const url = new URL(request.url);
  if (!(await hasAdminSession())) {
    return NextResponse.redirect(new URL("/admin/login?error=invalid", url.origin), { status: 303 });
  }

  const formData = await request.formData();
  const id = String(formData.get("id") ?? "");
  const intent = String(formData.get("intent") ?? "update");
  const requestedStatus = String(formData.get("fulfillmentStatus") ?? "pending");
  const fulfillmentStatus = allowedFulfillmentStatuses.has(requestedStatus) ? requestedStatus : "pending";
  const adminNotes = String(formData.get("adminNotes") ?? "").trim();
  const markPaid = formData.get("markPaid") === "true";

  const existingOrder = await getOrderById(id);
  if (!existingOrder) {
    return NextResponse.redirect(new URL("/admin?status=order-missing", url.origin), { status: 303 });
  }

  if (intent === "delete") {
    if (formData.get("confirmDelete") !== "true") {
      return NextResponse.redirect(new URL("/admin?status=delete-not-confirmed", url.origin), { status: 303 });
    }

    await deleteOrderById(id);
    return NextResponse.redirect(new URL("/admin?status=order-deleted", url.origin), { status: 303 });
  }

  const nextPaymentStatus = markPaid ? "paid" : existingOrder.status;

  await updateOrderAdmin({
    id,
    fulfillmentStatus,
    adminNotes,
    paymentStatus: nextPaymentStatus,
    paidAt: nextPaymentStatus === "paid" && existingOrder.status !== "paid" ? new Date().toISOString() : existingOrder.paid_at,
  });

  if (existingOrder.status !== "paid" && nextPaymentStatus === "paid" && Array.isArray(existingOrder.items)) {
    await applyPaidOrderInventory(
      existingOrder.items
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const entry = item as { sku?: string; size?: string; quantity?: number };
          if (
            (entry.sku !== "BX-MUT-01" && entry.sku !== "BX-MUT-02")
            || !entry.size
            || typeof entry.quantity !== "number"
            || entry.quantity <= 0
          ) {
            return null;
          }

          return {
            sku: entry.sku,
            size: entry.size as "XXS" | "XS" | "S" | "M" | "L" | "XL" | "2XL" | "3XL",
            quantity: entry.quantity,
          };
        })
        .filter((item): item is { sku: "BX-MUT-01" | "BX-MUT-02"; size: "XXS" | "XS" | "S" | "M" | "L" | "XL" | "2XL" | "3XL"; quantity: number } => Boolean(item)),
    );
  }

  return NextResponse.redirect(new URL("/admin?status=order-saved", url.origin), { status: 303 });
}
