"use client";

import { useEffect, useState } from "react";

interface TreezProduct {
  product_id?: string;
  productId?: string;
  name?: string;
  productName?: string;
  price?: number;
  retailPrice?: number;
  barcode?: string;
  sku?: string;
  category?: string;
  category_type?: string;
  categoryName?: string;
  pricing?: unknown;
  product_barcodes?: unknown;
  product_configurable_fields?: unknown;
  [key: string]: unknown;
}

interface MappedProduct {
  treezId: string;
  treezData: {
    name: string;
    price: string;
    barcode: string;
    sku: string;
    category: string;
    size: string;
    unit: string;
  };
  opticonData: {
    ProductId: string;
    Barcode: string;
    Description: string;
    Group: string;
    StandardPrice: string;
    SellPrice: string;
    Content: string;
    Unit: string;
  };
  editedPrice?: string;
  editedBarcode?: string;
}

export default function TreezMappingPage() {
  const [products, setProducts] = useState<TreezProduct[]>([]);
  const [mappedProducts, setMappedProducts] = useState<MappedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/products");
      const data = await res.json();
      
      if (data.success && data.products) {
        setProducts(data.products);
        const mapped = data.products.map((p: TreezProduct, idx: number) => 
          extractProductMapping(p, idx)
        );
        setMappedProducts(mapped);
      }
    } catch (error) {
      console.error("Failed to fetch products:", error);
    } finally {
      setLoading(false);
    }
  };

  const extractProductMapping = (product: TreezProduct, index: number): MappedProduct => {
    const cfg = product.product_configurable_fields as Record<string, unknown> | undefined;
    const barcodes = product.product_barcodes as Array<{ sku?: string; barcode?: string }> | undefined;
    const pricing = product.pricing as { 
      price_sell?: number; 
      price_type?: string;
      tier_name?: string;
      tier_pricing_detail?: Array<{ price_per_value?: number }>;
    } | undefined;

    // Extract all possible values
    const productName = cfg?.name ?? product.name ?? product.productName ?? "";
    const sku = barcodes?.[0]?.sku ?? cfg?.external_id ?? product.sku ?? "";
    
    // Try to find barcode (not product name)
    let barcode = "";
    if (barcodes?.[0]?.barcode && barcodes[0].barcode !== productName) {
      barcode = String(barcodes[0].barcode);
    } else if (cfg?.manufacturer_barcode && cfg.manufacturer_barcode !== productName) {
      barcode = String(cfg.manufacturer_barcode);
    } else if (product.barcode && product.barcode !== productName) {
      barcode = String(product.barcode);
    }

    // EXACT SAME LOGIC as getProductDisplay in lib/treez.ts
    const tierDetail = pricing?.tier_pricing_detail?.[0];
    const priceVal = pricing?.price_sell ?? tierDetail?.price_per_value ?? product.price ?? product.retailPrice;
    const price = typeof priceVal === "number" && priceVal > 0 ? String(priceVal) : "";

    console.log(`[Mapping] Product ${index + 1}:`, {
      name: productName,
      extractedPrice: price,
      rawPricing: pricing,
      tierDetail: tierDetail,
      priceVal: priceVal,
    });

    const category = product.category_type ?? product.category ?? product.categoryName ?? "";
    const size = cfg?.size ?? "";
    const unit = cfg?.size_unit ?? "EA";

    const simpleId = String(index + 1);

    return {
      treezId: product.product_id ?? product.productId ?? "",
      treezData: {
        name: String(productName),
        price: price,
        barcode: barcode,
        sku: String(sku),
        category: String(category),
        size: String(size),
        unit: String(unit),
      },
      opticonData: {
        ProductId: simpleId,
        Barcode: barcode || sku || simpleId,
        Description: String(productName),
        Group: String(category),
        StandardPrice: price,
        SellPrice: price,
        Content: String(size),
        Unit: String(unit),
      },
    };
  };

  const updateMapping = (index: number, field: 'price' | 'barcode', value: string) => {
    const updated = [...mappedProducts];
    if (field === 'price') {
      updated[index].editedPrice = value;
      updated[index].opticonData.StandardPrice = value;
      updated[index].opticonData.SellPrice = value;
    } else {
      updated[index].editedBarcode = value;
      updated[index].opticonData.Barcode = value;
    }
    setMappedProducts(updated);
  };

  const uploadProduct = async (mapped: MappedProduct) => {
    const productId = mapped.treezId;
    setUploadStatus(prev => ({ ...prev, [productId]: "uploading" }));

    try {
      const opticonProduct = {
        NotUsed: "",
        ...mapped.opticonData,
        Discount: "",
      };

      console.log(`[Upload] Product #${mapped.opticonData.ProductId}:`, opticonProduct);

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
      console.log(`[Upload] Response:`, data);

      if (data.success) {
        // Save mapping
        await fetch("/api/sync/mapping", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            opticonProductId: mapped.opticonData.ProductId,
            treezProductId: productId,
            treezSku: mapped.treezData.sku,
            barcode: mapped.opticonData.Barcode,
          }),
        });

        setUploadStatus(prev => ({ ...prev, [productId]: "success" }));
        setTimeout(() => {
          setUploadStatus(prev => ({ ...prev, [productId]: "" }));
        }, 3000);
      } else {
        throw new Error(data.error || "Upload failed");
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[Upload] Error:`, errorMsg);
      setUploadStatus(prev => ({ ...prev, [productId]: errorMsg }));
    }
  };

  const uploadAll = async () => {
    setUploading(true);
    for (const mapped of mappedProducts) {
      await uploadProduct(mapped);
      // Small delay between uploads
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    setUploading(false);
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center">Loading products...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-2">Product Mapping & Upload</h1>
          <p className="text-gray-600">
            Review and edit product data before uploading to Opticon
          </p>
        </div>
        <button
          onClick={uploadAll}
          disabled={uploading}
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          {uploading ? "Uploading..." : "Upload All to Opticon"}
        </button>
      </div>

      <div className="space-y-6">
        {mappedProducts.map((mapped, idx) => {
          const status = uploadStatus[mapped.treezId];
          const isSuccess = status === "success";
          const isUploading = status === "uploading";
          const isError = status && status !== "success" && status !== "uploading";

          return (
            <div
              key={mapped.treezId}
              className="border rounded-lg p-6 bg-white shadow-sm"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">{mapped.treezData.name}</h3>
                  <p className="text-sm text-gray-500">Opticon ID: {mapped.opticonData.ProductId}</p>
                </div>
                <button
                  onClick={() => uploadProduct(mapped)}
                  disabled={isUploading}
                  className={`px-4 py-2 rounded text-sm font-medium ${
                    isSuccess
                      ? "bg-green-100 text-green-700"
                      : isError
                      ? "bg-red-100 text-red-700"
                      : isUploading
                      ? "bg-gray-100 text-gray-500"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {isSuccess ? "✓ Uploaded" : isUploading ? "Uploading..." : "Upload"}
                </button>
              </div>

              {isError && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">
                  Error: {status}
                </div>
              )}

              <div className="grid grid-cols-2 gap-6">
                {/* Treez Data */}
                <div>
                  <h4 className="font-medium text-gray-700 mb-3">Treez Data (Source)</h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-600">Name:</span>{" "}
                      <span className="font-mono">{mapped.treezData.name || "—"}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Price:</span>{" "}
                      <span className="font-mono">{mapped.treezData.price || "—"}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Barcode:</span>{" "}
                      <span className="font-mono">{mapped.treezData.barcode || "—"}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">SKU:</span>{" "}
                      <span className="font-mono">{mapped.treezData.sku || "—"}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Category:</span>{" "}
                      <span className="font-mono">{mapped.treezData.category || "—"}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Size:</span>{" "}
                      <span className="font-mono">{mapped.treezData.size || "—"}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Unit:</span>{" "}
                      <span className="font-mono">{mapped.treezData.unit || "—"}</span>
                    </div>
                  </div>
                </div>

                {/* Opticon Data - Editable */}
                <div>
                  <h4 className="font-medium text-gray-700 mb-3">Opticon Data (Will Upload)</h4>
                  <div className="space-y-3 text-sm">
                    <div>
                      <label className="block text-gray-600 mb-1">Description:</label>
                      <input
                        type="text"
                        value={mapped.opticonData.Description}
                        onChange={(e) => {
                          const updated = [...mappedProducts];
                          updated[idx].opticonData.Description = e.target.value;
                          setMappedProducts(updated);
                        }}
                        className="w-full px-2 py-1 border rounded font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 mb-1">Price:</label>
                      <input
                        type="text"
                        value={mapped.editedPrice ?? mapped.opticonData.StandardPrice}
                        onChange={(e) => updateMapping(idx, 'price', e.target.value)}
                        className="w-full px-2 py-1 border rounded font-mono text-sm"
                        placeholder="Enter price"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 mb-1">Barcode:</label>
                      <input
                        type="text"
                        value={mapped.editedBarcode ?? mapped.opticonData.Barcode}
                        onChange={(e) => updateMapping(idx, 'barcode', e.target.value)}
                        className="w-full px-2 py-1 border rounded font-mono text-sm"
                        placeholder="Enter barcode"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 mb-1">Group:</label>
                      <input
                        type="text"
                        value={mapped.opticonData.Group}
                        onChange={(e) => {
                          const updated = [...mappedProducts];
                          updated[idx].opticonData.Group = e.target.value;
                          setMappedProducts(updated);
                        }}
                        className="w-full px-2 py-1 border rounded font-mono text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-gray-600 mb-1">Content:</label>
                        <input
                          type="text"
                          value={mapped.opticonData.Content}
                          onChange={(e) => {
                            const updated = [...mappedProducts];
                            updated[idx].opticonData.Content = e.target.value;
                            setMappedProducts(updated);
                          }}
                          className="w-full px-2 py-1 border rounded font-mono text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-600 mb-1">Unit:</label>
                        <input
                          type="text"
                          value={mapped.opticonData.Unit}
                          onChange={(e) => {
                            const updated = [...mappedProducts];
                            updated[idx].opticonData.Unit = e.target.value;
                            setMappedProducts(updated);
                          }}
                          className="w-full px-2 py-1 border rounded font-mono text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
