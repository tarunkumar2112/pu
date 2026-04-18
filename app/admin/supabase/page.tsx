"use client";

import { useCallback, useEffect, useState } from "react";

type SnapshotRow = {
  id?: string;
  treez_product_id?: string;
  opticon_barcode?: string;
  product_name?: string;
  category?: string;
  price?: number;
  size?: string;
  unit?: string;
  updated_at?: string;
};

const BRAND_BLUE = "#1F2B44";

export default function SupabaseTablePage() {
  const [rows, setRows] = useState<SnapshotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/products/sync-snapshot");
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.error || "Failed to load Supabase snapshots");
      setRows(Array.isArray(data.snapshots) ? data.snapshots : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Supabase snapshots");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-zinc-900">Supabase Snapshots</h1>
        <button
          onClick={loadRows}
          disabled={loading}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50 hover:opacity-90"
          style={{ backgroundColor: BRAND_BLUE }}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        {loading ? (
          <div className="py-20 text-center text-zinc-500">Loading Supabase rows...</div>
        ) : rows.length === 0 ? (
          <div className="py-20 text-center text-zinc-500">No snapshot rows found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <th className="px-3 py-3 font-medium text-zinc-900">Treez ID</th>
                  <th className="px-3 py-3 font-medium text-zinc-900">Barcode</th>
                  <th className="px-3 py-3 font-medium text-zinc-900">Product</th>
                  <th className="px-3 py-3 font-medium text-zinc-900">Category</th>
                  <th className="px-3 py-3 font-medium text-zinc-900">Price</th>
                  <th className="px-3 py-3 font-medium text-zinc-900">Updated</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={`${row.treez_product_id || "row"}-${i}`} className="border-b border-zinc-100">
                    <td className="px-3 py-2 font-mono text-xs text-zinc-700">{row.treez_product_id ?? "-"}</td>
                    <td className="px-3 py-2 font-mono text-xs text-zinc-600">{row.opticon_barcode ?? "-"}</td>
                    <td className="px-3 py-2 text-zinc-700">{row.product_name ?? "-"}</td>
                    <td className="px-3 py-2 text-zinc-600">{row.category ?? "-"}</td>
                    <td className="px-3 py-2 text-zinc-600">{row.price ?? "-"}</td>
                    <td className="px-3 py-2 text-zinc-500">
                      {row.updated_at ? new Date(row.updated_at).toLocaleString() : "-"}
                    </td>
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
