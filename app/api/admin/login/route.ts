import { NextResponse } from "next/server";
import { getAdminCookieOptions, isAdminConfigured, verifyAdminSecret } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const password = String(formData.get("password") ?? "");
  const url = new URL(request.url);

  if (!isAdminConfigured()) {
    return NextResponse.redirect(new URL("/admin/login?error=config", url.origin), { status: 303 });
  }

  if (!verifyAdminSecret(password)) {
    return NextResponse.redirect(new URL("/admin/login?error=invalid", url.origin), { status: 303 });
  }

  const response = NextResponse.redirect(new URL("/admin", url.origin), { status: 303 });
  response.cookies.set(getAdminCookieOptions());
  return response;
}
