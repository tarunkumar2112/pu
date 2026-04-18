"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Zap, CircleUser, Database, Smartphone, Package, Percent } from "lucide-react";

const BRAND_BLUE = "#1F2B44";
const LOGO_URL = "https://cdn.prod.website-files.com/67ee6c6b271e5a2294abc43e/6814932c8fdab74d7cd6845d_Group%201577708998.webp";

const navItems = [
  { href: "/admin/middleware", label: "Sync Middleware", icon: Zap, group: "main", highlight: true },
  { href: "/admin/treez-location", label: "Treez Table", icon: Package, group: "tables" },
  { href: "/admin/treez-discounts", label: "Treez Discounts", icon: Percent, group: "tables" },
  { href: "/admin/opticon", label: "Opticon Table", icon: Smartphone, group: "tables" },
  { href: "/admin/supabase", label: "Supabase Table", icon: Database, group: "tables" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const groupLabels: Record<string, string> = {
    main: "Main",
    tables: "Tables",
  };

  const groupedItems = navItems.reduce((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {} as Record<string, typeof navItems>);

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100">
      <aside className="fixed left-0 top-0 z-40 flex h-screen w-72 flex-col border-r border-zinc-200 bg-white shadow-xl">
        {/* Logo */}
        <div className="flex h-20 items-center gap-3 border-b border-zinc-200 px-6 bg-gradient-to-r from-zinc-50 to-white">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src={LOGO_URL}
              alt="Perfect Union"
              width={140}
              height={42}
              className="h-10 w-auto object-contain"
              unoptimized
            />
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
          {Object.entries(groupedItems).map(([group, items]) => (
            <div key={group}>
              <p className="px-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                {groupLabels[group] || group}
              </p>
              <div className="space-y-1">
                {items.map((item) => {
                  const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                        isActive
                          ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30"
                          : item.highlight
                            ? "bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-700 border border-emerald-200 hover:from-emerald-100 hover:to-emerald-200"
                            : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${isActive ? 'opacity-100' : 'opacity-70'}`} />
                      <span>{item.label}</span>
                      {item.highlight && !isActive && (
                        <span className="ml-auto text-xs font-semibold text-emerald-600 bg-emerald-200 px-2 py-0.5 rounded-full">
                          NEW
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-zinc-200 bg-gradient-to-r from-zinc-50 to-white px-4 py-4">
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white">
              <CircleUser className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-zinc-900">Perfect Union</p>
              <p className="text-xs text-zinc-500">Sync Middleware</p>
            </div>
          </div>
        </div>
      </aside>
      <main className="ml-72 flex-1 p-8">{children}</main>
    </div>
  );
}
