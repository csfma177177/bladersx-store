import { createHash, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE_NAME = "bx_admin_session";

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function getAdminSecret() {
  return process.env.ADMIN_ACCESS_TOKEN ?? process.env.ADMIN_PASSWORD ?? "";
}

export function isAdminConfigured() {
  return getAdminSecret().length > 0;
}

export function verifyAdminSecret(candidate: string) {
  const secret = getAdminSecret();
  if (!secret) return false;

  const expected = Buffer.from(digest(secret), "hex");
  const received = Buffer.from(digest(candidate), "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function getAdminSessionValue() {
  const secret = getAdminSecret();
  return secret ? digest(secret) : "";
}

export function getAdminCookieOptions() {
  return {
    name: ADMIN_COOKIE_NAME,
    value: getAdminSessionValue(),
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  };
}

export async function hasAdminSession() {
  if (!isAdminConfigured()) return false;

  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!session) return false;

  const expected = Buffer.from(getAdminSessionValue(), "hex");
  const received = Buffer.from(session, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}
