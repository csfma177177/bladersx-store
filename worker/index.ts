/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB?: D1Database;
  STRIPE_SECRET_KEY?: string;
  STRIPE_PRICE_BLACK?: string;
  STRIPE_PRICE_NAVY?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

type CheckoutItem = {
  sku: "BX-MUT-01" | "BX-MUT-02";
  size: string;
  quantity: number;
};

async function createCheckoutSession(request: Request, env: Env): Promise<Response> {
  const headers = { "content-type": "application/json; charset=utf-8" };

  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRICE_BLACK || !env.STRIPE_PRICE_NAVY) {
    return new Response(
      JSON.stringify({ error: "Stripe is not configured yet." }),
      { status: 503, headers },
    );
  }

  let payload: { items?: CheckoutItem[] };
  try {
    payload = await request.json() as { items?: CheckoutItem[] };
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON payload." }), { status: 400, headers });
  }

  if (!Array.isArray(payload.items) || payload.items.length === 0 || payload.items.length > 10) {
    return new Response(JSON.stringify({ error: "A valid cart is required." }), { status: 400, headers });
  }

  const priceMap: Record<CheckoutItem["sku"], string> = {
    "BX-MUT-01": env.STRIPE_PRICE_BLACK,
    "BX-MUT-02": env.STRIPE_PRICE_NAVY,
  };
  const allowedSizes = new Set(["XXS", "XS", "S", "M", "L", "XL", "2XL", "3XL"]);
  const params = new URLSearchParams();
  const origin = new URL(request.url).origin;

  for (const [index, item] of payload.items.entries()) {
    const quantity = Math.max(1, Math.min(5, Number(item.quantity) || 1));
    if (!priceMap[item.sku] || !allowedSizes.has(item.size)) {
      return new Response(JSON.stringify({ error: "Invalid product configuration." }), { status: 400, headers });
    }
    params.append(`line_items[${index}][price]`, priceMap[item.sku]);
    params.append(`line_items[${index}][quantity]`, String(quantity));
    params.append(`metadata[item_${index}_size]`, item.size);
    params.append(`metadata[item_${index}_sku]`, item.sku);
  }

  params.append("mode", "payment");
  params.append("success_url", `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`);
  params.append("cancel_url", `${origin}/?checkout=cancelled`);
  params.append("client_reference_id", `bx-${crypto.randomUUID()}`);
  params.append("billing_address_collection", "auto");
  params.append("phone_number_collection[enabled]", "true");
  params.append("shipping_address_collection[allowed_countries][0]", "HK");
  params.append("metadata[store]", "BLADERS X LIVE TOURNAMENT HUB");

  const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  const stripeData = await stripeResponse.json() as { url?: string; error?: { message?: string } };

  if (!stripeResponse.ok || !stripeData.url) {
    return new Response(
      JSON.stringify({ error: stripeData.error?.message || "Stripe Checkout could not be created." }),
      { status: 502, headers },
    );
  }

  return new Response(JSON.stringify({ url: stripeData.url }), { status: 200, headers });
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/create-checkout-session") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed." }), {
          status: 405,
          headers: { "content-type": "application/json; charset=utf-8", allow: "POST" },
        });
      }
      return createCheckoutSession(request, env);
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
