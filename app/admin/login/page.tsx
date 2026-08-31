import { redirect } from "next/navigation";
import { hasAdminSession, isAdminConfigured } from "@/lib/admin-auth";
import styles from "./login.module.css";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getMessage(error: string | undefined) {
  if (error === "invalid") return "登入資料唔正確，請再試一次。";
  if (error === "config") return "Admin token 未設定，請先喺 Vercel environment variables 加入。";
  return null;
}

export default async function AdminLoginPage({ searchParams }: LoginPageProps) {
  if (await hasAdminSession()) redirect("/admin");

  const params = await searchParams;
  const error = typeof params?.error === "string" ? params.error : undefined;
  const message = getMessage(error);

  return (
    <main className={styles.shell}>
      <section className={styles.panel}>
        <p className={styles.eyebrow}>BLADERS X ADMIN</p>
        <h1 className={styles.title}>後台登入</h1>
        <p className={styles.copy}>
          呢度俾你管理庫存、訂單同產品狀態。第一版用一個 admin token 登入，之後我哋可以再升級做正式角色權限。
        </p>

        {!isAdminConfigured() && (
          <div className={styles.alert}>
            未見到 <code>ADMIN_ACCESS_TOKEN</code>。你 set 完之後，呢個登入頁就會正式可用。
          </div>
        )}

        {message && <div className={styles.alert}>{message}</div>}

        <form className={styles.form} action="/api/admin/login" method="post">
          <label className={styles.label}>
            Admin token
            <input
              className={styles.input}
              name="password"
              type="password"
              placeholder="輸入你嘅後台 token"
              autoComplete="current-password"
              required
            />
          </label>
          <button className={styles.button} type="submit">
            進入後台
          </button>
        </form>

        <p className={styles.help}>
          建議你喺 Vercel 設定一個長啲、難估啲嘅 token，例如 20–32 個字元。
        </p>
      </section>
    </main>
  );
}
