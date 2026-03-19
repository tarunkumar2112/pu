"use client";

import { useState, useEffect, useCallback } from "react";
import { TreezProduct, TreezLocation, getProductDisplay } from "@/lib/treez";

const BRAND_BLUE = "#1F2B44";

type FilterType = "SELLABLE" | "ALL" | "ACTIVE" | "DEACTIVATED";

const TREEZ_FIELDS = [
  { value: "product_id", label: "Product ID" },
  { value: "product_configurable_fields.name", label: "Name" },
  { value: "product_configurable_fields.brand", label: "Brand" },
  { value: "product_configurable_fields.size", label: "Size" },
  { value: "product_configurable_fields.amount", label: "Amount" },
  { value: "product_configurable_fields.uom", label: "UOM" },
  { value: "product_configurable_fields.subtype", label: "Subtype" },
  { value: "product_configurable_fields.external_id", label: "External ID" },
  { value: "product_barcodes[0].sku", label: "Barcode (SKU)" },
  { value: "category_type", label: "Category" },
  { value: "product_status", label: "Status" },
  { value: "sellable_quantity", label: "Sellable Qty" },
  { value: "pricing.price_sell", label: "Price (sell)" },
  { value: "pricing.tier_pricing_detail[0].price_per_value", label: "Tier price" },
  { value: "pricing.tier_name", label: "Tier name" },
  { value: "e_commerce.minimum_visible_inventory_level", label: "Min visible" },
  { value: "e_commerce.menu_title", label: "Menu title" },
];

const OPTICON_FIELDS = [
  { value: "ProductId", label: "ProductId" },
  { value: "Barcode", label: "Barcode" },
  { value: "Description", label: "Description" },
  { value: "Group", label: "Group" },
  { value: "StandardPrice", label: "StandardPrice" },
  { value: "SellPrice", label: "SellPrice" },
  { value: "Discount", label: "Discount" },
  { value: "Content", label: "Content" },
  { value: "Unit", label: "Unit" },
  { value: "NotUsed", label: "NotUsed" },
];

const DEFAULT_MAPPINGS: { treez: string; opticon: string }[] = [
  { treez: "product_id", opticon: "ProductId" },
  { treez: "product_barcodes[0].sku", opticon: "Barcode" },
  { treez: "product_configurable_fields.name", opticon: "Description" },
  { treez: "category_type", opticon: "Group" },
  { treez: "pricing.price_sell", opticon: "StandardPrice" },
  { treez: "pricing.price_sell", opticon: "SellPrice" },
  { treez: "product_configurable_fields.amount", opticon: "Content" },
  { treez: "product_configurable_fields.uom", opticon: "Unit" },
];

const COLUMNS = ["Name", "Status", "SKU", "Barcode", "Category", "Brand", "Size", "Price"] as const;

function getBarcodeDisplay(p: TreezProduct): string {
  const barcodes = p.product_barcodes as Array<{ sku?: string; barcode?: string }> | undefined;
  const first = barcodes?.[0];
  const fromBarcodes = first?.sku ?? (first as { barcode?: string })?.barcode;
  const cfg = p.product_configurable_fields as Record<string, unknown> | undefined;
  const manufacturerBc = cfg?.manufacturer_barcode as string | undefined;
  const val = fromBarcodes ?? manufacturerBc ?? p.barcode ?? "";
  return val || "-";
}

