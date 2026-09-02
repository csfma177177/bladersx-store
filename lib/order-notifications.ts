type OrderNotificationCustomer = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

type OrderNotificationItem = {
  sku: string;
  size: string;
  quantity: number;
  product_name: string;
  colour: string;
  unit_price_hkd: number;
};

type OrderNotificationInput = {
  orderReference: string;
  customer: OrderNotificationCustomer;
  items: OrderNotificationItem[];
  amountTotal: number;
};

const defaultNotificationEmail = "cs@fma-hk.com";
const defaultFromEmail = "BLADERS X Store <onboarding@resend.dev>";

function moneyFromCents(cents: number) {
  return `HK$${Math.round(cents / 100).toLocaleString("en-HK")}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderOrderLines(items: OrderNotificationItem[]) {
  return items
    .map((item) => {
      const lineTotal = item.unit_price_hkd * item.quantity;
      return `${item.product_name} / ${item.colour} / ${item.size} × ${item.quantity} — HK$${lineTotal.toLocaleString("en-HK")}`;
    })
    .join("\n");
}

function renderOrderHtml(input: OrderNotificationInput) {
  const rows = input.items
    .map((item) => {
      const lineTotal = item.unit_price_hkd * item.quantity;
      return `
        <tr>
          <td style="padding:12px;border-bottom:1px solid #1f2937;">${escapeHtml(item.product_name)}</td>
          <td style="padding:12px;border-bottom:1px solid #1f2937;">${escapeHtml(item.colour)}</td>
          <td style="padding:12px;border-bottom:1px solid #1f2937;text-align:center;">${escapeHtml(item.size)}</td>
          <td style="padding:12px;border-bottom:1px solid #1f2937;text-align:center;">${item.quantity}</td>
          <td style="padding:12px;border-bottom:1px solid #1f2937;text-align:right;">HK$${lineTotal.toLocaleString("en-HK")}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <div style="background:#070914;color:#eef3ff;font-family:Arial,Helvetica,sans-serif;padding:28px;">
      <div style="max-width:720px;margin:0 auto;border:1px solid #20304a;background:#0b1020;padding:28px;">
        <p style="margin:0 0 8px;color:#5bdcff;font-size:12px;font-weight:700;letter-spacing:2px;">BLADERS X LIVE TOURNAMENT HUB</p>
        <h1 style="margin:0 0 20px;font-size:28px;line-height:1.1;">New order received</h1>
        <p style="margin:0 0 24px;color:#aeb8cc;">Order reference: <strong style="color:#eef3ff;">${escapeHtml(input.orderReference)}</strong></p>

        <div style="margin-bottom:24px;padding:16px;background:#111827;border:1px solid #243047;">
          <p style="margin:0 0 8px;"><strong>Customer</strong></p>
          <p style="margin:0;color:#c8d1e5;">${escapeHtml(input.customer.firstName)} ${escapeHtml(input.customer.lastName)}</p>
          <p style="margin:4px 0 0;color:#c8d1e5;">${escapeHtml(input.customer.email)}</p>
          <p style="margin:4px 0 0;color:#c8d1e5;">${escapeHtml(input.customer.phone)}</p>
        </div>

        <table style="width:100%;border-collapse:collapse;background:#090d18;">
          <thead>
            <tr>
              <th style="padding:12px;border-bottom:1px solid #334155;text-align:left;color:#8fdfff;">Product</th>
              <th style="padding:12px;border-bottom:1px solid #334155;text-align:left;color:#8fdfff;">Colour</th>
              <th style="padding:12px;border-bottom:1px solid #334155;text-align:center;color:#8fdfff;">Size</th>
              <th style="padding:12px;border-bottom:1px solid #334155;text-align:center;color:#8fdfff;">Qty</th>
              <th style="padding:12px;border-bottom:1px solid #334155;text-align:right;color:#8fdfff;">Total</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <p style="margin:22px 0 0;text-align:right;font-size:22px;font-weight:800;">${moneyFromCents(input.amountTotal)}</p>
        <p style="margin:22px 0 0;color:#aeb8cc;">請 WhatsApp 客人確認付款；收到款項後可到 admin 後台標記為「已付款」。</p>
      </div>
    </div>
  `;
}

export async function sendOrderNotification(input: OrderNotificationInput) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { skipped: true };

  const to = process.env.ORDER_NOTIFICATION_EMAIL || defaultNotificationEmail;
  const from = process.env.ORDER_NOTIFICATION_FROM || defaultFromEmail;
  const customerName = `${input.customer.firstName} ${input.customer.lastName}`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: `[BLADERS X] New order ${input.orderReference} — ${customerName}`,
      text: [
        "BLADERS X LIVE TOURNAMENT HUB",
        "",
        `Order reference: ${input.orderReference}`,
        `Customer: ${customerName}`,
        `Email: ${input.customer.email}`,
        `Phone: ${input.customer.phone}`,
        "",
        renderOrderLines(input.items),
        "",
        `Order total: ${moneyFromCents(input.amountTotal)}`,
        "",
        "請 WhatsApp 客人確認付款；收到款項後可到 admin 後台標記為「已付款」。",
      ].join("\n"),
      html: renderOrderHtml(input),
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Order notification failed: ${response.status} ${detail}`);
  }

  return { skipped: false };
}
