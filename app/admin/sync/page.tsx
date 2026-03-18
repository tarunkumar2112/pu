"use client";

import { useState, useEffect } from "react";

const BRAND_BLUE = "#1F2B44";

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

export default function SyncPage() {
  const [treezStatus, setTreezStatus] = useState<"checking" | "ok" | "fail">("checking");
  const [opticonStatus, setOpticonStatus] = useState<"checking" | "ok" | "fail" | "not_configured">("checking");
  const [treezCount, setTreezCount] = useState<number | null>(null);
  const [opticonCount, setOpticonCount] = useState<number | null>(null);
  const [batchSize, setBatchSize] = useState(50);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [mappings, setMappings] = useState<{ treez: string; opticon: string }[]>(() => [...DEFAULT_MAPPINGS]);
  const [opticonColumns, setOpticonColumns] = useState<string[]>([]);

  useEffect(() => {
    try {
      const s = localStorage.getItem("sync-field-mappings");
      if (s) {
        const parsed = JSON.parse(s) as { treez: string; opticon: string }[];
        if (Array.isArray(parsed) && parsed.length > 0) setMappings(parsed);
      }
    } catch {}
  }, []);

  const persistMappings = (next: { treez: string; opticon: string }[]) => {
    try {
      localStorage.setItem("sync-field-mappings", JSON.stringify(next));
    } catch {}
  };

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
    if (treezStatus === "ok") {
      fetch("/api/products?page=1&filter=SELLABLE")
        .then((r) => r.json())
        .then((d) => setTreezCount(d.total_count ?? null))
        .catch(() => {});
    }
  }, [treezStatus]);

  useEffect(() => {
    if (opticonStatus === "ok") {
      fetch("/api/opticon/products")
        .then((r) => r.json())
        .then((d) => {
          if (d.success && Array.isArray(d.products)) {
            setOpticonCount(d.products.length);
            if (d.columns?.length) setOpticonColumns(d.columns);
          }
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

  const handleSync = () => {
    setSyncLoading(true);
    setSyncResult(null);
    setTimeout(() => {
      setSyncResult({ ok: false, msg: "Sync not implemented yet. Mapping and batch logic coming next." });
      setSyncLoading(false);
    }, 800);
  };

  const canSync = treezStatus === "ok" && opticonStatus === "ok";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Sync</h1>
        <p className="mt-1 text-zinc-600">
          Map Treez products to Opticon format and sync in batches
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Treez (Source)</h2>
          <p className="mt-1 text-sm text-zinc-500">Product count</p>
          <p className="mt-2 text-2xl font-bold text-zinc-900">
            {treezCount != null ? treezCount.toLocaleString() : "—"}
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
          <p className="mt-1 text-sm text-zinc-500">Product count in EBS50</p>
          <p className="mt-2 text-2xl font-bold text-zinc-900">
            {opticonCount != null ? opticonCount.toLocaleString() : "—"}
          </p>
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
            <p className="mt-1 text-sm text-zinc-500">
              Choose which Treez fields map to which Opticon columns
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={resetMappings}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Reset to defaults
            </button>
            <button
              type="button"
              onClick={addMapping}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              + Add mapping
            </button>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                <th className="px-3 py-2 font-medium text-zinc-900">Treez field</th>
                <th className="w-8 px-2 py-2 text-zinc-400">→</th>
                <th className="px-3 py-2 font-medium text-zinc-900">Opticon column</th>
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
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
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
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      onClick={() => removeMapping(i)}
                      className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                      title="Remove mapping"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {mappings.length === 0 && (
          <p className="mt-4 text-sm text-zinc-500">
            No mappings. Add at least one to sync. ProductId, Barcode, and Description are typically required for Opticon.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Batch sync</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Sync products in batches to avoid timeouts
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2">
            <span className="text-sm text-zinc-600">Batch size:</span>
            <input
              type="number"
              min={10}
              max={200}
              value={batchSize}
              onChange={(e) => setBatchSize(Math.max(10, Math.min(200, parseInt(e.target.value, 10) || 50)))}
              className="w-20 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <button
            onClick={handleSync}
            disabled={!canSync || syncLoading}
            className="rounded-lg px-6 py-2 text-sm font-medium text-white transition disabled:opacity-50 hover:opacity-90"
            style={{ backgroundColor: BRAND_BLUE }}
          >
            {syncLoading ? "Syncing..." : "Start sync"}
          </button>
          {syncResult && (
            <span className={`text-sm font-medium ${syncResult.ok ? "text-emerald-600" : "text-amber-600"}`}>
              {syncResult.msg}
            </span>
          )}
        </div>
        {!canSync && (
          <p className="mt-4 text-sm text-amber-600">
            Connect to both Treez and Opticon to enable sync.
          </p>
        )}
      </div>
    </div>
  );
}
