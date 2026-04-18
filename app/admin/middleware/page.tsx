"use client";

import { useState, useEffect } from "react";
import {
  type TreezProduct,
  getProductDisplay,
  getTreezProductListId,
  normalizeTreezProductId,
} from "@/lib/treez";
import {
  Package,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Database,
  Smartphone,
  Loader2,
  X,
  TrendingUp,
  ChevronDown,
} from "lucide-react";

const BRAND_BLUE = "#1F2B44";

interface SyncStatus {
  productId: string;
  inSupabase: boolean;
  inOpticon: boolean;
  status: "synced" | "new" | "partial" | "checking";
  uploading?: boolean;
  uploadSuccess?: boolean;
  uploadError?: string;
}

export default function MiddlewarePage() {
  const [products, setProducts] = useState<TreezProduct[]>([]);
  const [syncStatuses, setSyncStatuses] = useState<Map<string, SyncStatus>>(new Map());
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [browseProductsOpen, setBrowseProductsOpen] = useState(false);
  const [syncMeta, setSyncMeta] = useState<{
    supabaseSnapshotRows: number;
    opticonBarcodeCount: number;
    supabaseError?: string;
    /** Opticon barcodes with no matching Treez product in this FOH list */
    opticonBarcodesNotInTreez: number;
    /** Distinct snapshot `treez_product_id`s not in this FOH list */
    supabaseSnapshotsNotInTreez: number;
  } | null>(null);

  // Fetch products from Treez
  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/products/by-location?location=FRONT%20OF%20HOUSE");
      const data = await res.json();
      setProducts(data.products || []);
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading(false);
    }
  };

  // Check sync status for all products
  const checkSyncStatus = async () => {
    if (products.length === 0) return;
    
    setChecking(true);
    const statuses = new Map<string, SyncStatus>();

    try {
      // Fetch all Supabase snapshots
      const supabaseRes = await fetch("/api/products/sync-snapshot");
      const supabaseData = await supabaseRes.json();

      console.log("[Middleware] Supabase response:", supabaseData);

      const supabaseProducts = new Set<string>();
      if (supabaseData.snapshots && Array.isArray(supabaseData.snapshots)) {
        supabaseData.snapshots.forEach((s: { treez_product_id?: string; opticon_barcode?: string }) => {
          const tid = normalizeTreezProductId(s.treez_product_id);
          const ob = normalizeTreezProductId(s.opticon_barcode);
          if (tid) supabaseProducts.add(tid);
          if (ob) supabaseProducts.add(ob);
        });
      }

      const supabaseError =
        !supabaseRes.ok || supabaseData.success === false
          ? String(supabaseData.error || `Supabase snapshots HTTP ${supabaseRes.status}`)
          : undefined;
      if (supabaseError) {
        console.error("[Middleware] Supabase snapshot fetch failed:", supabaseError);
      }

      console.log("[Middleware] Supabase id keys (normalized):", supabaseProducts.size);

      // Fetch all Opticon products
      const opticonRes = await fetch("/api/opticon/products");
      const opticonData = await opticonRes.json();

      console.log("[Middleware] Opticon response:", opticonData);

      const opticonBarcodes = new Set<string>();
      if (opticonData.products && Array.isArray(opticonData.products)) {
        opticonData.products.forEach((p: Record<string, unknown>) => {
          const raw = p.Barcode ?? p.barcode ?? p.BARCODE;
          if (raw === undefined || raw === null) return;
          const n = normalizeTreezProductId(String(raw));
          if (n) opticonBarcodes.add(n);
        });
      }

      console.log("[Middleware] Opticon barcode keys (normalized):", opticonBarcodes.size);

      const treezIdSet = new Set<string>();
      products.forEach((product) => {
        const k = normalizeTreezProductId(getTreezProductListId(product));
        if (k) treezIdSet.add(k);
      });

      let opticonBarcodesNotInTreez = 0;
      opticonBarcodes.forEach((bc) => {
        if (!treezIdSet.has(bc)) opticonBarcodesNotInTreez += 1;
      });

      const snapshotIdsNotInTreez = new Set<string>();
      if (supabaseData.snapshots && Array.isArray(supabaseData.snapshots)) {
        supabaseData.snapshots.forEach((s: { treez_product_id?: string }) => {
          const tid = normalizeTreezProductId(s.treez_product_id);
          if (tid && !treezIdSet.has(tid)) snapshotIdsNotInTreez.add(tid);
        });
      }

      setSyncMeta({
        supabaseSnapshotRows: Number(supabaseData.total ?? supabaseData.snapshots?.length ?? 0),
        opticonBarcodeCount: opticonBarcodes.size,
        supabaseError,
        opticonBarcodesNotInTreez,
        supabaseSnapshotsNotInTreez: snapshotIdsNotInTreez.size,
      });

      // Check each product (map key = normalized Treez inventory id)
      products.forEach((product) => {
        const rawId = getTreezProductListId(product).trim();
        const mapKey = normalizeTreezProductId(rawId);
        if (!mapKey) return;

        const inSupabase = supabaseProducts.has(mapKey);
        const inOpticon = opticonBarcodes.has(mapKey);

        let status: "synced" | "new" | "partial" = "new";
        if (inSupabase && inOpticon) status = "synced";
        else if (inSupabase || inOpticon) status = "partial";

        statuses.set(mapKey, {
          productId: rawId || mapKey,
          inSupabase,
          inOpticon,
          status,
        });
      });

      console.log("[Middleware] Status check complete. Statuses:", statuses.size);
      setSyncStatuses(statuses);
    } catch (error) {
      console.error("Error checking sync status:", error);
    } finally {
      setChecking(false);
    }
  };

  // Upload single product to both Supabase and Opticon
  const uploadProduct = async (product: TreezProduct, index: number): Promise<boolean> => {
    const rawId = getTreezProductListId(product).trim();
    const mapKey = normalizeTreezProductId(rawId);
    if (!mapKey) return false;
    const treezUuid = rawId || mapKey;

    // Update status to uploading
    setSyncStatuses((prev) => {
      const updated = new Map(prev);
      const current = updated.get(mapKey) || {
        productId: treezUuid,
        inSupabase: false,
        inOpticon: false,
        status: "new" as const,
      };
      updated.set(mapKey, { ...current, uploading: true });
      return updated;
    });

    try {
      const pricing = product.pricing as { price_sell?: number; tier_pricing_detail?: Array<{ price_per_value?: number }> } | undefined;
      const cfg = product.product_configurable_fields as Record<string, unknown> | undefined;
      
      let price = 0;
      if (pricing?.price_sell) price = Number(pricing.price_sell);
      else if (pricing?.tier_pricing_detail?.[0]?.price_per_value) price = Number(pricing.tier_pricing_detail[0].price_per_value);
      else if (product.price) price = Number(product.price);

      // 1. Upload to Opticon (UUID as Barcode; brand in Brandname — see lib/opticon-brand-field.ts)
      const opticonProduct = {
        NotUsed: "",
        ...opticonBrandPayload(treezBrandForOpticonNotUsed(product)),
        ProductId: String(index + 1),
        Barcode: treezUuid,
        Description: String(cfg?.name || product.name || ""),
        Group: String(product.category_type || product.category || ""),
        StandardPrice: String(price),
        SellPrice: String(price),
        Discount: "",
        Content: String(cfg?.size || ""),
        Unit: String(cfg?.size_unit || "EA"),
      };

      const opticonRes = await fetch("/api/opticon/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(opticonProduct),
      });

      if (!opticonRes.ok) throw new Error("Opticon upload failed");

      // 2. Upload to Supabase (snapshot)
      const snapshot = {
        treez_product_id: treezUuid,
        opticon_barcode: treezUuid,
        product_name: String(cfg?.name || product.name || ""),
        category: String(product.category_type || product.category || ""),
        price: price,
        size: String(cfg?.size || ""),
        unit: String(cfg?.size_unit || "EA"),
      };

      const supabaseRes = await fetch("/api/products/upload-snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot }),
      });

      if (!supabaseRes.ok) {
        const errorData = await supabaseRes.json();
        throw new Error(`Supabase upload failed: ${errorData.error || 'Unknown error'}`);
      }

      console.log(`✓ Uploaded ${treezUuid} to both Opticon and Supabase`);

      // Update status to success
      setSyncStatuses((prev) => {
        const updated = new Map(prev);
        updated.set(mapKey, {
          productId: treezUuid,
          inSupabase: true,
          inOpticon: true,
          status: "synced" as const,
          uploading: false,
          uploadSuccess: true,
        });
        return updated;
      });

      return true;
    } catch (error) {
      console.error(`Upload failed for ${treezUuid}:`, error);

      // Update status to error
      setSyncStatuses((prev) => {
        const updated = new Map(prev);
        const current = updated.get(mapKey) || {
          productId: treezUuid,
          inSupabase: false,
          inOpticon: false,
          status: "new" as const,
        };
        updated.set(mapKey, {
          ...current,
          uploading: false,
          uploadError: error instanceof Error ? error.message : "Upload failed",
        });
        return updated;
      });

      return false;
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (products.length > 0 && syncStatuses.size === 0) {
      checkSyncStatus();
    }
  }, [products]);

  const filteredProducts = products.filter((product) => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    const d = getProductDisplay(product);
    return (
      d.name.toLowerCase().includes(searchLower) ||
      d.sku.toLowerCase().includes(searchLower) ||
      d.category.toLowerCase().includes(searchLower) ||
      d.brand.toLowerCase().includes(searchLower)
    );
  });

  const stats = {
    total: products.length,
    synced: Array.from(syncStatuses.values()).filter(s => s.status === "synced").length,
    new: Array.from(syncStatuses.values()).filter(s => s.status === "new").length,
    partial: Array.from(syncStatuses.values()).filter(s => s.status === "partial").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900">Sync Middleware</h1>
          <p className="text-zinc-600 mt-1">Master control for Treez → Supabase → Opticon synchronization</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={checkSyncStatus}
            disabled={checking || loading}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50 hover:opacity-90"
            style={{ backgroundColor: BRAND_BLUE }}
          >
            {checking ? "Checking..." : "Check Status"}
          </button>
        </div>
      </div>

      {/* Stats Cards — Treez list + raw system counts + OK vs gaps */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">Treez (FOH)</p>
              <p className="text-3xl font-bold text-blue-900 mt-1">{stats.total.toLocaleString()}</p>
              <p className="mt-1 text-xs text-blue-800/80">Products from Treez API · FRONT OF HOUSE</p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-200">
              <Package className="h-6 w-6 text-blue-700" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-violet-50 to-violet-100 rounded-xl border border-violet-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-violet-600">Opticon</p>
              <p className="text-3xl font-bold text-violet-900 mt-1">
                {syncMeta ? syncMeta.opticonBarcodeCount.toLocaleString() : "—"}
              </p>
              <p className="mt-1 text-xs text-violet-800/80">Unique barcodes on EBS50</p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-violet-200">
              <Smartphone className="h-6 w-6 text-violet-700" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl border border-emerald-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-600">Supabase</p>
              <p className="text-3xl font-bold text-emerald-900 mt-1">
                {syncMeta ? syncMeta.supabaseSnapshotRows.toLocaleString() : "—"}
              </p>
              <p className="mt-1 text-xs text-emerald-800/80">Rows in product_snapshots</p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-200">
              <Database className="h-6 w-6 text-emerald-700" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl border border-amber-200 p-6">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-amber-800">OK vs extra</p>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700/90">OK</p>
                  <p className="text-2xl font-bold text-amber-950">{stats.synced.toLocaleString()}</p>
                  <p className="text-[10px] text-amber-900/75">In both Supabase &amp; Opticon</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700/90">Extra</p>
                  <p className="text-2xl font-bold text-amber-950">{(stats.new + stats.partial).toLocaleString()}</p>
                  <p className="text-[10px] text-amber-900/75">Treez rows still need sync</p>
                </div>
              </div>
              {syncMeta ? (
                <p className="mt-2 border-t border-amber-200/80 pt-2 text-[10px] leading-snug text-amber-900/85">
                  Outside this FOH list: +{syncMeta.opticonBarcodesNotInTreez.toLocaleString()} Opticon barcodes · +
                  {syncMeta.supabaseSnapshotsNotInTreez.toLocaleString()} Supabase ids
                </p>
              ) : (
                <p className="mt-2 text-[10px] text-amber-800/70">Run Check Status for system drift.</p>
              )}
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-200">
              <TrendingUp className="h-6 w-6 text-amber-800" />
            </div>
          </div>
        </div>
      </div>

      {syncMeta?.supabaseError ? (
        <p className="text-xs font-medium text-red-600">
          Supabase snapshot load failed — Opticon/Supabase card totals may be wrong: {syncMeta.supabaseError}
        </p>
      ) : null}

      {/* Product table — hidden by default; sync still runs in the background */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setBrowseProductsOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-zinc-50"
          style={{ borderLeft: `3px solid ${BRAND_BLUE}` }}
          aria-expanded={browseProductsOpen}
        >
          <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
            <span className="text-sm font-semibold text-zinc-900">Browse products</span>
            <span className="truncate text-xs font-normal text-zinc-500">
              {loading
                ? "Loading catalog…"
                : `${products.length.toLocaleString()} from Treez (FOH) — click to ${browseProductsOpen ? "hide" : "show"} search & table`}
            </span>
          </span>
          <ChevronDown
            className={`h-5 w-5 shrink-0 text-zinc-500 transition-transform ${browseProductsOpen ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>

        {browseProductsOpen ? (
          <div className="space-y-4 border-t border-zinc-200 p-4">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, SKU, brand, or category..."
                className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-3" />
            <p className="text-sm text-zinc-600">Loading products...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-zinc-500">
            <Package className="w-12 h-12 mb-3 opacity-30" />
            <p>No products found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <th className="px-4 py-3 font-semibold text-zinc-900">Product</th>
                  <th className="px-4 py-3 font-semibold text-zinc-900">Brand</th>
                  <th className="px-4 py-3 font-semibold text-zinc-900">Category</th>
                  <th className="px-4 py-3 font-semibold text-zinc-900">Price</th>
                  <th className="px-4 py-3 font-semibold text-zinc-900">Supabase</th>
                  <th className="px-4 py-3 font-semibold text-zinc-900">Opticon</th>
                  <th className="px-4 py-3 font-semibold text-zinc-900">Status</th>
                  <th className="px-4 py-3 font-semibold text-zinc-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product, index) => {
                  const d = getProductDisplay(product);
                  const rawTreezId = getTreezProductListId(product);
                  const mapKey = normalizeTreezProductId(rawTreezId);
                  const rowId = rawTreezId.trim() || mapKey;
                  const status = syncStatuses.get(mapKey) || {
                    productId: rowId,
                    inSupabase: false,
                    inOpticon: false,
                    status: "checking" as const,
                  };

                  return (
                    <tr key={mapKey || rowId} className="border-b border-zinc-100 hover:bg-zinc-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-zinc-900">{d.name}</div>
                        <div className="text-xs text-zinc-500 font-mono">{d.sku}</div>
                      </td>
                      <td className="max-w-[140px] truncate px-4 py-3 text-zinc-700" title={d.brand}>
                        {d.brand}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">{d.category}</td>
                      <td className="px-4 py-3 font-semibold text-zinc-900">{d.price}</td>
                      <td className="px-4 py-3">
                        {status.inSupabase ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            Synced
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500">
                            <span className="w-2 h-2 rounded-full bg-zinc-300" />
                            Not synced
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {status.inOpticon ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            Synced
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500">
                            <span className="w-2 h-2 rounded-full bg-zinc-300" />
                            Not synced
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {status.status === "synced" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Fully synced
                          </span>
                        )}
                        {status.status === "new" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                            <Sparkles className="h-3.5 w-3.5" />
                            New
                          </span>
                        )}
                        {status.status === "partial" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-700">
                            <AlertCircle className="h-3.5 w-3.5" />
                            Partial
                          </span>
                        )}
                        {status.status === "checking" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Checking…
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {status.uploading ? (
                          <button disabled className="rounded-lg px-3 py-1.5 text-xs font-medium bg-blue-100 text-blue-600 cursor-wait">
                            Uploading...
                          </button>
                        ) : status.uploadSuccess ? (
                          <button disabled className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium bg-emerald-100 text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Uploaded
                          </button>
                        ) : status.status !== "synced" ? (
                          <button
                            onClick={() => uploadProduct(product, index)}
                            className="rounded-lg px-3 py-1.5 text-xs font-medium bg-zinc-100 text-zinc-700 hover:bg-zinc-200 transition disabled:opacity-50"
                          >
                            Upload
                          </button>
                        ) : (
                          <span className="text-xs text-zinc-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
