import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Teklif Masası",
  description: "Sigorta tekliflerini tek merkezde topla ve takip et.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
