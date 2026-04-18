"use client";

import { useCallback, useEffect, useState } from "react";
import { TreezProduct, getProductDisplay, getTreezProductListId } from "@/lib/treez";

const BRAND_BLUE = "#1F2B44";

export default function TreezTablePage() {
  const [products, setProducts] = useState<TreezProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/products/by-location?location=FRONT%20OF%20HOUSE");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load Treez products");
      setProducts(Array.isArray(data.products) ? data.products : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Treez products");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const filteredProducts = products.filter((product) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const d = getProductDisplay(product);
    return (
      d.name.toLowerCase().includes(q) ||
      d.sku.toLowerCase().includes(q) ||
      d.category.toLowerCase().includes(q) ||
      d.brand.toLowerCase().includes(q)
    );
  });

  const csvEscape = (value: unknown): string => {
    const s = value === null || value === undefined ? "" : String(value);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const getBarcodeOrFallback = (product: TreezProduct, index: number): string => {
    const barcodes = product.product_barcodes as Array<{ sku?: string; barcode?: string }> | undefined;
    const fromBarcode = barcodes?.[0]?.barcode?.trim() ?? "";
    const fromSku = barcodes?.[0]?.sku?.trim() ?? "";
    const direct = typeof product.barcode === "string" ? product.barcode.trim() : "";
    const picked = fromBarcode || direct || fromSku;
    if (picked) return picked;
    const base = `${Date.now()}${index + 1}`;
    return base.slice(-12);
  };

  const parsePriceNumber = (product: TreezProduct): string => {
    const pricing = product.pricing as { price_sell?: number; tier_pricing_detail?: Array<{ price_per_value?: number }> } | undefined;
    const val = pricing?.price_sell ?? pricing?.tier_pricing_detail?.[0]?.price_per_value ?? product.price ?? product.retailPrice ?? 0;
    return Number(val || 0).toFixed(2);
  };

  const downloadTreezCsv = () => {
    const headers = [
      "ProductId",
      "TreezUUID",
      "Barcode",
      "Description",
      "Brandname",
      "Group",
      "StandardPrice",
      "SellPrice",
      "Discount",
      "Content",
      "Unit",
    ];

    const lines = [headers.join(",")];
    filteredProducts.forEach((product, index) => {
      const d = getProductDisplay(product);
      const cfg = product.product_configurable_fields as Record<string, unknown> | undefined;
      const treezUuid = getTreezProductListId(product);
      const barcode = getBarcodeOrFallback(product, index);
      const price = parsePriceNumber(product);
      const row = [
        String(index + 1),
        treezUuid,
        barcode,
        d.name === "-" ? "" : d.name,
        d.brand === "-" ? "" : d.brand,
        d.category === "-" ? "" : d.category,
        price,
        price,
        "",
        String(cfg?.size ?? ""),
        String(cfg?.size_unit ?? "EA"),
      ].map(csvEscape);
      lines.push(row.join(","));
    });

    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `treez-products-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-zinc-900">Treez Products</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadTreezCsv}
            disabled={loading || filteredProducts.length === 0}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition disabled:opacity-50 hover:bg-zinc-50"
          >
            Download CSV
          </button>
          <button
            onClick={fetchProducts}
            disabled={loading}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50 hover:opacity-90"
            style={{ backgroundColor: BRAND_BLUE }}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="relative max-w-md">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search name, SKU, brand, category..."
          className="w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        {loading ? (
          <div className="py-20 text-center text-zinc-500">Loading Treez products...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-20 text-center text-zinc-500">No Treez products found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <th className="px-3 py-3 font-medium text-zinc-900">Name</th>
                  <th className="px-3 py-3 font-medium text-zinc-900">SKU</th>
                  <th className="px-3 py-3 font-medium text-zinc-900">Brand</th>
                  <th className="px-3 py-3 font-medium text-zinc-900">Category</th>
                  <th className="px-3 py-3 font-medium text-zinc-900">Price</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p, i) => {
                  const d = getProductDisplay(p);
                  return (
                    <tr key={`${d.sku}-${i}`} className="border-b border-zinc-100">
                      <td className="px-3 py-2 text-zinc-700">{d.name}</td>
                      <td className="px-3 py-2 text-zinc-600">{d.sku}</td>
                      <td className="px-3 py-2 text-zinc-600">{d.brand}</td>
                      <td className="px-3 py-2 text-zinc-600">{d.category}</td>
                      <td className="px-3 py-2 text-zinc-600">{d.price}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
