import type { Metadata } from "next";
import "./globals.css";

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
        {children}
      </body>
    </html>
  );
}
