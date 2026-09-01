import { redirect } from "next/navigation";
import { hasAdminSession } from "@/lib/admin-auth";
import {
  getEffectivePriceHkd,
  getEffectivePriceLabel,
  isSupabaseConfigured,
  listOrders,
  listProducts,
} from "@/lib/supabase-admin";
import styles from "./admin.module.css";

type AdminPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type InventoryItem = {
  sku: string;
  size: string;
  stock_quantity: number;
  active: boolean;
  updated_at?: string | null;
};

function money(value: number | null) {
  if (value == null) return "—";
  return `HK$${(value / 100).toLocaleString("en-HK")}`;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-HK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function orderItemsLabel(items: unknown) {
  if (!Array.isArray(items) || items.length === 0) return "未有商品資料";

  return items
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const entry = item as { product_name?: string; sku?: string; size?: string; quantity?: number };
      return `${entry.product_name ?? entry.sku ?? "ITEM"} / ${entry.size ?? "?"} × ${entry.quantity ?? 1}`;
    })
    .filter(Boolean)
    .join(" · ");
}

function groupVariants(sku: string, variants: InventoryItem[]) {
  const order = ["S", "M", "L", "XL", "2XL"];
  return variants
    .filter((variant) => variant.sku === sku)
    .sort((a, b) => order.indexOf(a.size) - order.indexOf(b.size));
}

function getBanner(status: string | undefined) {
  if (status === "inventory-saved") return "庫存已更新。";
  if (status === "order-saved") return "訂單資料已更新。";
  if (status === "order-missing") return "搵唔返該張訂單，可能已被移除。";
  if (status === "pricing-saved") return "產品定價已更新。";
  return null;
}

function paymentStatusLabel(status: string) {
  if (status === "paid") return "已付款";
  if (status === "checkout_created") return "待付款";
  if (status === "cancelled") return "已取消";
  if (status === "refunded") return "已退款";
  return status;
}

