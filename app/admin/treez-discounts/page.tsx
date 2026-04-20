"use client";

import { useCallback, useState } from "react";
import { getTreezProductListId, type TreezProduct } from "@/lib/treez";

const BRAND_BLUE = "#1F2B44";

type PreviewLine = {
  inventory_id: string;
  quantity: number;
};

type PreviewItemResult = {
  inventory_id: string;
  base_price: number;
  final_price: number;
  discount_amount: number;
  discount_percent: number;
};

type PreviewData = {
  items: PreviewItemResult[];
  total_discount: number;
  total_price: number;
};

export default function TreezDiscountsPage() {
  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState<PreviewLine[]>([{ inventory_id: "", quantity: 1 }]);
  const [loading, setLoading] = useState(false);
  const [fohLoading, setFohLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PreviewData | null>(null);
  const [cached, setCached] = useState(false);
  const [fohProducts, setFohProducts] = useState<TreezProduct[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const addLine = () => setLines((prev) => [...prev, { inventory_id: "", quantity: 1 }]);
  const removeLine = (index: number) =>
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));

  const updateLine = (index: number, patch: Partial<PreviewLine>) => {
    setLines((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const loadFohProducts = useCallback(async () => {
    setFohLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/products/by-location?location=FRONT%20OF%20HOUSE");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load FOH products");
      const list = Array.isArray(data.products) ? (data.products as TreezProduct[]) : [];
      setFohProducts(list);
      setSelectedIds(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load FOH products");
      setFohProducts([]);
    } finally {
      setFohLoading(false);
    }
  }, []);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addSelectedToCart = () => {
    const toAdd: PreviewLine[] = [];
    fohProducts.forEach((p) => {
      const id = getTreezProductListId(p);
      if (!id || !selectedIds.has(id)) return;
      toAdd.push({ inventory_id: id, quantity: 1 });
    });
    if (toAdd.length === 0) return;
    setLines((prev) => {
      const base = prev.filter((r) => r.inventory_id.trim() !== "");
      const merged = base.length === 0 && prev.length === 1 && !prev[0].inventory_id.trim() ? [] : base;
      return [...merged, ...toAdd];
    });
    setSelectedIds(new Set());
  };

  const runPreview = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setCached(false);
    try {
      const items = lines
        .map((l) => ({
          inventory_id: l.inventory_id.trim(),
          quantity: Math.max(1, Math.floor(Number(l.quantity)) || 1),
        }))
        .filter((l) => l.inventory_id);

      if (!customerId.trim()) {
        setError("customer_id is required.");
        setLoading(false);
        return;
      }
      if (items.length === 0) {
        setError("Add at least one line with inventory_id (Treez product UUID).");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/cart/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: customerId.trim(), items }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.error || `Preview failed (${res.status})`);
      }
      setResult(data.data as PreviewData);
      setCached(Boolean(data.cached));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Cart preview (discounts)</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Uses Treez <code className="rounded bg-zinc-100 px-1 text-xs">POST …/tickets/preview</code> via{" "}
          <code className="rounded bg-zinc-100 px-1 text-xs">POST /api/cart/preview</code>. Product list API is not used
          for discount math.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Preview request</h2>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Customer ID</label>
            <input
              type="text"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              placeholder="Treez customer UUID"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-sm"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-700">Line items</span>
              <button
                type="button"
                onClick={addLine}
                className="text-sm font-medium text-zinc-600 underline hover:text-zinc-900"
              >
                + Add line
              </button>
            </div>
            {lines.map((line, i) => (
              <div key={i} className="flex flex-wrap items-end gap-2">
                <div className="min-w-0 flex-1">
                  <label className="mb-1 block text-xs text-zinc-500">inventory_id</label>
                  <input
                    type="text"
                    value={line.inventory_id}
                    onChange={(e) => updateLine(i, { inventory_id: e.target.value })}
                    placeholder="Treez product UUID"
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-xs"
                  />
                </div>
                <div className="w-24">
                  <label className="mb-1 block text-xs text-zinc-500">qty</label>
                  <input
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(e) => updateLine(i, { quantity: parseInt(e.target.value, 10) || 1 })}
                    className="w-full rounded-lg border border-zinc-300 px-2 py-2 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeLine(i)}
                  disabled={lines.length <= 1}
                  className="rounded-lg border border-zinc-200 px-2 py-2 text-xs text-zinc-500 hover:bg-zinc-50 disabled:opacity-40"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={runPreview}
            disabled={loading}
            className="w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white transition disabled:opacity-50 hover:opacity-90"
            style={{ backgroundColor: BRAND_BLUE }}
          >
            {loading ? "Running preview…" : "Run preview"}
          </button>
        </div>

        <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-zinc-900">Quick fill (FOH)</h2>
            <button
              type="button"
              onClick={loadFohProducts}
              disabled={fohLoading}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              {fohLoading ? "Loading…" : "Load FOH catalog"}
            </button>
          </div>
          <p className="text-xs text-zinc-500">
            Select products, then add them as preview lines (qty 1). Adjust quantities in the left panel.
          </p>
          {fohProducts.length > 0 ? (
            <>
              <div className="max-h-64 overflow-y-auto rounded-lg border border-zinc-100">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-zinc-50">
                    <tr>
                      <th className="w-8 px-2 py-2" />
                      <th className="px-2 py-2">Name</th>
                      <th className="px-2 py-2 font-mono">UUID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fohProducts.slice(0, 200).map((p) => {
                      const id = getTreezProductListId(p);
                      const name =
                        (p.product_configurable_fields as { name?: string } | undefined)?.name ??
                        p.name ??
                        p.productName ??
                        "—";
                      if (!id) return null;
                      return (
                        <tr key={id} className="border-t border-zinc-100">
                          <td className="px-2 py-1">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(id)}
                              onChange={() => toggleSelect(id)}
                              className="h-3.5 w-3.5 rounded border-zinc-300"
                            />
                          </td>
                          <td className="max-w-[140px] truncate px-2 py-1 text-zinc-700" title={String(name)}>
                            {String(name)}
                          </td>
                          <td className="truncate px-2 py-1 font-mono text-[10px] text-zinc-500" title={id}>
                            {id}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {fohProducts.length > 200 ? (
                <p className="text-xs text-amber-700">Showing first 200 of {fohProducts.length}. Search/filter can be added later.</p>
              ) : null}
              <button
                type="button"
                onClick={addSelectedToCart}
                disabled={selectedIds.size === 0}
                className="w-full rounded-lg border border-zinc-300 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
              >
                Add selected to cart ({selectedIds.size})
              </button>
            </>
          ) : (
            <p className="text-sm text-zinc-400">Load FOH catalog to pick inventory IDs.</p>
          )}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
      ) : null}

      {result ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
              total_discount: ${result.total_discount.toFixed(2)}
            </span>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800">
              total_price: ${result.total_price.toFixed(2)}
            </span>
            {cached ? (
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-600">cached response</span>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-3 py-3 font-medium text-zinc-900">inventory_id</th>
                    <th className="px-3 py-3 font-medium text-zinc-900">base_price</th>
                    <th className="px-3 py-3 font-medium text-zinc-900">final_price</th>
                    <th className="px-3 py-3 font-medium text-zinc-900">discount_amount</th>
                    <th className="px-3 py-3 font-medium text-zinc-900">discount_percent</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((row, i) => (
                    <tr key={`${row.inventory_id}-${i}`} className="border-b border-zinc-100">
                      <td className="max-w-[280px] truncate px-3 py-2 font-mono text-xs text-zinc-800" title={row.inventory_id}>
                        {row.inventory_id || "—"}
                      </td>
                      <td className="px-3 py-2 text-zinc-700">${row.base_price.toFixed(2)}</td>
                      <td className="px-3 py-2 text-zinc-700">${row.final_price.toFixed(2)}</td>
                      <td className="px-3 py-2 text-emerald-800">${row.discount_amount.toFixed(2)}</td>
                      <td className="px-3 py-2 text-zinc-600">{row.discount_percent.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <details className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs">
            <summary className="cursor-pointer font-medium text-zinc-700">Raw JSON</summary>
            <pre className="mt-2 max-h-64 overflow-auto rounded bg-white p-2 font-mono text-[11px] text-zinc-800">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      ) : null}
    </div>
  );
}
