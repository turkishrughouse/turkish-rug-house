import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner"
import { ensureCacheCleanerStarted } from "@/lib/cache-maintenance"

export const metadata: Metadata = {
  title: "RugHouse",
  description: "Premium Rugs & Textiles",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  ensureCacheCleanerStarted()

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="antialiased"
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
