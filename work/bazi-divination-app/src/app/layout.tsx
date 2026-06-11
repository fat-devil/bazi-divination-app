import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "八字占卜排盘",
  description: "面向普通用户的八字排盘与通俗解读工具",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
