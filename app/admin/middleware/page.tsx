"use client";

import { useState, useEffect } from "react";
import { TreezProduct, getProductDisplay } from "@/lib/treez";

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
  const [uploadingAll, setUploadingAll] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [searchQuery, setSearchQuery] = useState("");

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
      const supabaseProducts = new Set(
        (supabaseData.snapshots || []).map((s: any) => s.treez_product_id)
      );

      // Fetch all Opticon products
      const opticonRes = await fetch("/api/opticon/products");
      const opticonData = await opticonRes.json();
      const opticonBarcodes = new Set(
        (opticonData.products || []).map((p: any) => p.Barcode)
      );

      // Check each product
      products.forEach((product) => {
        const productId = String(product.id || product.product_id || product.productId || "");
        const inSupabase = supabaseProducts.has(productId);
        const inOpticon = opticonBarcodes.has(productId);

        let status: "synced" | "new" | "partial" = "new";
        if (inSupabase && inOpticon) status = "synced";
        else if (inSupabase || inOpticon) status = "partial";

        statuses.set(productId, {
          productId,
          inSupabase,
          inOpticon,
          status,
        });
      });

      setSyncStatuses(statuses);
    } catch (error) {
      console.error("Error checking sync status:", error);
    } finally {
      setChecking(false);
    }
  };

  // Upload single product to both Supabase and Opticon
  const uploadProduct = async (product: TreezProduct, index: number): Promise<boolean> => {
    const productId = String(product.id || product.product_id || product.productId || "");
    
    // Update status to uploading
    setSyncStatuses(prev => {
      const updated = new Map(prev);
      const current = updated.get(productId) || { productId, inSupabase: false, inOpticon: false, status: "new" as const };
      updated.set(productId, { ...current, uploading: true });
      return updated;
    });

    try {
      const pricing = product.pricing as { price_sell?: number; tier_pricing_detail?: Array<{ price_per_value?: number }> } | undefined;
      const cfg = product.product_configurable_fields as Record<string, unknown> | undefined;
      
      let price = 0;
      if (pricing?.price_sell) price = Number(pricing.price_sell);
      else if (pricing?.tier_pricing_detail?.[0]?.price_per_value) price = Number(pricing.tier_pricing_detail[0].price_per_value);
      else if (product.price) price = Number(product.price);

      // 1. Upload to Opticon (using UUID as Barcode)
      const opticonProduct = {
        NotUsed: "",
        ProductId: String(index + 1),
        Barcode: productId, // Treez UUID
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
        treez_product_id: productId,
        opticon_barcode: productId,
        product_name: String(cfg?.name || product.name || ""),
        category: String(product.category_type || product.category || ""),
        price: price,
        size: String(cfg?.size || ""),
        unit: String(cfg?.size_unit || "EA"),
      };

      const supabaseRes = await fetch("/api/products/sync-snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: snapshot }),
      });

      if (!supabaseRes.ok) throw new Error("Supabase upload failed");

      // Update status to success
      setSyncStatuses(prev => {
        const updated = new Map(prev);
        updated.set(productId, {
          productId,
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
      console.error(`Upload failed for ${productId}:`, error);
      
      // Update status to error
      setSyncStatuses(prev => {
        const updated = new Map(prev);
        const current = updated.get(productId) || { productId, inSupabase: false, inOpticon: false, status: "new" as const };
        updated.set(productId, {
          ...current,
          uploading: false,
          uploadError: error instanceof Error ? error.message : "Upload failed",
        });
        return updated;
      });

      return false;
    }
  };

  // Upload all new/partial products
  const uploadAllProducts = async (onlyNew: boolean = false) => {
    setUploadingAll(true);
    
    const productsToUpload = products.filter((p) => {
      const productId = String(p.id || p.product_id || p.productId || "");
      const status = syncStatuses.get(productId);
      if (onlyNew) {
        return status?.status === "new";
      }
      return status?.status === "new" || status?.status === "partial";
    });

    setUploadProgress({ current: 0, total: productsToUpload.length });

    for (let i = 0; i < productsToUpload.length; i++) {
      await uploadProduct(productsToUpload[i], i);
      setUploadProgress({ current: i + 1, total: productsToUpload.length });
      await new Promise(resolve => setTimeout(resolve, 300)); // Small delay between uploads
    }

    setUploadingAll(false);
    setUploadProgress({ current: 0, total: 0 });
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
      d.category.toLowerCase().includes(searchLower)
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">Total Products</p>
              <p className="text-3xl font-bold text-blue-900 mt-1">{stats.total}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-blue-200 flex items-center justify-center text-2xl">
              📦
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl border border-emerald-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-600">Fully Synced</p>
              <p className="text-3xl font-bold text-emerald-900 mt-1">{stats.synced}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-emerald-200 flex items-center justify-center text-2xl">
              ✓
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl border border-amber-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-amber-600">New in Treez</p>
              <p className="text-3xl font-bold text-amber-900 mt-1">{stats.new}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-amber-200 flex items-center justify-center text-2xl">
              🆕
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600">Partial Sync</p>
              <p className="text-3xl font-bold text-purple-900 mt-1">{stats.partial}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-purple-200 flex items-center justify-center text-2xl">
              ⚠️
            </div>
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

      {/* Action Buttons - PROMINENT */}
      <div className="bg-gradient-to-br from-blue-50 via-blue-100 to-emerald-50 rounded-2xl border-2 border-blue-300 p-8 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-bold text-zinc-900 mb-2">Upload Products to Opticon + Supabase</h3>
            <p className="text-zinc-600">Bulk sync products to both systems simultaneously</p>
          </div>
          <div className="text-6xl">⚡</div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => uploadAllProducts(true)}
            disabled={uploadingAll || stats.new === 0}
            className="group relative overflow-hidden rounded-xl px-8 py-6 text-base font-bold text-white transition-all disabled:opacity-50 hover:scale-105 hover:shadow-2xl"
            style={{ backgroundColor: "#10b981" }}
          >
            <div className="relative z-10">
              <div className="text-3xl mb-2">🆕</div>
              <div>Upload NEW Products</div>
              <div className="text-sm font-normal opacity-90 mt-1">
                {stats.new} products ready
              </div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-emerald-700 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>

          <button
            onClick={() => uploadAllProducts(false)}
            disabled={uploadingAll || (stats.new + stats.partial) === 0}
            className="group relative overflow-hidden rounded-xl px-8 py-6 text-base font-bold text-white transition-all disabled:opacity-50 hover:scale-105 hover:shadow-2xl"
            style={{ backgroundColor: "#f59e0b" }}
          >
            <div className="relative z-10">
              <div className="text-3xl mb-2">⚠️</div>
              <div>Upload NEW + PARTIAL</div>
              <div className="text-sm font-normal opacity-90 mt-1">
                {stats.new + stats.partial} products ready
              </div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-amber-600 to-amber-700 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>

          <button
            onClick={fetchProducts}
            disabled={loading || uploadingAll}
            className="group relative overflow-hidden rounded-xl px-8 py-6 text-base font-bold text-zinc-700 bg-white border-2 border-zinc-300 transition-all disabled:opacity-50 hover:scale-105 hover:shadow-xl hover:border-zinc-400"
          >
            <div className="relative z-10">
              <div className="text-3xl mb-2">🔄</div>
              <div>Refresh from Treez</div>
              <div className="text-sm font-normal opacity-70 mt-1">
                Get latest products
              </div>
            </div>
          </button>
        </div>

        <div className="mt-6 bg-white/80 backdrop-blur rounded-lg p-4 border border-blue-200">
          <div className="flex items-start gap-3">
            <div className="text-2xl">ℹ️</div>
            <div className="flex-1 text-sm text-zinc-700">
              <p className="font-semibold mb-1">How it works:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Products are uploaded to <strong>both Opticon and Supabase</strong> simultaneously</li>
                <li>Treez UUID is stored as <strong>Barcode in Opticon</strong> for identification</li>
                <li>Already synced products are <strong>automatically skipped</strong></li>
                <li>Progress is shown in real-time with batch processing</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search products by name, SKU, or category..."
          className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
          >
            ✕
          </button>
        )}
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300" style={{ borderTopColor: BRAND_BLUE }} />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-24 text-center text-zinc-500">No products found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <th className="px-4 py-3 font-semibold text-zinc-900">Product</th>
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
                  const productId = String(product.id || product.product_id || product.productId || "");
                  const status = syncStatuses.get(productId) || { productId, inSupabase: false, inOpticon: false, status: "checking" as const };

                  return (
                    <tr key={productId} className="border-b border-zinc-100 hover:bg-zinc-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-zinc-900">{d.name}</div>
                        <div className="text-xs text-zinc-500 font-mono">{d.sku}</div>
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
                            ✓ Fully Synced
                          </span>
                        )}
                        {status.status === "new" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                            🆕 New
                          </span>
                        )}
                        {status.status === "partial" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-700">
                            ⚠️ Partial
                          </span>
                        )}
                        {status.status === "checking" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600">
                            Checking...
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {status.uploading ? (
                          <button disabled className="rounded-lg px-3 py-1.5 text-xs font-medium bg-blue-100 text-blue-600 cursor-wait">
                            Uploading...
                          </button>
                        ) : status.uploadSuccess ? (
                          <button disabled className="rounded-lg px-3 py-1.5 text-xs font-medium bg-emerald-100 text-emerald-700">
                            ✓ Uploaded
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
  );
}
