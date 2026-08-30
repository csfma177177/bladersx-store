import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BLADERS X — Member Utility System",
  description:
    "Official Member utility T-shirts engineered for tournament loadouts and street culture.",
  icons: {
    icon: "/assets/bladers-x-live-logo.png",
    shortcut: "/assets/bladers-x-live-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
