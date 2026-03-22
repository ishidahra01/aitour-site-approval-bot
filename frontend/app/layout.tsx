import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Site Project Copilot",
  description: "Site Project Copilot powered by GitHub Copilot SDK and Work IQ — supports mobile base station installation projects with analysis, reporting, and project task outputs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
