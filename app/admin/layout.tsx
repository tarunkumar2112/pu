"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const BRAND_BLUE = "#1F2B44";
const LOGO_URL = "https://cdn.prod.website-files.com/67ee6c6b271e5a2294abc43e/6814932c8fdab74d7cd6845d_Group%201577708998.webp";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: "◉" },
  { href: "/admin/treez", label: "Treez Products", icon: "▸" },
  { href: "/admin/treez/mapping", label: "Product Mapping", icon: "⚡" },
  { href: "/admin/opticon", label: "Opticon Products", icon: "▸" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-zinc-50">
      <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-zinc-200 bg-white shadow-sm">
        <div className="flex h-16 items-center gap-3 border-b border-zinc-200 px-6">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src={LOGO_URL}
              alt="Perfect Union"
              width={120}
              height={36}
              className="h-9 w-auto object-contain"
              unoptimized
            />
          </Link>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-zinc-100 text-zinc-900"
                    : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                }`}
              >
                <span className="text-base opacity-70">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-zinc-200 px-4 py-3">
          <p className="text-xs text-zinc-500">Product Sync Admin</p>
          <p className="text-xs text-zinc-400">Treez → Opticon</p>
        </div>
      </aside>
      <main className="ml-64 flex-1 p-8">{children}</main>
    </div>
  );
}