export default function SyncPage() {
  const [treezStatus, setTreezStatus] = useState<"checking" | "ok" | "fail">("checking");
  const [opticonStatus, setOpticonStatus] = useState<"checking" | "ok" | "fail" | "not_configured">("checking");
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchSize, setBatchSize] = useState(50);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<{ ok: boolean; msg: string; synced?: number; failed?: number } | null>(null);
  const [mappings, setMappings] = useState<{ treez: string; opticon: string }[]>(() => [...DEFAULT_MAPPINGS]);
  const [opticonColumns, setOpticonColumns] = useState<string[]>([]);

  const persistMappings = (next: { treez: string; opticon: string }[]) => {
    try {
      localStorage.setItem("sync-field-mappings", JSON.stringify(next));
    } catch {}
  };

  useEffect(() => {
    try {
      const s = localStorage.getItem("sync-field-mappings");
      if (s) {
        const parsed = JSON.parse(s) as { treez: string; opticon: string }[];
        if (Array.isArray(parsed) && parsed.length > 0) setMappings(parsed);
      }
    } catch {}
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), filter });
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
      if (data.success && Array.isArray(data.locations)) setLocations(data.locations);
    } catch {
      setLocations([]);
    }
  }, []);

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => setTreezStatus(d.success ? "ok" : "fail"))
      .catch(() => setTreezStatus("fail"));
  }, []);

  useEffect(() => {
    fetch("/api/opticon")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.authenticated) setOpticonStatus("ok");
        else if (d.error?.toLowerCase().includes("not set")) setOpticonStatus("not_configured");
        else setOpticonStatus("fail");
      })
      .catch(() => setOpticonStatus("fail"));
  }, []);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  useEffect(() => {
    if (treezStatus === "ok") fetchProducts();
    else setLoading(false);
  }, [treezStatus, fetchProducts]);

  useEffect(() => {
    if (opticonStatus === "ok") {
      fetch("/api/opticon/products")
        .then((r) => r.json())
        .then((d) => {
          if (d.success && d.columns?.length) setOpticonColumns(d.columns);
        })
        .catch(() => {});
    }
  }, [opticonStatus]);

  const addMapping = () => {
    setMappings((m) => {
      const next = [...m, { treez: TREEZ_FIELDS[0].value, opticon: OPTICON_FIELDS[0].value }];
      persistMappings(next);
      return next;
    });
  };
  const removeMapping = (index: number) => {
    setMappings((m) => {
      const next = m.filter((_, i) => i !== index);
      persistMappings(next);
      return next;
    });
  };
  const updateMapping = (index: number, field: "treez" | "opticon", value: string) => {
    setMappings((m) => {
      const next = m.map((row, i) => (i === index ? { ...row, [field]: value } : row));
      persistMappings(next);
      return next;
    });
  };
  const resetMappings = () => {
    setMappings([...DEFAULT_MAPPINGS]);
    persistMappings(DEFAULT_MAPPINGS);
  };

  const opticonFieldOptions = (() => {
    const fromApi = opticonColumns.map((c) => ({ value: c, label: c }));
    const known = OPTICON_FIELDS.filter((f) => !opticonColumns.includes(f.value));
    return fromApi.length > 0 ? [...fromApi, ...known] : OPTICON_FIELDS;
  })();

  const filters: { value: FilterType; label: string }[] = [
    { value: "SELLABLE", label: "Sellable" },
    { value: "ALL", label: "All" },
    { value: "ACTIVE", label: "Active" },
    { value: "DEACTIVATED", label: "Deactivated" },
  ];

  const toggleSelectAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
    } else {
      const ids = products
        .map((p) => p.product_id ?? p.productId)
        .filter((id): id is string | number => id != null)
        .map(String);
      setSelectedIds(new Set(ids));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSync = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      setSyncResult({ ok: false, msg: "Select at least one product to sync." });
      return;
    }
    setSyncLoading(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: ids, mappings, batchSize }),
      });
      const data = await res.json();
      if (data.success) {
        const synced = data.synced ?? 0;
        const failed = data.failed ?? 0;
        setSyncResult({
          ok: failed === 0,
          msg: failed === 0
            ? `Synced ${synced} product(s) to Opticon.`
            : `Synced ${synced}, failed ${failed}.`,
          synced,
          failed,
        });
        if (synced > 0) setSelectedIds(new Set());
      } else {
        setSyncResult({ ok: false, msg: data.error ?? "Sync failed" });
      }
    } catch (err) {
      setSyncResult({ ok: false, msg: err instanceof Error ? err.message : "Sync failed" });
    } finally {
      setSyncLoading(false);
    }
  };

  const canSync = treezStatus === "ok" && opticonStatus === "ok";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Sync</h1>
        <p className="mt-1 text-zinc-600">
          Select products, map fields, and sync to Opticon
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Treez (Source)</h2>
          <p className="mt-1 text-sm text-zinc-500">Product count</p>
          <p className="mt-2 text-2xl font-bold text-zinc-900">
            {totalCount > 0 ? totalCount.toLocaleString() : "—"}
          </p>
          <span
            className={`mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm ${
              treezStatus === "ok" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${treezStatus === "ok" ? "bg-emerald-500" : "bg-red-500"}`} />
            {treezStatus === "ok" ? "Connected" : "Disconnected"}
          </span>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Opticon (Destination)</h2>
          <p className="mt-1 text-sm text-zinc-500">EBS50 product table</p>
          <span
            className={`mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm ${
              opticonStatus === "ok" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${opticonStatus === "ok" ? "bg-emerald-500" : "bg-red-500"}`} />
            {opticonStatus === "ok" ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Field mapping</h2>
            <p className="mt-1 text-sm text-zinc-500">Treez fields → Opticon columns</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={resetMappings}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={addMapping}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              + Add
            </button>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                <th className="px-3 py-2 font-medium text-zinc-900">Treez</th>
                <th className="w-8 px-2 py-2 text-zinc-400">→</th>
                <th className="px-3 py-2 font-medium text-zinc-900">Opticon</th>
                <th className="w-12 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {mappings.map((m, i) => (
                <tr key={i} className="border-b border-zinc-100">
                  <td className="px-3 py-2">
                    <select
                      value={m.treez}
                      onChange={(e) => updateMapping(i, "treez", e.target.value)}
                      className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm"
                    >
                      {TREEZ_FIELDS.map((f) => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2 text-zinc-400">→</td>
                  <td className="px-3 py-2">
                    <select
                      value={m.opticon}
                      onChange={(e) => updateMapping(i, "opticon", e.target.value)}
                      className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm"
                    >
                      {opticonFieldOptions.map((f) => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      onClick={() => removeMapping(i)}
                      className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                      title="Remove"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {treezStatus === "ok" && locations.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setLocationId(undefined)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              !locationId ? "text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
            }`}
            style={!locationId ? { backgroundColor: BRAND_BLUE } : undefined}
          >
            All Locations
          </button>
          {locations.map((loc) => {
            const id = loc.id ?? (loc as { location_id?: string }).location_id;
            const name = loc.name ?? (loc as { location_name?: string }).location_name ?? "Location";
            const isActive = id === locationId;
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
            onClick={() => { setFilter(f.value); setPage(1); }}
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
          onClick={() => { setBarcodeOnly((b) => !b); setPage(1); }}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            barcodeOnly ? "text-white" : "bg-white border border-zinc-300 text-zinc-700 hover:bg-zinc-100"
          }`}
          style={barcodeOnly ? { backgroundColor: BRAND_BLUE } : undefined}
          title="Show only products with barcode"
        >
          {barcodeOnly ? `Barcode only (${totalCount} products)` : "Barcode only"}
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Products</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Select products to sync · {selectedIds.size} selected
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2">
              <span className="text-sm text-zinc-600">Batch:</span>
              <input
                type="number"
                min={10}
                max={200}
                value={batchSize}
                onChange={(e) => setBatchSize(Math.max(10, Math.min(200, parseInt(e.target.value, 10) || 50)))}
                className="w-16 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
              />
            </label>
            <button
              onClick={toggleSelectAll}
              disabled={loading || products.length === 0}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              {selectedIds.size === products.length && products.length > 0 ? "Select none" : "Select all"}
            </button>
            <button
              onClick={handleSync}
              disabled={!canSync || syncLoading || selectedIds.size === 0}
              className="rounded-lg px-5 py-2 text-sm font-medium text-white transition disabled:opacity-50 hover:opacity-90"
              style={{ backgroundColor: BRAND_BLUE }}
            >
              {syncLoading ? "Syncing..." : `Sync selected (${selectedIds.size})`}
            </button>
          </div>
        </div>

        {error && (
          <div className="border-b border-red-200 bg-red-50 px-6 py-3 text-red-800">{error}</div>
        )}

        {loading ? (
          <div className="flex justify-center py-24">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300" style={{ borderTopColor: BRAND_BLUE }} />
          </div>
        ) : products.length === 0 ? (
          <div className="py-24 text-center text-zinc-500">
            {barcodeOnly
              ? "No products with barcode. Turn off Barcode only to see all."
              : "No products. Try a different filter or location."}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="w-10 px-2 py-3" />
                    {COLUMNS.map((col) => (
                      <th key={col} className="max-w-[140px] truncate px-3 py-3 font-medium text-zinc-900">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {products.map((p, i) => {
                    const id = String(p.product_id ?? p.productId ?? i);
                    const d = getProductDisplay(p);
                    const checked = selectedIds.has(id);
                    return (
                      <tr
                        key={id}
                        onClick={() => toggleSelect(id)}
                        className={`cursor-pointer border-b border-zinc-100 transition hover:bg-zinc-50 ${
                          checked ? "bg-blue-50/50" : ""
                        }`}
                      >
                        <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSelect(id)}
                            className="h-4 w-4 rounded border-zinc-300"
                          />
                        </td>
                        <td className="max-w-[140px] truncate px-3 py-2 text-zinc-600" title={d.name}>{d.name}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              d.status === "Active" ? "bg-emerald-100 text-emerald-800" :
                              d.status === "Deactivated" ? "bg-red-100 text-red-800" : "bg-zinc-100 text-zinc-600"
                            }`}
                          >
                            {d.status}
                          </span>
                        </td>
                        <td className="max-w-[100px] truncate px-3 py-2 text-zinc-600" title={d.sku}>{d.sku}</td>
                        <td className="max-w-[120px] truncate px-3 py-2 font-mono text-zinc-600" title={getBarcodeDisplay(p)}>{getBarcodeDisplay(p)}</td>
                        <td className="max-w-[120px] truncate px-3 py-2 text-zinc-600" title={d.category}>{d.category}</td>
                        <td className="max-w-[120px] truncate px-3 py-2 text-zinc-600" title={d.brand}>{d.brand}</td>
                        <td className="max-w-[80px] truncate px-3 py-2 text-zinc-600" title={d.size}>{d.size}</td>
                        <td className="px-3 py-2 text-zinc-600">{d.price}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3">
                <p className="text-sm text-zinc-500">
                  {totalCount.toLocaleString()} total · Page {page} of {totalPages}
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

      {syncResult && (
        <div
          className={`rounded-lg border px-4 py-3 ${
            syncResult.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {syncResult.msg}
        </div>
      )}

      {!canSync && (
        <p className="text-sm text-amber-600">Connect to both Treez and Opticon to enable sync.</p>
      )}
    </div>
  );
}
