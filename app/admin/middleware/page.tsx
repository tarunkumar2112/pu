"use client";

import { useState, useEffect } from "react";
import { TreezProduct, getProductDisplay } from "@/lib/treez";
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
  Loader2
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
      
      console.log('[Middleware] Supabase response:', supabaseData);
      
      const supabaseProducts = new Set<string>();
      if (supabaseData.snapshots && Array.isArray(supabaseData.snapshots)) {
        supabaseData.snapshots.forEach((s: any) => {
          if (s.treez_product_id) {
            supabaseProducts.add(String(s.treez_product_id));
          }
        });
      }

      console.log('[Middleware] Supabase products count:', supabaseProducts.size);

      // Fetch all Opticon products
      const opticonRes = await fetch("/api/opticon/products");
      const opticonData = await opticonRes.json();
      
      console.log('[Middleware] Opticon response:', opticonData);
      
      const opticonBarcodes = new Set<string>();
      if (opticonData.products && Array.isArray(opticonData.products)) {
        opticonData.products.forEach((p: any) => {
          if (p.Barcode) {
            opticonBarcodes.add(String(p.Barcode));
          }
        });
      }

      console.log('[Middleware] Opticon products count:', opticonBarcodes.size);

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

      console.log('[Middleware] Status check complete. Statuses:', statuses.size);
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
            <div className="w-12 h-12 rounded-full bg-blue-200 flex items-center justify-center">
              <Package className="w-6 h-6 text-blue-700" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl border border-emerald-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-600">Fully Synced</p>
              <p className="text-3xl font-bold text-emerald-900 mt-1">{stats.synced}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-emerald-200 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-700" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl border border-amber-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-amber-600">New in Treez</p>
              <p className="text-3xl font-bold text-amber-900 mt-1">{stats.new}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-amber-200 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-amber-700" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600">Partial Sync</p>
              <p className="text-3xl font-bold text-purple-900 mt-1">{stats.partial}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-purple-200 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-purple-700" />
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
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Zap className="w-8 h-8 text-white" />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => uploadAllProducts(true)}
            disabled={uploadingAll || stats.new === 0}
            className="group relative overflow-hidden rounded-xl px-8 py-6 text-base font-bold text-white transition-all disabled:opacity-50 hover:scale-105 hover:shadow-2xl"
            style={{ backgroundColor: "#10b981" }}
            title="Upload ONLY products that don't exist in Supabase OR Opticon"
          >
            <div className="relative z-10">
              <Sparkles className="w-8 h-8 mx-auto mb-2" />
              <div>Upload NEW Products ONLY</div>
              <div className="text-sm font-normal opacity-90 mt-1">
                {stats.new} products (Not in DB/Opticon)
              </div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-emerald-700 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>

          <button
            onClick={() => uploadAllProducts(false)}
            disabled={uploadingAll || (stats.new + stats.partial) === 0}
            className="group relative overflow-hidden rounded-xl px-8 py-6 text-base font-bold text-white transition-all disabled:opacity-50 hover:scale-105 hover:shadow-2xl"
            style={{ backgroundColor: "#f59e0b" }}
            title="Upload NEW products + products that exist in only ONE system (Supabase OR Opticon, not both)"
          >
            <div className="relative z-10">
              <AlertCircle className="w-8 h-8 mx-auto mb-2" />
              <div>Upload NEW + PARTIAL</div>
              <div className="text-sm font-normal opacity-90 mt-1">
                {stats.new + stats.partial} products (Missing from 1+ system)
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
              <RefreshCw className="w-8 h-8 mx-auto mb-2" />
              <div>Refresh from Treez</div>
              <div className="text-sm font-normal opacity-70 mt-1">
                Get latest products
              </div>
            </div>
          </button>
        </div>

        <div className="mt-6 bg-white/80 backdrop-blur rounded-lg p-4 border border-blue-200">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm text-zinc-700">
              <p className="font-semibold mb-2">Button Differences:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded p-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <p className="font-semibold text-emerald-800">NEW Products ONLY:</p>
                  </div>
                  <p className="text-xs text-emerald-700">Products that exist in <strong>neither</strong> Supabase <strong>nor</strong> Opticon</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded p-2">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <p className="font-semibold text-amber-800">NEW + PARTIAL:</p>
                  </div>
                  <p className="text-xs text-amber-700">NEW products + products in <strong>only one system</strong> (e.g., in Supabase but not Opticon)</p>
                </div>
              </div>
              <p className="font-semibold mb-1">How it works:</p>
              <ul className="space-y-1 text-xs">
                <li className="flex items-start gap-2">
                  <Upload className="w-3 h-3 flex-shrink-0 mt-0.5" />
                  <span>Uploads to <strong>both Opticon and Supabase</strong> simultaneously</span>
                </li>
                <li className="flex items-start gap-2">
                  <Database className="w-3 h-3 flex-shrink-0 mt-0.5" />
                  <span>Treez UUID stored as <strong>Barcode in Opticon</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3 h-3 flex-shrink-0 mt-0.5" />
                  <span>Already fully synced products are <strong>skipped</strong></span>
                </li>
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