function fulfillmentStatusLabel(status: string) {
  if (status === "pending") return "待處理";
  if (status === "processing") return "處理中";
  if (status === "shipped") return "已出貨";
  if (status === "completed") return "已完成";
  return status;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  if (!(await hasAdminSession())) redirect("/admin/login");

  const params = await searchParams;
  const status = typeof params?.status === "string" ? params.status : undefined;
  const banner = getBanner(status);

  if (!isSupabaseConfigured()) {
    return (
      <main className={styles.shell}>
        <div className={styles.inner}>
          <div className={styles.topbar}>
            <div>
              <p className={styles.eyebrow}>BLADERS X ADMIN</p>
              <h1 className={styles.title}>後台已就位，等你接上 Supabase</h1>
              <p className={styles.copy}>
                我已經幫你整好 admin 結構。不過要真正管理庫存同訂單，你要先喺 Vercel 加返
                <code> SUPABASE_URL </code>
                同
                <code> SUPABASE_SERVICE_ROLE_KEY </code>。
              </p>
            </div>

            <form action="/api/admin/logout" method="post">
              <button className={styles.logout} type="submit">
                登出
              </button>
            </form>
          </div>

          <div className={styles.warning}>
            你而家未連上 Supabase，所以後台未能顯示實際庫存／訂單資料。下一步只要喺 Supabase 建 project，
            跑一次 schema，然後將環境變數加去 Vercel，就可以正式用。
          </div>
        </div>
      </main>
    );
  }

  let products;
  let variants;
  let orders;

  try {
    const result = await Promise.all([listProducts(), listOrders(40)]);
    products = result[0].products;
    variants = result[0].variants;
    orders = result[1];
  } catch {
    return (
      <main className={styles.shell}>
        <div className={styles.inner}>
          <div className={styles.topbar}>
            <div>
              <p className={styles.eyebrow}>BLADERS X ADMIN</p>
              <h1 className={styles.title}>請更新 Supabase schema</h1>
              <p className={styles.copy}>
                你個 project 已經連咗 Supabase，但資料表仲未升級到最新版本，所以定價／庫存後台未能正常讀取。
              </p>
            </div>

            <form action="/api/admin/logout" method="post">
              <button className={styles.logout} type="submit">
                登出
              </button>
            </form>
          </div>

          <div className={styles.warning}>
            請去 Supabase SQL Editor，重新執行最新嘅
            <code> store-demo/supabase/schema.sql </code>
            ，之後再 refresh 呢個 admin 頁面。
          </div>
        </div>
      </main>
    );
  }

  const activeProducts = products.filter((item) => item.active).length;
  const totalUnits = variants.reduce((sum, item) => sum + item.stock_quantity, 0);
  const paidOrders = orders.filter((item) => item.status === "paid").length;
  const pendingPayment = orders.filter((item) => item.status !== "paid" && item.status !== "cancelled").length;

  return (
    <main className={styles.shell}>
      <div className={styles.inner}>
        <div className={styles.topbar}>
          <div>
            <p className={styles.eyebrow}>BLADERS X ADMIN</p>
            <h1 className={styles.title}>Store Control Room</h1>
            <p className={styles.copy}>
              呢版俾 admin 同事直接睇庫存、更新尺碼存量，同埋跟進付款後訂單。第一版我先幫你將最實用嘅控制位做好。
            </p>
          </div>

          <form action="/api/admin/logout" method="post">
            <button className={styles.logout} type="submit">
              登出
            </button>
          </form>
        </div>

        {banner && <div className={styles.banner}>{banner}</div>}

        <section className={styles.stats}>
          <article className={styles.stat}>
            <p className={styles.statLabel}>Active products</p>
            <p className={styles.statValue}>{activeProducts}</p>
          </article>
          <article className={styles.stat}>
            <p className={styles.statLabel}>Units in stock</p>
            <p className={styles.statValue}>{totalUnits}</p>
          </article>
          <article className={styles.stat}>
            <p className={styles.statLabel}>Pending payment</p>
            <p className={styles.statValue}>{pendingPayment}</p>
          </article>
          <article className={styles.stat}>
            <p className={styles.statLabel}>Paid orders</p>
            <p className={styles.statValue}>{paidOrders}</p>
          </article>
        </section>

        <section className={styles.grid}>
          <article className={styles.card}>
            <h2 className={styles.cardTitle}>庫存管理</h2>
            <p className={styles.cardCopy}>
              每個顏色、每個尺碼可以獨立更新。你之後再加新產品，都可以沿用同一套表。
            </p>

            {products.map((product) => {
              const productVariants = groupVariants(product.sku, variants);
              return (
                <section key={product.sku} className={styles.inventoryProduct}>
                  <div className={styles.inventoryHeader}>
                    <div>
                      <h3 className={styles.productTitle}>{product.name}</h3>
                      <div className={styles.productMeta}>
                        {product.sku} · {product.colour} · 現時顯示 {money(getEffectivePriceHkd(product) * 100)} / {getEffectivePriceLabel(product) ?? "原價"}
                      </div>
                    </div>
                  </div>

                  <form className={styles.pricingPanel} action="/api/admin/products" method="post">
                    <input type="hidden" name="sku" value={product.sku} />

                    <label className={styles.field}>
                      原價
                      <input
                        className={styles.input}
                        type="number"
                        name="originalPriceHkd"
                        min="0"
                        defaultValue={product.original_price_hkd}
                        required
                      />
                    </label>

                    <label className={styles.field}>
                      會員價
                      <input
                        className={styles.input}
                        type="number"
                        name="memberPriceHkd"
                        min="0"
                        defaultValue={product.member_price_hkd ?? ""}
                        placeholder="留空代表唔顯示會員價"
                      />
                    </label>

                    <label className={styles.field}>
                      特價
                      <input
                        className={styles.input}
                        type="number"
                        name="salePriceHkd"
                        min="0"
                        defaultValue={product.sale_price_hkd ?? ""}
                        placeholder="留空或 0 代表未開特價"
                      />
                    </label>

                    <label className={styles.field}>
                      前台顯示售價
                      <select className={styles.select} name="pricingMode" defaultValue={product.pricing_mode}>
                        <option value="original">原價</option>
                        <option value="member">會員價</option>
                        <option value="sale">特價</option>
                      </select>
                    </label>

                    <label className={styles.checkboxRow}>
                      <input type="checkbox" name="active" defaultChecked={product.active} />
                      呢個產品上架中
                    </label>

                    <button className={styles.save} type="submit">
                      儲存產品定價
                    </button>
                  </form>

                  <div className={styles.variantGrid}>
                    {productVariants.map((variant) => (
                      <article key={`${variant.sku}-${variant.size}`} className={styles.variantCard}>
                        <div className={styles.variantTop}>
                          <span className={styles.sizeTag}>{variant.size}</span>
                          <span className={styles.productMeta}>
                            更新：{formatDate(variant.updated_at ?? null)}
                          </span>
                        </div>

                        <form className={styles.variantForm} action="/api/admin/inventory" method="post">
                          <input type="hidden" name="sku" value={variant.sku} />
                          <input type="hidden" name="size" value={variant.size} />

                          <label className={styles.field}>
                            現有庫存
                            <input
                              className={styles.input}
                              type="number"
                              name="stockQuantity"
                              min="0"
                              defaultValue={variant.stock_quantity}
                              required
                            />
                          </label>

                          <label className={styles.checkboxRow}>
                            <input type="checkbox" name="active" defaultChecked={variant.active} />
                            呢個尺碼可售
                          </label>

                          <button className={styles.save} type="submit">
                            儲存尺碼設定
                          </button>
                        </form>
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
          </article>

          <article className={styles.card}>
            <h2 className={styles.cardTitle}>訂單管理</h2>
            <p className={styles.cardCopy}>
              呢度會睇到待付款訂單、客人資料同尺碼組合。當你收到客人付款之後，可以直接喺度標記做「已付款」。
            </p>

            {orders.length === 0 ? (
              <div className={styles.empty}>暫時未有訂單。</div>
            ) : (
              <div className={styles.orders}>
                {orders.map((order) => (
                  <article key={order.id} className={styles.orderCard}>
                    <div className={styles.orderTop}>
                      <div>
                        <h3 className={styles.orderTitle}>
                          {order.customer_name || "未填姓名"} · {money(order.amount_total)}
                        </h3>
                        <div className={styles.orderMeta}>
                          {order.customer_email || "未有 email"} · {order.customer_phone || "未有電話"} · 建立於 {formatDate(order.created_at)}
                          {order.paid_at ? ` · 付款於 ${formatDate(order.paid_at)}` : ""}
                        </div>
                      </div>

                      <div className={styles.statusPills}>
                        <span className={styles.pill}>{paymentStatusLabel(order.status)}</span>
                        <span className={styles.pill}>{fulfillmentStatusLabel(order.fulfillment_status)}</span>
                      </div>
                    </div>

                    <div className={styles.orderItems}>{orderItemsLabel(order.items)}</div>

                    <form className={styles.variantForm} action="/api/admin/orders" method="post">
                      <input type="hidden" name="id" value={order.id} />

                      <label className={styles.field}>
                        Fulfillment 狀態
                        <select
                          className={styles.select}
                          name="fulfillmentStatus"
                          defaultValue={order.fulfillment_status || "pending"}
                        >
                          <option value="pending">pending</option>
                          <option value="processing">processing</option>
                          <option value="shipped">shipped</option>
                          <option value="completed">completed</option>
                        </select>
                      </label>

                      {order.status !== "paid" ? (
                        <label className={styles.checkboxRow}>
                          <input type="checkbox" name="markPaid" value="true" />
                          已收到付款，提交後標記為「已付款」
                        </label>
                      ) : (
                        <div className={styles.orderNote}>此訂單已付款；再次儲存只會更新備註同 fulfillment 狀態。</div>
                      )}

                      <label className={styles.field}>
                        Admin 備註
                        <textarea
                          className={styles.textarea}
                          name="adminNotes"
                          defaultValue={order.admin_notes ?? ""}
                          placeholder="例如：已 WhatsApp 聯絡、等補貨、已安排交收"
                        />
                      </label>

                      <button className={styles.save} type="submit">
                        更新訂單
                      </button>
                    </form>
                  </article>
                ))}
              </div>
            )}
          </article>
        </section>
      </div>
    </main>
  );
}
