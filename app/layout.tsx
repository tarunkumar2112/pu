import type { Metadata } from "next";
import "./globals.css";
import { BackgroundMonitorInit } from "@/components/BackgroundMonitorInit";

export const metadata: Metadata = {
  title: "Perfect Union | Product Sync Admin",
  description: "Sync Treez products to Opticon ESL labels",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="antialiased"
        suppressHydrationWarning
      >
        <BackgroundMonitorInit />
        {children}
      </body>
    </html>
  );
}
