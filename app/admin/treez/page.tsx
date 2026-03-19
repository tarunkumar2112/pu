"use client";

import { useState, useEffect, useCallback } from "react";
import { TreezProduct, TreezLocation, getProductDisplay } from "@/lib/treez";

const BRAND_BLUE = "#1F2B44";

type FilterType = "SELLABLE" | "ALL" | "ACTIVE" | "DEACTIVATED";

export default function TreezProductsPage() {
  const [products, setProducts] = useState<TreezProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [filter, setFilter] = useState<FilterType>("SELLABLE");
  const [barcodeOnly, setBarcodeOnly] = useState(false);
  const [locationId, setLocationId] = useState<string | undefined>(undefined);
  const [locations, setLocations] = useState<TreezLocation[]>([]);
  const [treezStatus, setTreezStatus] = useState<"checking" | "ok" | "fail">("checking");
  const [opticonStatus, setOpticonStatus] = useState<"checking" | "ok" | "fail" | "not_configured">("checking");
  const [selectedProduct, setSelectedProduct] = useState<TreezProduct | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        filter,
      });
      if (locationId) params.set("location", locationId);
      if (barcodeOnly) params.set("barcode_only", "true");
      const res = await fetch(`/api/products?${params}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to fetch products");
      setProducts(data.products ?? []);
      setTotalPages(data.total_pages ?? 1);
      setTotalCount(data.total_count ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [page, filter, locationId, barcodeOnly]);

  const fetchLocations = useCallback(async () => {
    try {
      const res = await fetch("/api/locations");
      const data = await res.json();
      if (data.success && Array.isArray(data.locations)) {
        setLocations(data.locations);
      }
    } catch {
      setLocations([]);
    }
  }, []);

  const checkTreezStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/auth");
      const data = await res.json();
      setTreezStatus(data.success ? "ok" : "fail");
    } catch {
      setTreezStatus("fail");
    }
  }, []);

  const checkOpticonStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/opticon");
      const data = await res.json();
      if (data.success && data.authenticated) setOpticonStatus("ok");
      else if (data.error?.toLowerCase().includes("not set")) setOpticonStatus("not_configured");
      else setOpticonStatus("fail");
    } catch {
      setOpticonStatus("fail");
    }
  }, []);

  useEffect(() => {
    checkTreezStatus();
    checkOpticonStatus();
    fetchLocations();
  }, [checkTreezStatus, checkOpticonStatus, fetchLocations]);

  useEffect(() => {
    if (treezStatus === "ok") fetchProducts();
    else setLoading(false);
  }, [treezStatus, fetchProducts]);

  const handleRowClick = (product: TreezProduct) => {
    const id = product.product_id ?? product.productId;
    if (!id) return;
    setDetailLoading(true);
    setSelectedProduct(null);
    fetch(`/api/products/${encodeURIComponent(String(id))}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.product) setSelectedProduct(data.product);
      })
      .catch(() => {})
      .finally(() => setDetailLoading(false));
  };

  const filters: { value: FilterType; label: string }[] = [
    { value: "SELLABLE", label: "Sellable" },
    { value: "ALL", label: "All" },
    { value: "ACTIVE", label: "Active" },
    { value: "DEACTIVATED", label: "Deactivated" },
  ];

  const StatusBadge = ({
    status,
    label,
  }: {
    status: "checking" | "ok" | "fail" | "not_configured";
    label: string;
  }) => {
    const ok = status === "ok";
    const fail = status === "fail";
    const warn = status === "not_configured";
    return (
      <span
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${
          ok ? "bg-emerald-100 text-emerald-800" : fail ? "bg-red-100 text-red-800" : warn ? "bg-amber-100 text-amber-800" : "bg-zinc-200 text-zinc-600"
        }`}
        title={label}
      >
        <span
          className={`h-2 w-2 rounded-full ${
            ok ? "bg-emerald-500" : fail ? "bg-red-500" : warn ? "bg-amber-500" : "animate-pulse bg-zinc-400"
          }`}
        />
        {ok ? "Connected" : fail ? "Disconnected" : warn ? "Not configured" : "Checking..."}
      </span>
    );
  };

  const getBarcodeDisplay = (p: TreezProduct): string => {
    const barcodes = p.product_barcodes as Array<{ sku?: string; barcode?: string }> | undefined;
    const first = barcodes?.[0];
    const fromBarcodes = first?.sku ?? (first as { barcode?: string })?.barcode;
    const cfg = p.product_configurable_fields as Record<string, unknown> | undefined;
    const manufacturerBc = cfg?.manufacturer_barcode as string | undefined;
    const val = fromBarcodes ?? manufacturerBc ?? p.barcode ?? "";
    return val || "-";
  };

  const columns = [
    "Name",
    "Status",
    "SKU",
    "Barcode",
    "Category",
    "Brand",
    "Size",
    "Price",
    "Tier",
    "Subtype",
    "Qty",
    "Min Visible",
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-zinc-900">Treez Products</h1>
        <div className="flex items-center gap-4">
          <StatusBadge status={treezStatus} label="Treez" />
          <StatusBadge status={opticonStatus} label="Opticon" />
          <button
            onClick={() => fetchProducts()}
            disabled={loading || treezStatus !== "ok"}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50 hover:opacity-90"
            style={{ backgroundColor: BRAND_BLUE }}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>
      )}

      {treezStatus !== "ok" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
          Connect to Treez first. Check .env.local (TREEZ_API_URL, TREEZ_DISPENSARY, TREEZ_API_KEY).
        </div>
      )}

      {treezStatus === "ok" && locations.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setLocationId(undefined)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              !locationId
                ? "text-white"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
            }`}
            style={!locationId ? { backgroundColor: BRAND_BLUE } : undefined}
          >
            All Locations
          </button>
          {locations.map((loc) => {
            const id = loc.id ?? (loc as { location_id?: string }).location_id;
            const name = loc.name ?? (loc as { location_name?: string }).location_name ?? "Location";
            const isActive = !locationId ? false : id === locationId;
            return (
              <button
                key={id ?? name}
                onClick={() => setLocationId(id ? String(id) : undefined)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  isActive ? "text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
                style={isActive ? { backgroundColor: BRAND_BLUE } : undefined}
              >
                {name}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => {
              setFilter(f.value);
              setPage(1);
            }}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              filter === f.value ? "text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
            }`}
            style={filter === f.value ? { backgroundColor: BRAND_BLUE } : undefined}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
        <button
          type="button"
          onClick={() => {
            setBarcodeOnly((b) => !b);
            setPage(1);
          }}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            barcodeOnly ? "text-white" : "bg-white border border-zinc-300 text-zinc-700 hover:bg-zinc-100"
          }`}
          style={barcodeOnly ? { backgroundColor: BRAND_BLUE } : undefined}
          title="Show only products that have a barcode (filters across all products)"
        >
          {barcodeOnly ? `Barcode only (${totalCount} products)` : "Barcode only products"}
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex justify-center py-24">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300"
              style={{ borderTopColor: BRAND_BLUE }}
            />
          </div>
        ) : products.length === 0 ? (
          <div className="py-24 text-center text-zinc-500">
            {barcodeOnly
              ? "No products with barcode found. Turn off &quot;Barcode only&quot; to see all products."
              : "No products found. Try a different filter or location."}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    {columns.map((col) => (
                      <th
                        key={col}
                        className="max-w-[140px] truncate px-3 py-3 font-medium text-zinc-900"
                        title={col}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {products.map((p, i) => {
                    const d = getProductDisplay(p);
                    return (
                      <tr
                        key={p.product_id ?? p.productId ?? i}
                        onClick={() => handleRowClick(p)}
                        className="cursor-pointer border-b border-zinc-100 transition hover:bg-zinc-50"
                      >
                        <td className="max-w-[140px] truncate px-3 py-2 text-zinc-600" title={d.name}>
                          {d.name}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              d.status === "Active"
                                ? "bg-emerald-100 text-emerald-800"
                                : d.status === "Deactivated"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-zinc-100 text-zinc-600"
                            }`}
                          >
                            {d.status}
                          </span>
                        </td>
                        <td className="max-w-[100px] truncate px-3 py-2 text-zinc-600" title={d.sku}>
                          {d.sku}
                        </td>
                        <td className="max-w-[120px] truncate px-3 py-2 font-mono text-zinc-600" title={getBarcodeDisplay(p)}>
                          {getBarcodeDisplay(p)}
                        </td>
                        <td className="max-w-[120px] truncate px-3 py-2 text-zinc-600" title={d.category}>
                          {d.category}
                        </td>
                        <td className="max-w-[120px] truncate px-3 py-2 text-zinc-600" title={d.brand}>
                          {d.brand}
                        </td>
                        <td className="max-w-[80px] truncate px-3 py-2 text-zinc-600" title={d.size}>
                          {d.size}
                        </td>
                        <td className="px-3 py-2 text-zinc-600">{d.price}</td>
                        <td className="max-w-[80px] truncate px-3 py-2 text-zinc-600" title={d.tier}>
                          {d.tier}
                        </td>
                        <td className="max-w-[80px] truncate px-3 py-2 text-zinc-600" title={d.subtype}>
                          {d.subtype}
                        </td>
                        <td className="px-3 py-2 text-zinc-600">{d.qty}</td>
                        <td className="px-3 py-2 text-zinc-600">{d.minVisible}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalPages >= 1 && (
              <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3">
                <p className="text-sm text-zinc-500">
                  {barcodeOnly
                    ? `${totalCount.toLocaleString()} products with barcode · Page ${page} of ${totalPages}`
                    : `${totalCount.toLocaleString()} total · Page ${page} of ${totalPages}`}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 disabled:opacity-50 hover:bg-zinc-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 disabled:opacity-50 hover:bg-zinc-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {(selectedProduct !== null || detailLoading) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !detailLoading && setSelectedProduct(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
              <h3 className="text-lg font-semibold text-zinc-900">Product Detail</h3>
              <button
                onClick={() => !detailLoading && setSelectedProduct(null)}
                disabled={detailLoading}
                className="rounded p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50"
              >
                ✕
              </button>
            </div>
            {detailLoading ? (
              <div className="flex justify-center py-12">
                <div
                  className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300"
                  style={{ borderTopColor: BRAND_BLUE }}
                />
              </div>
            ) : selectedProduct ? (
              <div className="mt-4 space-y-4">
                <dl className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(getProductDisplay(selectedProduct)).map(([key, value]) => (
                    <div key={key} className="rounded bg-zinc-50 px-3 py-2">
                      <dt className="text-xs text-zinc-500">{key}</dt>
                      <dd className="mt-0.5 font-medium text-zinc-900 break-all">{value}</dd>
                    </div>
                  ))}
                </dl>
                <div>
                  <h4 className="mb-2 font-medium text-zinc-700">Raw JSON</h4>
                  <pre className="max-h-64 overflow-auto rounded bg-zinc-100 p-3 text-xs">
                    {JSON.stringify(selectedProduct, null, 2)}
                  </pre>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
