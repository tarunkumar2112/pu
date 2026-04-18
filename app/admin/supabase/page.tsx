"use client";

import { useCallback, useEffect, useState } from "react";
import { TreezProduct, getTreezProductListId, normalizeTreezProductId } from "@/lib/treez";

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
  const [findingMissing, setFindingMissing] = useState(false);
  const [missingResult, setMissingResult] = useState<string | null>(null);
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

  const toPriceNumber = (product: TreezProduct): number => {
    const pricing = product.pricing as { price_sell?: number; tier_pricing_detail?: Array<{ price_per_value?: number }> } | undefined;
    const val = pricing?.price_sell ?? pricing?.tier_pricing_detail?.[0]?.price_per_value ?? product.price ?? product.retailPrice ?? 0;
    const n = Number(val);
    return Number.isFinite(n) ? n : 0;
  };

  const findMissingAndUpload = async () => {
    setFindingMissing(true);
    setMissingResult(null);
    setError(null);
    try {
      const [treezRes, supabaseRes] = await Promise.all([
        fetch("/api/products/by-location?location=FRONT%20OF%20HOUSE"),
        fetch("/api/products/sync-snapshot"),
      ]);

      const treezData = await treezRes.json();
      const supabaseData = await supabaseRes.json();

      if (!treezRes.ok) throw new Error(treezData.error || "Failed to load Treez products");
      if (!supabaseRes.ok || supabaseData.success === false) throw new Error(supabaseData.error || "Failed to load Supabase snapshots");

      const treezProducts: TreezProduct[] = Array.isArray(treezData.products) ? treezData.products : [];
      const existing = new Set<string>();
      const snapshots: SnapshotRow[] = Array.isArray(supabaseData.snapshots) ? supabaseData.snapshots : [];
      snapshots.forEach((row) => {
        const id = normalizeTreezProductId(row.treez_product_id);
        if (id) existing.add(id);
      });

      const missingProducts = treezProducts.filter((product) => {
        const uuid = normalizeTreezProductId(getTreezProductListId(product));
        return uuid && !existing.has(uuid);
      });

      if (missingProducts.length === 0) {
        setMissingResult("No missing products found. Supabase is up to date.");
        await loadRows();
        return;
      }

      let uploaded = 0;
      let failed = 0;

      for (const product of missingProducts) {
        const treezUuid = getTreezProductListId(product);
        const cfg = product.product_configurable_fields as Record<string, unknown> | undefined;
        const snapshot = {
          treez_product_id: treezUuid,
          opticon_barcode: treezUuid,
          product_name: String(cfg?.name ?? product.name ?? product.productName ?? ""),
          category: String(product.category_type ?? product.category ?? ""),
          price: toPriceNumber(product),
          size: String(cfg?.size ?? ""),
          unit: String(cfg?.size_unit ?? "EA"),
          raw_data: product,
        };

        try {
          const uploadRes = await fetch("/api/products/upload-snapshot", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ snapshot }),
          });
          const uploadData = await uploadRes.json();
          if (!uploadRes.ok || uploadData.success === false) failed += 1;
          else uploaded += 1;
        } catch {
          failed += 1;
        }
      }

      setMissingResult(`Missing found: ${missingProducts.length}. Uploaded: ${uploaded}. Failed: ${failed}.`);
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to find/upload missing products");
    } finally {
      setFindingMissing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-zinc-900">Supabase Snapshots</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={findMissingAndUpload}
            disabled={loading || findingMissing}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition disabled:opacity-50 hover:bg-zinc-50"
          >
            {findingMissing ? "Finding missing..." : "Find Missing + Upload"}
          </button>
          <button
            onClick={loadRows}
            disabled={loading || findingMissing}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50 hover:opacity-90"
            style={{ backgroundColor: BRAND_BLUE }}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {missingResult ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{missingResult}</div>
      ) : null}

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
