"use client";

import { useState, useEffect, useCallback } from "react";
import { TreezProduct, getProductDisplay } from "@/lib/treez";

const BRAND_BLUE = "#1F2B44";

type UploadStatus = {
  [productId: string]: "idle" | "uploading" | "success" | "error";
};

export default function TreezLocationProductsPage() {
  const [products, setProducts] = useState<TreezProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [treezStatus, setTreezStatus] = useState<"checking" | "ok" | "fail">("checking");
  const [opticonStatus, setOpticonStatus] = useState<"checking" | "ok" | "fail" | "not_configured">("checking");
  const [selectedProduct, setSelectedProduct] = useState<TreezProduct | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({});
  const [uploadingAll, setUploadingAll] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState("FRONT OF HOUSE");

  const fetchProductsByLocation = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/products/by-location?location=${encodeURIComponent(selectedLocation)}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch products: ${response.statusText}`);
      }
      
      const data = await response.json();
      setProducts(data.products || []);
    } catch (err: any) {
      setError(err.message);
      console.error("Error fetching products:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedLocation]);

  // Auto-fetch on page load
  useEffect(() => {
    if (treezStatus === "ok") {
      fetchProductsByLocation();
    }
  }, [treezStatus, fetchProductsByLocation]);

  const uploadToOpticon = async (product: TreezProduct, index: number) => {
    const productId = String(product.product_id ?? product.productId ?? product.id ?? "");
    
    setUploadStatus(prev => {
      const updated = { ...prev };
      updated[productId] = "uploading" as const;
      return updated;
    });
    
    try {
      const pricing = product.pricing as { price_sell?: number; tier_pricing_detail?: Array<{ price_per_value?: number }> } | undefined;
      const cfg = product.product_configurable_fields as Record<string, unknown> | undefined;
      const barcodes = product.product_barcodes as Array<{ sku?: string; barcode?: string }> | undefined;
      
      const productName = cfg?.name ?? product.name ?? product.productName ?? "";
      
      let price = 0;
      if (pricing?.price_sell) price = Number(pricing.price_sell);
      else if (pricing?.tier_pricing_detail?.[0]?.price_per_value) price = Number(pricing.tier_pricing_detail[0].price_per_value);
      else if (product.price) price = Number(product.price);
      else if (product.retailPrice) price = Number(product.retailPrice);
      
      let barcodeValue = "";
      if (barcodes?.[0]?.barcode && barcodes[0].barcode !== productName) {
        barcodeValue = String(barcodes[0].barcode);
      } else if (cfg?.manufacturer_barcode && cfg.manufacturer_barcode !== productName) {
        barcodeValue = String(cfg.manufacturer_barcode);
      } else if (product.barcode && product.barcode !== productName) {
        barcodeValue = String(product.barcode);
      }
      
      const sku = barcodes?.[0]?.sku ?? cfg?.external_id ?? product.sku ?? "";
      const simpleId = String(index + 1);

      const opticonProduct = {
        NotUsed: "",
        ProductId: simpleId,
        Barcode: String(barcodeValue || sku || simpleId),
        Description: String(productName || "Product " + simpleId),
        Group: String(product.category_type ?? product.category ?? product.categoryName ?? ""),
        StandardPrice: String(price),
        SellPrice: String(price),
        Discount: "",
        Content: String(cfg?.size ?? ""),
        Unit: String(cfg?.size_unit ?? "EA"),
      };

      const res = await fetch("/api/opticon/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(opticonProduct),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      const data = await res.json();

      if (data.success) {
        const mappingRes = await fetch("/api/sync/mapping", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            opticonProductId: simpleId,
            treezProductId: productId,
            treezSku: sku,
            barcode: String(barcodeValue),
          }),
        });
        
        if (mappingRes.ok) {
          console.log(`[Mapping] ✓ Saved mapping for #${simpleId}`);
        }
        
        setUploadStatus(prev => {
          const updated = { ...prev };
          updated[productId] = "success" as const;
          return updated;
        });
        setTimeout(() => {
          setUploadStatus(prev => {
            const updated = { ...prev };
            updated[productId] = "idle" as const;
            return updated;
          });
        }, 5000);
      } else {
        throw new Error(data.error || "Upload failed");
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[Upload] ✗ Error for product ${productId}:`, errorMsg);
      setUploadStatus(prev => {
        const updated = { ...prev };
        updated[productId] = "error" as const;
        return updated;
      });
    }
  };

  const uploadAllToOpticon = async () => {
    setUploadingAll(true);
    
    for (let i = 0; i < filteredProducts.length; i++) {
      await uploadToOpticon(filteredProducts[i], i);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    setUploadingAll(false);
  };

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
  }, [checkTreezStatus, checkOpticonStatus]);

  const handleRowClick = (product: TreezProduct) => {
    const id = product.product_id ?? product.productId ?? product.id;
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

  const getInternalTags = (p: TreezProduct): string => {
    const attrs = p.attributes as { internal_tags?: any[] } | undefined;
    const directTags = (p as { internal_tags?: any[] }).internal_tags;
    const tags = attrs?.internal_tags ?? directTags;
    
    if (!Array.isArray(tags) || tags.length === 0) return "-";
    
    return tags.map(t => {
      if (typeof t === 'string') return t;
      if (typeof t === 'object' && t !== null) {
        return (t as any).name ?? (t as any).label ?? JSON.stringify(t);
      }
      return String(t);
    }).join(', ');
  };

  const filteredProducts = products.filter((product) => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    const d = getProductDisplay(product);
    return (
      d.name.toLowerCase().includes(searchLower) ||
      d.sku.toLowerCase().includes(searchLower) ||
      getBarcodeDisplay(product).toLowerCase().includes(searchLower) ||
      d.category.toLowerCase().includes(searchLower) ||
      getInternalTags(product).toLowerCase().includes(searchLower)
    );
  });

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
    "Internal Tags",
    "Actions",
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-zinc-900">Treez Products by Location (NEW)</h1>
        <div className="flex items-center gap-4">
          <StatusBadge status={treezStatus} label="Treez" />
          <StatusBadge status={opticonStatus} label="Opticon" />
          <button
            onClick={uploadAllToOpticon}
            disabled={loading || uploadingAll || filteredProducts.length === 0 || opticonStatus !== "ok"}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50 hover:opacity-90"
            style={{ backgroundColor: "#10b981" }}
            title={opticonStatus !== "ok" ? "Connect to Opticon first" : "Upload all products to Opticon"}
          >
            {uploadingAll ? "Uploading..." : `Upload All to Opticon (${filteredProducts.length})`}
          </button>
          <button
            onClick={() => fetchProductsByLocation()}
            disabled={loading || treezStatus !== "ok"}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50 hover:opacity-90"
            style={{ backgroundColor: BRAND_BLUE }}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by tags, name, or SKU..."
            className="w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            disabled={loading}
          />
          {searchQuery && !loading && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
            >
              ✕
            </button>
          )}
        </div>
        {!loading && (
          <span className="text-sm text-zinc-600">
            {filteredProducts.length} of {products.length} products
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <span className="text-red-600 text-xl">⚠️</span>
            <div>
              <p className="font-semibold text-red-800">Error loading products</p>
              <p className="text-red-700 text-sm mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {treezStatus !== "ok" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
          Connect to Treez first. Check .env.local (TREEZ_API_URL, TREEZ_DISPENSARY, TREEZ_API_KEY).
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex justify-center py-24">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300"
              style={{ borderTopColor: BRAND_BLUE }}
            />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-24 text-center text-zinc-500">
            {searchQuery ? `No products found matching "${searchQuery}"` : "No products found."}
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
                  {filteredProducts.map((p, i) => {
                    const d = getProductDisplay(p);
                    const productId = String(p.product_id ?? p.productId ?? p.id ?? i);
                    const status = uploadStatus[productId] || "idle";
                    
                    return (
                      <tr
                        key={productId}
                        className="border-b border-zinc-100 transition hover:bg-zinc-50"
                      >
                        <td 
                          className="max-w-[140px] truncate px-3 py-2 text-zinc-600 cursor-pointer" 
                          title={d.name}
                          onClick={() => handleRowClick(p)}
                        >
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
                        <td className="max-w-[140px] truncate px-3 py-2 text-zinc-600" title={getInternalTags(p)}>
                          {getInternalTags(p)}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              uploadToOpticon(p, i);
                            }}
                            disabled={status === "uploading" || opticonStatus !== "ok"}
                            className={`rounded px-3 py-1 text-xs font-medium transition ${
                              status === "uploading"
                                ? "bg-blue-100 text-blue-600 cursor-wait"
                                : status === "success"
                                  ? "bg-green-100 text-green-700"
                                  : status === "error"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                            } disabled:opacity-50`}
                            title={opticonStatus !== "ok" ? "Connect to Opticon first" : `Upload as Product #${i + 1}`}
                          >
                            {status === "uploading" ? "Uploading..." : status === "success" ? "✓ Uploaded" : status === "error" ? "✗ Failed" : `Upload (#${i + 1})`}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3">
              <p className="text-sm text-zinc-500">
                {filteredProducts.length.toLocaleString()} products from {selectedLocation}
              </p>
            </div>
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
