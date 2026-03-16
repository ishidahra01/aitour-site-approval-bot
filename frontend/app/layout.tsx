import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Site Approval Bot | Work IQ × Copilot SDK",
  description: "NTTグループ 5G基地局設置計画 Site Approval Bot",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased bg-gray-950">
        {children}
      </body>
    </html>
  );
}
