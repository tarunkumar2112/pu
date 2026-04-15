"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

const BRAND_BLUE = "#1F2B44";
const LOGO_URL = "https://cdn.prod.website-files.com/67ee6c6b271e5a2294abc43e/6814932c8fdab74d7cd6845d_Group%201577708998.webp";

interface TreezProduct {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  category?: string;
  brand?: string;
  size?: string;
  unit?: string;
  pricing?: any;
  sellable_quantity_detail?: any[];
  internal_tags?: string[];
}

export default function TreezLocationProductsPage() {
  const [products, setProducts] = useState<TreezProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("FRONT OF HOUSE");

  const fetchProductsByLocation = async () => {
    setLoading(true);
    setError("");
    
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
  };

  // Auto-fetch on page load
  useEffect(() => {
    fetchProductsByLocation();
  }, []); // Empty dependency array = run once on mount

  const getPrice = (product: TreezProduct): string => {
    if (!product.pricing) return "N/A";

    // FLAT pricing
    if (product.pricing.price_type === "FLAT" && product.pricing.price_sell) {
      return `$${product.pricing.price_sell}`;
    }

    // TIER pricing
    if (product.pricing.price_type === "TIER" && product.pricing.tier_pricing_detail) {
      const tierPrices = product.pricing.tier_pricing_detail
        .map((tier: any) => `$${tier.price_per_value}`)
        .join(", ");
      return `Tier: ${tierPrices}`;
    }

    return "N/A";
  };

  const getInventoryLocation = (product: TreezProduct): string => {
    if (!product.sellable_quantity_detail || product.sellable_quantity_detail.length === 0) {
      return "N/A";
    }
    
    const frontOfHouse = product.sellable_quantity_detail.find(
      (detail: any) => detail.location === "FRONT OF HOUSE"
    );
    
    if (frontOfHouse) {
      return `${frontOfHouse.location} (Qty: ${frontOfHouse.sellable_quantity || 0})`;
    }
    
    return product.sellable_quantity_detail[0].location || "N/A";
  };

  const filteredProducts = products.filter((product) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      product.name?.toLowerCase().includes(searchLower) ||
      product.sku?.toLowerCase().includes(searchLower) ||
      product.barcode?.toLowerCase().includes(searchLower) ||
      product.category?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-[1600px] px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src={LOGO_URL}
              alt="Perfect Union"
              width={120}
              height={36}
              className="h-9 w-auto object-contain"
              unoptimized
            />
            <div className="h-8 w-px bg-zinc-300" />
            <h1 className="text-xl font-semibold text-zinc-900">
              Treez Products by Location (NEW)
            </h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-[1600px] px-8 py-8">
        {/* Controls */}
        <div className="mb-6 bg-white rounded-lg border border-zinc-200 p-6">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                Location Filter
              </label>
              <input
                type="text"
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                placeholder="Enter location (e.g., FRONT OF HOUSE)"
                className="w-full rounded-lg border border-zinc-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={fetchProductsByLocation}
              disabled={loading}
              className="rounded-lg px-6 py-2 text-white font-medium transition disabled:opacity-50"
              style={{ backgroundColor: BRAND_BLUE }}
            >
              {loading ? "Fetching..." : "Fetch Products"}
            </button>
          </div>

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>

        {/* Search Bar */}
        {products.length > 0 && (
          <div className="mb-6 bg-white rounded-lg border border-zinc-200 p-4">
            <input
              type="text"
              placeholder="Search by name, SKU, barcode, or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Stats */}
        {products.length > 0 && (
          <div className="mb-6 grid grid-cols-3 gap-4">
            <div className="bg-white rounded-lg border border-zinc-200 p-4">
              <p className="text-sm text-zinc-600">Total Products</p>
              <p className="text-2xl font-bold text-zinc-900">{products.length}</p>
            </div>
            <div className="bg-white rounded-lg border border-zinc-200 p-4">
              <p className="text-sm text-zinc-600">Filtered Results</p>
              <p className="text-2xl font-bold text-zinc-900">{filteredProducts.length}</p>
            </div>
            <div className="bg-white rounded-lg border border-zinc-200 p-4">
              <p className="text-sm text-zinc-600">Location</p>
              <p className="text-lg font-semibold text-zinc-900">{selectedLocation}</p>
            </div>
          </div>
        )}

        {/* Products Table */}
        {filteredProducts.length > 0 && (
          <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-zinc-50 border-b border-zinc-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-700 uppercase">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-700 uppercase">
                      SKU
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-700 uppercase">
                      Barcode
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-700 uppercase">
                      Category
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-700 uppercase">
                      Brand
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-700 uppercase">
                      Price
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-700 uppercase">
                      Size
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-700 uppercase">
                      Location
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-700 uppercase">
                      Tags
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {filteredProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3 text-sm text-zinc-900">
                        {product.name || "N/A"}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-600">
                        {product.sku || "N/A"}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-600 font-mono text-xs">
                        {product.barcode || product.id}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-600">
                        {product.category || "N/A"}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-600">
                        {product.brand || "N/A"}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-zinc-900">
                        {getPrice(product)}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-600">
                        {product.size ? `${product.size} ${product.unit || ""}` : "N/A"}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-600">
                        {getInventoryLocation(product)}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-600">
                        {product.internal_tags?.join(", ") || "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && products.length === 0 && (
          <div className="bg-white rounded-lg border border-zinc-200 p-12 text-center">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-lg font-semibold text-zinc-900 mb-2">
              No Products Loaded
            </h3>
            <p className="text-zinc-600">
              Enter a location and click "Fetch Products" to load products from Treez
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
