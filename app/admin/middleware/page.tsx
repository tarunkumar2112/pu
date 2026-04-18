"use client";

import { useEffect, useState } from "react";
import { Package, Database, Smartphone } from "lucide-react";

const BRAND_BLUE = "#1F2B44";

type SyncMeta = {
  supabaseSnapshotRows: number;
  opticonBarcodeCount: number;
  supabaseError?: string;
};

export default function MiddlewarePage() {
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [treezCount, setTreezCount] = useState(0);
  const [syncMeta, setSyncMeta] = useState<SyncMeta | null>(null);

  const loadCounts = async () => {
    setChecking(true);
    try {
      const [treezRes, supabaseRes, opticonRes] = await Promise.all([
        fetch("/api/products/by-location?location=FRONT%20OF%20HOUSE"),
        fetch("/api/products/sync-snapshot"),
        fetch("/api/opticon/products"),
      ]);

      const treezData = await treezRes.json();
      const supabaseData = await supabaseRes.json();
      const opticonData = await opticonRes.json();

      const treezProducts = Array.isArray(treezData.products) ? treezData.products.length : 0;
      setTreezCount(treezProducts);

      const opticonBarcodes = new Set<string>();
      if (Array.isArray(opticonData.products)) {
        opticonData.products.forEach((p: Record<string, unknown>) => {
          const raw = p.Barcode ?? p.barcode ?? p.BARCODE;
          if (raw !== undefined && raw !== null) opticonBarcodes.add(String(raw).trim());
        });
      }

      const supabaseError =
        !supabaseRes.ok || supabaseData.success === false
          ? String(supabaseData.error || `Supabase snapshots HTTP ${supabaseRes.status}`)
          : undefined;

      setSyncMeta({
        supabaseSnapshotRows: Number(supabaseData.total ?? supabaseData.snapshots?.length ?? 0),
        opticonBarcodeCount: opticonBarcodes.size,
        supabaseError,
      });
    } catch {
      setSyncMeta({ supabaseSnapshotRows: 0, opticonBarcodeCount: 0, supabaseError: "Failed to load counts" });
      setTreezCount(0);
    } finally {
      setChecking(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCounts();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900">Sync Middleware</h1>
          <p className="mt-1 text-zinc-600">Master control for Treez → Supabase → Opticon synchronization</p>
        </div>
        <button
          onClick={loadCounts}
          disabled={checking}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50 hover:opacity-90"
          style={{ backgroundColor: BRAND_BLUE }}
        >
          {checking ? "Checking..." : "Check Status"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">Treez (FOH)</p>
              <p className="mt-1 text-3xl font-bold text-blue-900">
                {loading ? "—" : treezCount.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-blue-800/80">Products from Treez API · FRONT OF HOUSE</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-200">
              <Package className="h-6 w-6 text-blue-700" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-violet-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-violet-600">Opticon</p>
              <p className="mt-1 text-3xl font-bold text-violet-900">
                {loading || !syncMeta ? "—" : syncMeta.opticonBarcodeCount.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-violet-800/80">Unique barcodes on EBS50</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-200">
              <Smartphone className="h-6 w-6 text-violet-700" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-600">Supabase</p>
              <p className="mt-1 text-3xl font-bold text-emerald-900">
                {loading || !syncMeta ? "—" : syncMeta.supabaseSnapshotRows.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-emerald-800/80">Rows in product_snapshots</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-200">
              <Database className="h-6 w-6 text-emerald-700" />
            </div>
          </div>
        </div>
      </div>

      {syncMeta?.supabaseError ? (
        <p className="text-xs font-medium text-red-600">
          Supabase snapshot load failed: {syncMeta.supabaseError}
        </p>
      ) : null}
    </div>
  );
}
