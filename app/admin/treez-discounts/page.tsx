"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type DiscountRow = {
  treezProductId: string;
  productName: string;
  brand: string;
  discountName: string;
  discountType: string;
  discountValue: string;
  startsAt: string;
  endsAt: string;
};

type DiscountsPayload = {
  totalProductsScanned: number;
  totalDiscountRows: number;
  brandCounts: Record<string, number>;
  discounts: DiscountRow[];
};

const BRAND_BLUE = "#1F2B44";

export default function TreezDiscountsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<DiscountsPayload | null>(null);
  const [brandFilter, setBrandFilter] = useState("ALL");

  const loadDiscounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/treez/discounts");
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.error || "Failed to load Treez discounts");
      setPayload({
        totalProductsScanned: Number(data.totalProductsScanned ?? 0),
        totalDiscountRows: Number(data.totalDiscountRows ?? 0),
        brandCounts: (data.brandCounts ?? {}) as Record<string, number>,
        discounts: Array.isArray(data.discounts) ? (data.discounts as DiscountRow[]) : [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Treez discounts");
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDiscounts();
  }, [loadDiscounts]);

  const brands = useMemo(() => {
    if (!payload) return [];
    return Object.entries(payload.brandCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([brand]) => brand);
  }, [payload]);

  const filteredRows = useMemo(() => {
    if (!payload) return [];
    if (brandFilter === "ALL") return payload.discounts;
    return payload.discounts.filter((row) => (row.brand || "Unbranded") === brandFilter);
  }, [payload, brandFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-zinc-900">Treez Discounts</h1>
        <button
          onClick={loadDiscounts}
          disabled={loading}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50 hover:opacity-90"
          style={{ backgroundColor: BRAND_BLUE }}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {payload ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-xs text-zinc-500">Products scanned</p>
            <p className="mt-1 text-2xl font-bold text-zinc-900">{payload.totalProductsScanned.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-xs text-zinc-500">Discount rows found</p>
            <p className="mt-1 text-2xl font-bold text-zinc-900">{payload.totalDiscountRows.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-xs text-zinc-500">Brands with discounts</p>
            <p className="mt-1 text-2xl font-bold text-zinc-900">{brands.length.toLocaleString()}</p>
          </div>
        </div>
      ) : null}

      <div className="max-w-sm">
        <label className="mb-1 block text-sm font-medium text-zinc-700">Filter by brand</label>
        <select
          value={brandFilter}
          onChange={(e) => setBrandFilter(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
        >
          <option value="ALL">All Brands</option>
          {brands.map((brand) => (
            <option key={brand} value={brand}>
              {brand} ({payload?.brandCounts[brand] ?? 0})
            </option>
          ))}
        </select>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        {loading ? (
          <div className="py-20 text-center text-zinc-500">Fetching Treez discounts...</div>
        ) : filteredRows.length === 0 ? (
          <div className="py-20 text-center text-zinc-500">No discounts found for selected brand.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <th className="px-3 py-3 font-medium text-zinc-900">Brand</th>
                  <th className="px-3 py-3 font-medium text-zinc-900">Product</th>
                  <th className="px-3 py-3 font-medium text-zinc-900">Treez UUID</th>
                  <th className="px-3 py-3 font-medium text-zinc-900">Discount</th>
                  <th className="px-3 py-3 font-medium text-zinc-900">Type</th>
                  <th className="px-3 py-3 font-medium text-zinc-900">Value</th>
                  <th className="px-3 py-3 font-medium text-zinc-900">Start</th>
                  <th className="px-3 py-3 font-medium text-zinc-900">End</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, i) => (
                  <tr key={`${row.treezProductId}-${row.discountName}-${i}`} className="border-b border-zinc-100">
                    <td className="px-3 py-2 text-zinc-700">{row.brand || "Unbranded"}</td>
                    <td className="max-w-[280px] truncate px-3 py-2 text-zinc-700" title={row.productName}>
                      {row.productName || "-"}
                    </td>
                    <td className="max-w-[240px] truncate px-3 py-2 font-mono text-xs text-zinc-600" title={row.treezProductId}>
                      {row.treezProductId || "-"}
                    </td>
                    <td className="px-3 py-2 text-zinc-700">{row.discountName || "-"}</td>
                    <td className="px-3 py-2 text-zinc-600">{row.discountType || "-"}</td>
                    <td className="px-3 py-2 text-zinc-600">{row.discountValue || "-"}</td>
                    <td className="px-3 py-2 text-zinc-500">{row.startsAt || "-"}</td>
                    <td className="px-3 py-2 text-zinc-500">{row.endsAt || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
