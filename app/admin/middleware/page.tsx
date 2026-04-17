"use client";

import { useState, useEffect } from "react";
import {
  TreezProduct,
  getProductDisplay,
  getTreezProductListId,
  normalizeTreezProductId,
  treezBrandForOpticonNotUsed,
} from "@/lib/treez";
import {
  Package,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Zap,
  RefreshCw,
  Info,
  Upload,
  Database,
  Smartphone,
  Loader2,
  Clock,
  Webhook,
  Activity,
  Radio,
  X,
  Trash2,
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

type EnginePayload = {
  changeDetection: {
    intervalMinutes: number;
    lastTickAt: string | null;
    lastCompleteAt: string | null;
    lastError: string | null;
    lastChangesDetected: number;
    lastSyncedToSupabase: number;
    lastSyncedToOpticon: number;
  };
  catalogSync: {
    intervalMinutes: number;
    lastTickAt: string | null;
    lastCompleteAt: string | null;
    lastError: string | null;
    lastNewProducts: number;
    lastRemovedFromSupabase: number;
    lastOpticonUploads: number;
    lastFailed: number;
  };
  webhook: {
    lastReceivedAt: string | null;
    lastEventType: string | null;
    lastProductId: string | null;
    totalReceived: number;
    lastError: string | null;
    lastSuccessAt: string | null;
  };
  activity: Array<{ at: string; channel: string; message: string }>;
};

type ProductChangeRow = {
  id?: string;
  treez_product_id: string;
  change_type: string;
  old_value: string | null;
  new_value: string | null;
  detected_at?: string;
  synced_to_opticon?: boolean;
};

export default function MiddlewarePage() {
  const [products, setProducts] = useState<TreezProduct[]>([]);
  const [syncStatuses, setSyncStatuses] = useState<Map<string, SyncStatus>>(new Map());
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [uploadingAll, setUploadingAll] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [browseProductsOpen, setBrowseProductsOpen] = useState(false);
  const [brandSyncLoading, setBrandSyncLoading] = useState(false);
  const [brandSyncResult, setBrandSyncResult] = useState<Record<string, unknown> | null>(null);
  const [brandSyncProgress, setBrandSyncProgress] = useState<{
    totalRows: number;
    processedRows: number;
    batchIndex: number;
    cumulativeUpdated: number;
    cumulativeFailed: number;
    cumulativeWouldUpdate: number;
    cumulativeExamined: number;
    cumulativeSkippedNoTreez: number;
    cumulativeSkippedAlready: number;
    dryRun: boolean;
  } | null>(null);
  const [engine, setEngine] = useState<EnginePayload | null>(null);
  const [recentChanges, setRecentChanges] = useState<ProductChangeRow[]>([]);
  const [syncMeta, setSyncMeta] = useState<{
    supabaseSnapshotRows: number;
    opticonBarcodeCount: number;
    supabaseError?: string;
    /** Opticon barcodes with no matching Treez product in this FOH list */
    opticonBarcodesNotInTreez: number;
    /** Distinct snapshot `treez_product_id`s not in this FOH list */
    supabaseSnapshotsNotInTreez: number;
  } | null>(null);

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/webhooks/treez/product`
      : "/api/webhooks/treez/product";

  const loadEngineStatus = async () => {
    try {
      const res = await fetch("/api/sync/engine-status");
      const data = await res.json();
      if (data.success) {
        const { success: _s, ...rest } = data;
        setEngine(rest as EnginePayload);
      }
    } catch {
      /* ignore */
    }
  };

  const loadRecentChanges = async () => {
    try {
      const res = await fetch("/api/products/recent-changes?limit=20");
      const data = await res.json();
      if (data.success) setRecentChanges(data.changes || []);
    } catch {
      /* ignore */
    }
  };

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

      // 1. Upload to Opticon (using UUID as Barcode; brand in NotUsed for ESL templates)
      const opticonProduct = {
        NotUsed: treezBrandForOpticonNotUsed(product),
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

  // Upload all products that need syncing (smart detection)
  const uploadAllProducts = async () => {
    setUploadingAll(true);
    
    // Get all products that need uploading (new OR partial)
    const productsToUpload = products.filter((p) => {
      const mapKey = normalizeTreezProductId(getTreezProductListId(p));
      if (!mapKey) return false;
      const status = syncStatuses.get(mapKey);
      return status?.status === "new" || status?.status === "partial";
    });

    setUploadProgress({ current: 0, total: productsToUpload.length });

    for (let i = 0; i < productsToUpload.length; i++) {
      await uploadProduct(productsToUpload[i], i);
      setUploadProgress({ current: i + 1, total: productsToUpload.length });
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    setUploadingAll(false);
    setUploadProgress({ current: 0, total: 0 });
    
    // Re-check status after upload
    setTimeout(() => checkSyncStatus(), 1000);
  };

  const BRAND_SYNC_BATCH = 120;

  /** Backfill Opticon `NotUsed` from Treez brand (Barcode = Treez UUID). Batched for progress + timeouts. */
  const runBrandSyncToNotUsed = async (dryRun: boolean) => {
    if (
      !dryRun &&
      !window.confirm(
        "Update Opticon products: set NotUsed = Treez brand wherever Barcode matches the FOH catalog? This runs in batches and may take several minutes."
      )
    ) {
      return;
    }
    setBrandSyncLoading(true);
    setBrandSyncResult(null);
    setBrandSyncProgress({
      totalRows: 0,
      processedRows: 0,
      batchIndex: 0,
      cumulativeUpdated: 0,
      cumulativeFailed: 0,
      cumulativeWouldUpdate: 0,
      cumulativeExamined: 0,
      cumulativeSkippedNoTreez: 0,
      cumulativeSkippedAlready: 0,
      dryRun,
    });

    let offset = 0;
    let batchNum = 0;
    let cumUpdated = 0;
    let cumFailed = 0;
    let cumWould = 0;
    let cumExamined = 0;
    let cumSkipNo = 0;
    let cumSkipAl = 0;
    const allErrors: string[] = [];
    let lastPayload: Record<string, unknown> | null = null;

    try {
      for (;;) {
        batchNum += 1;
        const res = await fetch("/api/opticon/sync-brands-notused", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dryRun,
            delayMs: 75,
            location: "FRONT OF HOUSE",
            offset,
            batchSize: BRAND_SYNC_BATCH,
          }),
        });
        const data = (await res.json()) as Record<string, unknown>;
        lastPayload = data;

        if (!res.ok || data.success !== true) {
          setBrandSyncResult(data);
          if (batchNum === 1) setBrandSyncProgress(null);
          break;
        }

        const batch = (data.batch ?? {}) as Record<string, unknown>;
        const prog = (data.progress ?? {}) as Record<string, unknown>;

        cumUpdated += Number(batch.updated ?? 0);
        cumFailed += Number(batch.failed ?? 0);
        cumWould += Number(batch.wouldUpdate ?? 0);
        cumExamined += Number(batch.examined ?? 0);
        cumSkipNo += Number(batch.skippedNoTreezOrBrand ?? 0);
        cumSkipAl += Number(batch.skippedAlready ?? 0);

        const errs = batch.errors as string[] | undefined;
        if (errs?.length) {
          for (const e of errs) {
            if (allErrors.length < 35) allErrors.push(e);
          }
        }

        const totalRows = Number(prog.totalRows ?? 0);
        const processedRows = Number(prog.processedRows ?? 0);
        const pct = totalRows > 0 ? Math.min(100, Math.round((processedRows / totalRows) * 1000) / 10) : 0;

        setBrandSyncProgress({
          totalRows,
          processedRows,
          batchIndex: batchNum,
          cumulativeUpdated: cumUpdated,
          cumulativeFailed: cumFailed,
          cumulativeWouldUpdate: cumWould,
          cumulativeExamined: cumExamined,
          cumulativeSkippedNoTreez: cumSkipNo,
          cumulativeSkippedAlready: cumSkipAl,
          dryRun,
        });

        const hasMore = Boolean(data.hasMore);
        if (!hasMore) {
          setBrandSyncResult({
            success: true,
            dryRun,
            batches: batchNum,
            treezProductCount: data.treezProductCount,
            treezBarcodesWithBrand: data.treezBarcodesWithBrand,
            opticonRowCount: data.opticonRowCount,
            totals: {
              examined: cumExamined,
              updated: cumUpdated,
              wouldUpdate: dryRun ? cumWould : undefined,
              failed: cumFailed,
              skippedNoTreezOrBrand: cumSkipNo,
              skippedAlready: cumSkipAl,
            },
            errors: allErrors.length ? allErrors : undefined,
            lastBatch: batch,
          });
          if (!dryRun) setTimeout(() => void checkSyncStatus(), 800);
          break;
        }

        offset = Number(data.nextOffset ?? processedRows);
      }
    } catch (e) {
      setBrandSyncProgress(null);
      setBrandSyncResult({
        success: false,
        error: e instanceof Error ? e.message : String(e),
        lastOk: lastPayload,
      });
    } finally {
      setBrandSyncLoading(false);
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

  useEffect(() => {
    loadEngineStatus();
    loadRecentChanges();
    const t = setInterval(() => {
      loadEngineStatus();
    }, 8000);
    const t2 = setInterval(() => loadRecentChanges(), 15000);
    return () => {
      clearInterval(t);
      clearInterval(t2);
    };
  }, []);

  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "medium" }) : "—";

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

      {/* Three sync channels: change detection (1m), catalog (5m), webhook */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <Radio className="h-5 w-5 text-blue-700" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Change monitor (cron)</h2>
              <p className="text-xs text-zinc-500">node-cron · compares Treez vs Supabase snapshots · pushes Opticon</p>
            </div>
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
              <Clock className="h-3.5 w-3.5" />
              Interval: {engine?.changeDetection.intervalMinutes ?? 1} min
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
              <Database className="h-3.5 w-3.5" />
              Rows to Supabase: {engine?.changeDetection.lastSyncedToSupabase ?? 0} (last run)
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-800">
              <Smartphone className="h-3.5 w-3.5" />
              Opticon pushes: {engine?.changeDetection.lastSyncedToOpticon ?? 0}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900">
              <Activity className="h-3.5 w-3.5" />
              Changes detected: {engine?.changeDetection.lastChangesDetected ?? 0}
            </span>
          </div>
          <dl className="space-y-1 text-xs text-zinc-600">
            <div className="flex justify-between gap-2">
              <dt>Last tick</dt>
              <dd className="font-mono text-zinc-800">{fmt(engine?.changeDetection.lastTickAt ?? null)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Last success</dt>
              <dd className="font-mono text-zinc-800">{fmt(engine?.changeDetection.lastCompleteAt ?? null)}</dd>
            </div>
            {engine?.changeDetection.lastError ? (
              <div className="rounded border border-red-200 bg-red-50 p-2 text-red-800">{engine.changeDetection.lastError}</div>
            ) : null}
          </dl>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
              <RefreshCw className="h-5 w-5 text-emerald-700" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Catalog add / remove (cron)</h2>
              <p className="text-xs text-zinc-500">FRONT OF HOUSE vs Supabase · new rows + DB cleanup</p>
            </div>
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
              <Clock className="h-3.5 w-3.5" />
              Interval: {engine?.catalogSync.intervalMinutes ?? 5} min
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
              <Sparkles className="h-3.5 w-3.5" />
              New items: {engine?.catalogSync.lastNewProducts ?? 0}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-800">
              <Trash2 className="h-3.5 w-3.5" />
              Removed (Supabase): {engine?.catalogSync.lastRemovedFromSupabase ?? 0}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-800">
              <Upload className="h-3.5 w-3.5" />
              Opticon uploads: {engine?.catalogSync.lastOpticonUploads ?? 0}
            </span>
          </div>
          <p className="text-xs text-zinc-500">
            Products that disappear from this Treez location slice are deleted from <code className="rounded bg-zinc-100 px-1">product_snapshots</code> and related{" "}
            <code className="rounded bg-zinc-100 px-1">product_changes</code>. Opticon rows are not auto-deleted yet (no delete API).
          </p>
          <dl className="mt-3 space-y-1 text-xs text-zinc-600">
            <div className="flex justify-between gap-2">
              <dt>Last tick</dt>
              <dd className="font-mono text-zinc-800">{fmt(engine?.catalogSync.lastTickAt ?? null)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Last success</dt>
              <dd className="font-mono text-zinc-800">{fmt(engine?.catalogSync.lastCompleteAt ?? null)}</dd>
            </div>
            {engine?.catalogSync.lastError ? (
              <div className="rounded border border-red-200 bg-red-50 p-2 text-red-800">{engine.catalogSync.lastError}</div>
            ) : null}
          </dl>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100">
              <Webhook className="h-5 w-5 text-violet-700" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Treez product webhook</h2>
              <p className="text-xs text-zinc-500">PRODUCT create / update / activate / deactivate / image</p>
            </div>
          </div>
          <div className="mb-3 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-3">
            <p className="mb-1 text-xs font-medium text-zinc-500">POST URL (expose publicly for Treez)</p>
            <code className="break-all text-xs text-zinc-800">{webhookUrl}</code>
          </div>
          <p className="mb-2 text-xs text-zinc-600">
            Optional auth: set <code className="rounded bg-zinc-100 px-1">TREEZ_WEBHOOK_SECRET</code> in env and send{" "}
            <code className="rounded bg-zinc-100 px-1">Authorization: Bearer …</code> or{" "}
            <code className="rounded bg-zinc-100 px-1">X-Treez-Webhook-Secret</code>.
          </p>
          <div className="mb-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
              Received (total): {engine?.webhook.totalReceived ?? 0}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Last OK: {fmt(engine?.webhook.lastSuccessAt ?? null)}
            </span>
          </div>
          <dl className="space-y-1 text-xs text-zinc-600">
            <div className="flex justify-between gap-2">
              <dt>Last product</dt>
              <dd className="max-w-[60%] truncate font-mono text-zinc-800">{engine?.webhook.lastProductId ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Last received</dt>
              <dd className="font-mono text-zinc-800">{fmt(engine?.webhook.lastReceivedAt ?? null)}</dd>
            </div>
            {engine?.webhook.lastError ? (
              <div className="rounded border border-red-200 bg-red-50 p-2 text-red-800">{engine.webhook.lastError}</div>
            ) : null}
          </dl>
        </div>
      </div>

      {/* Live activity + consolidated change monitor */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900">
            <Activity className="h-4 w-4 text-blue-600" />
            Engine activity (latest)
          </h3>
          <ul className="max-h-56 space-y-2 overflow-y-auto text-xs">
            {(engine?.activity ?? []).length === 0 ? (
              <li className="text-zinc-500">No events yet — start the server and wait for cron or trigger a webhook.</li>
            ) : (
              (engine?.activity ?? []).map((a, i) => (
                <li key={i} className="flex gap-2 border-b border-zinc-100 pb-2">
                  <span className="shrink-0 font-mono text-zinc-400">{fmt(a.at)}</span>
                  <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-zinc-600">
                    {a.channel.replace("_", " ")}
                  </span>
                  <span className="text-zinc-700">{a.message}</span>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            Recent changes (Supabase)
          </h3>
          <div className="max-h-56 overflow-x-auto overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500">
                  <th className="py-2 pr-2">Type</th>
                  <th className="py-2 pr-2">Old → New</th>
                  <th className="py-2 pr-2">Opticon</th>
                  <th className="py-2">When</th>
                </tr>
              </thead>
              <tbody>
                {recentChanges.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-zinc-500">
                      No change rows yet.
                    </td>
                  </tr>
                ) : (
                  recentChanges.map((c) => (
                    <tr key={c.id ?? `${c.treez_product_id}-${c.change_type}`} className="border-b border-zinc-50">
                      <td className="py-1.5 pr-2 font-medium text-zinc-800">{c.change_type}</td>
                      <td className="max-w-[140px] truncate py-1.5 pr-2 text-zinc-600" title={`${c.old_value} → ${c.new_value}`}>
                        {c.old_value ?? "—"} → {c.new_value ?? "—"}
                      </td>
                      <td className="py-1.5 pr-2">
                        {c.synced_to_opticon ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700">
                            <CheckCircle2 className="h-3 w-3" /> Yes
                          </span>
                        ) : (
                          <span className="text-amber-700">Pending</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap py-1.5 text-zinc-500">{fmt(c.detected_at ?? null)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Upload Progress */}
      {uploadingAll && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-blue-900">Uploading Products...</p>
            <p className="text-sm font-medium text-blue-700">
              {uploadProgress.current} / {uploadProgress.total}
            </p>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-blue-600 h-full transition-all duration-300"
              style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Action Buttons - SINGLE SMART BUTTON */}
      <div className="bg-gradient-to-br from-blue-50 via-blue-100 to-emerald-50 rounded-2xl border-2 border-blue-300 p-8 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-bold text-zinc-900 mb-2">Smart Sync Control</h3>
            <p className="text-zinc-600">Intelligent sync to both Opticon + Supabase simultaneously</p>
          </div>
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Zap className="w-8 h-8 text-white" />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={uploadAllProducts}
            disabled={uploadingAll || (stats.new + stats.partial) === 0}
            className="group relative overflow-hidden rounded-xl px-10 py-8 text-lg font-bold text-white transition-all disabled:opacity-50 hover:scale-105 hover:shadow-2xl"
            style={{ backgroundColor: "#10b981" }}
          >
            <div className="relative z-10">
              <Upload className="w-12 h-12 mx-auto mb-3" />
              <div className="mb-2">Smart Upload All</div>
              <div className="text-sm font-normal opacity-90">
                {stats.new + stats.partial} products need syncing
              </div>
              <div className="text-xs font-normal opacity-80 mt-1">
                Auto-detects missing from Supabase or Opticon
              </div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-emerald-700 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>

          <button
            onClick={fetchProducts}
            disabled={loading || uploadingAll}
            className="group relative overflow-hidden rounded-xl px-10 py-8 text-lg font-bold text-zinc-700 bg-white border-2 border-zinc-300 transition-all disabled:opacity-50 hover:scale-105 hover:shadow-xl hover:border-zinc-400"
          >
            <div className="relative z-10">
              <RefreshCw className="w-12 h-12 mx-auto mb-3" />
              <div className="mb-2">Refresh from Treez</div>
              <div className="text-sm font-normal opacity-70">
                Get latest product data
              </div>
            </div>
          </button>
        </div>

        <div className="mt-6 bg-white/80 backdrop-blur rounded-lg p-4 border border-blue-200">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm text-zinc-700">
              <p className="font-semibold mb-2">How Smart Upload Works:</p>
              <ul className="space-y-1 text-xs">
                <li className="flex items-start gap-2">
                  <Sparkles className="w-3 h-3 flex-shrink-0 mt-0.5 text-emerald-600" />
                  <span><strong>Auto-detects</strong> products missing from Supabase OR Opticon</span>
                </li>
                <li className="flex items-start gap-2">
                  <Upload className="w-3 h-3 flex-shrink-0 mt-0.5 text-blue-600" />
                  <span>Uploads to <strong>both systems simultaneously</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <Database className="w-3 h-3 flex-shrink-0 mt-0.5 text-purple-600" />
                  <span>Treez UUID stored as <strong>Barcode in Opticon</strong>; brand in <strong>NotUsed</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3 h-3 flex-shrink-0 mt-0.5 text-emerald-600" />
                  <span>Already synced products are <strong>automatically skipped</strong></span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Backfill Opticon NotUsed with Treez brand (existing rows) */}
      <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/90 to-white p-5 shadow-sm">
        <div className="mb-2 flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-violet-700" />
          <h3 className="text-sm font-semibold text-violet-950">Opticon: brand → NotUsed</h3>
        </div>
        <p className="mb-3 text-xs leading-relaxed text-violet-900/90">
          Loads Treez <strong>FRONT OF HOUSE</strong> products and Opticon rows, matches on{" "}
          <code className="rounded bg-violet-100 px-1">Barcode</code> (Treez UUID), then re-sends each Opticon product with{" "}
          <code className="rounded bg-violet-100 px-1">NotUsed</code> set to the Treez brand (truncated to 100 chars). Skips
          rows that already match. Runs in <strong>batches</strong> with a live progress bar. Use <strong>Dry run</strong> first. If this app runs on
          Vercel with a short request limit, run the same sync from your <strong>local / store server</strong> or
          increase <code className="rounded bg-violet-100 px-1">maxDuration</code> where supported.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void runBrandSyncToNotUsed(true)}
            disabled={brandSyncLoading || loading}
            className="rounded-lg border border-violet-300 bg-white px-4 py-2 text-xs font-semibold text-violet-900 shadow-sm transition hover:bg-violet-50 disabled:opacity-50"
          >
            {brandSyncLoading ? "Working…" : "Dry run (counts only)"}
          </button>
          <button
            type="button"
            onClick={() => void runBrandSyncToNotUsed(false)}
            disabled={brandSyncLoading || loading}
            className="rounded-lg px-4 py-2 text-xs font-semibold text-white shadow-sm transition disabled:opacity-50 hover:opacity-90"
            style={{ backgroundColor: "#6d28d9" }}
          >
            {brandSyncLoading ? "Working…" : "Run sync to Opticon"}
          </button>
        </div>

        {brandSyncProgress && brandSyncProgress.totalRows > 0 ? (
          <div className="mt-4 rounded-lg border border-violet-200 bg-white/90 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-violet-950">
              <span className="font-semibold">
                Batch {brandSyncProgress.batchIndex}
                {brandSyncLoading ? <Loader2 className="ml-1 inline h-3.5 w-3.5 animate-spin text-violet-600" /> : null}
              </span>
              <span className="font-mono text-violet-800">
                {brandSyncProgress.processedRows.toLocaleString()} / {brandSyncProgress.totalRows.toLocaleString()} rows (
                {Math.min(
                  100,
                  Math.round((brandSyncProgress.processedRows / brandSyncProgress.totalRows) * 1000) / 10
                )}
                %)
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-violet-200">
              <div
                className="h-full rounded-full bg-violet-600 transition-[width] duration-300 ease-out"
                style={{
                  width: `${Math.min(100, (brandSyncProgress.processedRows / brandSyncProgress.totalRows) * 100)}%`,
                }}
              />
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-zinc-700 sm:grid-cols-4">
              <div>
                <dt className="text-zinc-500">Examined (cumulative)</dt>
                <dd className="font-semibold text-zinc-900">{brandSyncProgress.cumulativeExamined.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">{brandSyncProgress.dryRun ? "Would update" : "Updated"}</dt>
                <dd className="font-semibold text-emerald-700">
                  {(brandSyncProgress.dryRun ? brandSyncProgress.cumulativeWouldUpdate : brandSyncProgress.cumulativeUpdated).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Failed</dt>
                <dd className="font-semibold text-red-700">{brandSyncProgress.cumulativeFailed.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Skip (no brand / already)</dt>
                <dd className="font-semibold text-zinc-800">
                  {(brandSyncProgress.cumulativeSkippedNoTreez + brandSyncProgress.cumulativeSkippedAlready).toLocaleString()}
                </dd>
              </div>
            </dl>
          </div>
        ) : null}

        {brandSyncResult ? (
          <pre className="mt-3 max-h-48 overflow-auto rounded-lg border border-violet-200 bg-white p-3 font-mono text-[11px] leading-relaxed text-zinc-800">
            {JSON.stringify(brandSyncResult, null, 2)}
          </pre>
        ) : null}
      </div>

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
                            disabled={uploadingAll}
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
