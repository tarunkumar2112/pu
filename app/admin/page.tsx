"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";

const BRAND_BLUE = "#1F2B44";
const LOGO_URL = "https://cdn.prod.website-files.com/67ee6c6b271e5a2294abc43e/6814932c8fdab74d7cd6845d_Group%201577708998.webp";

interface TreezProduct {
  product_id?: string;
  product_status?: string;
  sellable_quantity?: number;
  category_type?: string;
  sku_type?: string;
  product_configurable_fields?: {
    name?: string;
    brand?: string;
    size?: string;
    amount?: number;
    uom?: string;
    subtype?: string;
    external_id?: string;
    [k: string]: unknown;
  };
  pricing?: {
    price_type?: string;
    price_sell?: number | null;
    tier_name?: string;
    tier_pricing_detail?: Array<{ start_value?: number; price_per_value?: number }>;
    [k: string]: unknown;
  };
  product_barcodes?: Array<{ sku?: string; type?: string }>;
  e_commerce?: {
    menu_title?: string;
    minimum_visible_inventory_level?: number;
    [k: string]: unknown;
  };
  [key: string]: unknown;
}

function getProductDisplay(p: TreezProduct) {
  const cfg = p.product_configurable_fields;
  const pricing = p.pricing;
  const tierDetail = pricing?.tier_pricing_detail?.[0];
  const priceVal =
    pricing?.price_sell ??
    tierDetail?.price_per_value ??
    null;
  const skuFromBc = p.product_barcodes?.[0]?.sku;

  return {
    id: p.product_id ?? "-",
    name:
      cfg?.name ??
      (p.e_commerce as { menu_title?: string })?.menu_title ??
      "-",
    status: p.product_status ?? "-",
    sku: skuFromBc ?? cfg?.external_id ?? "-",
    category: p.category_type ?? "-",
    brand: cfg?.brand ?? "-",
    size: cfg?.size ?? "-",
    amount: cfg?.amount ?? "-",
    uom: cfg?.uom ?? "-",
    subtype: cfg?.subtype ?? "-",
    price: priceVal,
    priceType: pricing?.price_type ?? "-",
    tierName: pricing?.tier_name ?? "-",
    pricePerValue: tierDetail?.price_per_value,
    sellableQty: p.sellable_quantity ?? "-",
    minVisible: (p.e_commerce as { minimum_visible_inventory_level?: number })?.minimum_visible_inventory_level ?? "-",
  };
}

const PAGE_SIZE = 100;

export default function AdminPage() {
  const [products, setProducts] = useState<TreezProduct[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<"checking" | "ok" | "fail">("checking");
  const [opticonStatus, setOpticonStatus] = useState<"checking" | "ok" | "fail" | "not_configured">("checking");
  const [opticonError, setOpticonError] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [productDetail, setProductDetail] = useState<TreezProduct | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [filter, setFilter] = useState<"SELLABLE" | "ALL" | "ACTIVE" | "DEACTIVATED">("SELLABLE");
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [locationId, setLocationId] = useState<string>("");

  const fetchProducts = useCallback(async (p: number = 1, f: "SELLABLE" | "ALL" | "ACTIVE" | "DEACTIVATED" = "SELLABLE", locId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p), filter: f });
      if (locId) params.set("location", locId);
      const res = await fetch(`/api/products?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch");
      setProducts(data.products ?? []);
      setPage(data.page ?? p);
      setTotalPages(data.total_pages ?? 1);
      setTotalCount(data.total_count ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLocations = useCallback(async () => {
    try {
      const res = await fetch("/api/locations");
      const data = await res.json();
      if (data.success && Array.isArray(data.locations)) {
        const list = data.locations
          .map((loc: { id?: string; location_id?: string; name?: string }) => ({
            id: loc.id ?? loc.location_id ?? "",
            name: loc.name ?? "Unknown",
          }))
          .filter((loc: { id: string }) => loc.id);
        setLocations(list);
      }
    } catch {
      setLocations([]);
    }
  }, []);

  const applyFilter = (f: "SELLABLE" | "ALL" | "ACTIVE" | "DEACTIVATED") => {
    setFilter(f);
    setPage(1);
  };

  const applyLocation = (locId: string) => {
    setLocationId(locId);
    setPage(1);
  };

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth");
      const data = await res.json();
      setAuthStatus(data.success ? "ok" : "fail");
    } catch {
      setAuthStatus("fail");
    }
  }, []);

  const checkOpticon = useCallback(async () => {
    setOpticonStatus("checking");
    setOpticonError(null);
    try {
      const res = await fetch("/api/opticon");
      const data = await res.json();
      if (data.success && data.authenticated) {
        setOpticonStatus("ok");
        setOpticonError(null);
      } else if (data.success && data.reachable && !data.authenticated) {
        setOpticonStatus("not_configured");
        setOpticonError(data.error ?? "API key not set");
      } else if (data.error?.toLowerCase().includes("not set")) {
        setOpticonStatus("not_configured");
        setOpticonError(data.error ?? null);
      } else {
        setOpticonStatus("fail");
        setOpticonError(data.error ?? "Connection failed");
      }
    } catch (err) {
      setOpticonStatus("fail");
      setOpticonError(err instanceof Error ? err.message : "Request failed");
    }
  }, []);

  useEffect(() => {
    checkAuth();
    checkOpticon();
  }, [checkAuth, checkOpticon]);

  useEffect(() => {
    if (authStatus === "ok") fetchLocations();
  }, [authStatus, fetchLocations]);

  useEffect(() => {
    if (authStatus === "ok") fetchProducts(page, filter, locationId || undefined);
  }, [authStatus, page, filter, locationId, fetchProducts]);

  const goToPage = (p: number) => {
    const next = Math.max(1, Math.min(p, totalPages));
    setPage(next);
  };

  const openProductDetail = (productId: string) => {
    setSelectedProductId(productId);
    setProductDetail(null);
    setDetailLoading(true);
    fetch(`/api/products/${encodeURIComponent(productId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.product) setProductDetail(data.product);
      })
      .finally(() => setDetailLoading(false));
  };

  const pageStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const pageEnd = totalCount === 0 ? 0 : Math.min(page * PAGE_SIZE, totalCount);

  return (
    <div className="min-h-screen bg-zinc-50">
      <header
        className="border-b border-zinc-200 bg-white px-6 py-4"
        style={{ borderBottomColor: "rgba(31,43,68,0.1)" }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-6">
            <Image
              src={LOGO_URL}
              alt="Perfect Union"
              width={140}
              height={40}
              className="h-10 w-auto object-contain"
              unoptimized
            />
            <span className="text-sm font-medium text-zinc-500">Product Sync Admin</span>
          </div>
          <div className="flex items-center gap-4">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm ${
                authStatus === "ok"
                  ? "bg-emerald-100 text-emerald-800"
                  : authStatus === "fail"
                    ? "bg-red-100 text-red-800"
                    : "bg-zinc-200 text-zinc-600"
              }`}
              title="Treez API"
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  authStatus === "ok" ? "bg-emerald-500" : authStatus === "fail" ? "bg-red-500" : "animate-pulse bg-zinc-400"
                }`}
              />
              Treez: {authStatus === "ok" ? "Connected" : authStatus === "fail" ? "Disconnected" : "Checking..."}
            </span>
            <button
              type="button"
              onClick={() => checkOpticon()}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm transition hover:opacity-80 ${
                opticonStatus === "ok"
                  ? "bg-emerald-100 text-emerald-800"
                  : opticonStatus === "fail"
                    ? "bg-red-100 text-red-800"
                    : opticonStatus === "not_configured"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-zinc-200 text-zinc-600"
              }`}
              title={opticonError ? `Opticon: ${opticonError}` : "Opticon EBS50 – click to re-test"}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  opticonStatus === "ok"
                    ? "bg-emerald-500"
                    : opticonStatus === "fail"
                      ? "bg-red-500"
                      : opticonStatus === "not_configured"
                        ? "bg-amber-500"
                        : "animate-pulse bg-zinc-400"
                }`}
              />
              Opticon:{" "}
              {opticonStatus === "ok"
                ? "Connected"
                : opticonStatus === "fail"
                  ? "Disconnected"
                  : opticonStatus === "not_configured"
                    ? "Not configured"
                    : "Checking..."}
            </button>
            {locations.length > 0 && (
              <div className="flex gap-1 rounded-lg border border-zinc-300 bg-zinc-50 p-1">
                <button
                  onClick={() => applyLocation("")}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    !locationId ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  All
                </button>
                {locations.map((loc) => (
                  <button
                    key={loc.id}
                    onClick={() => applyLocation(loc.id)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                      locationId === loc.id ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600 hover:text-zinc-900"
                    }`}
                  >
                    {loc.name}
                  </button>
                ))}
              </div>
            )}
            <select
              value={filter}
              onChange={(e) => applyFilter(e.target.value as "SELLABLE" | "ALL" | "ACTIVE" | "DEACTIVATED")}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
            >
              <option value="SELLABLE">Sellable inventory</option>
              <option value="ALL">All products</option>
              <option value="ACTIVE">Active only</option>
              <option value="DEACTIVATED">Deactivated only</option>
            </select>
            <button
              onClick={() => fetchProducts(page, filter, locationId || undefined)}
              disabled={loading || authStatus !== "ok"}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50"
              style={{ backgroundColor: BRAND_BLUE }}
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
            {error}
          </div>
        )}
        {opticonStatus === "fail" && opticonError && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
            <strong>Opticon EBS50:</strong> {opticonError}
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">Products</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {totalCount > 0
                    ? `Showing ${pageStart}-${pageEnd} of ${totalCount.toLocaleString()}${filter === "SELLABLE" ? " (sellable)" : ""}${locationId ? ` · ${locations.find((l) => l.id === locationId)?.name ?? "Location"}` : ""}`
                    : "Products from Treez"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => goToPage(1)}
                  disabled={page <= 1 || loading}
                  className="rounded border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  First
                </button>
                <button
                  onClick={() => goToPage(page - 1)}
                  disabled={page <= 1 || loading}
                  className="rounded border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  Prev
                </button>
                <span className="px-3 py-1.5 text-sm text-zinc-600">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= totalPages || loading}
                  className="rounded border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  Next
                </button>
                <button
                  onClick={() => goToPage(totalPages)}
                  disabled={page >= totalPages || loading}
                  className="rounded border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  Last
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div
                className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300"
                style={{ borderTopColor: BRAND_BLUE }}
              />
            </div>
          ) : products.length === 0 ? (
            <div className="py-24 text-center text-zinc-500">No products found.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50">
                      <th className="px-3 py-3 font-medium text-zinc-900">Name</th>
                      <th className="px-3 py-3 font-medium text-zinc-900">Status</th>
                      <th className="px-3 py-3 font-medium text-zinc-900">SKU</th>
                      <th className="px-3 py-3 font-medium text-zinc-900">Category</th>
                      <th className="px-3 py-3 font-medium text-zinc-900">Brand</th>
                      <th className="px-3 py-3 font-medium text-zinc-900">Size</th>
                      <th className="px-3 py-3 font-medium text-zinc-900">Price</th>
                      <th className="px-3 py-3 font-medium text-zinc-900">Tier</th>
                      <th className="px-3 py-3 font-medium text-zinc-900">Subtype</th>
                      <th className="px-3 py-3 font-medium text-zinc-900">Qty</th>
                      <th className="px-3 py-3 font-medium text-zinc-900">Min Visible</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p, i) => {
                      const d = getProductDisplay(p);
                      const pid = p.product_id;
                      return (
                        <tr
                          key={String(d.id) + "-" + i}
                          onClick={() => pid && openProductDetail(pid)}
                          className="cursor-pointer border-b border-zinc-100 transition hover:bg-zinc-50"
                        >
                          <td className="max-w-[200px] truncate px-3 py-2 font-medium text-zinc-900" title={d.name}>
                            {d.name}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                d.status === "ACTIVE"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : d.status === "DEACTIVATED"
                                    ? "bg-zinc-200 text-zinc-600"
                                    : "bg-zinc-100 text-zinc-600"
                              }`}
                            >
                              {d.status}
                            </span>
                          </td>
                          <td className="max-w-[120px] truncate px-3 py-2 text-zinc-600" title={d.sku}>
                            {d.sku}
                          </td>
                          <td className="px-3 py-2 text-zinc-600">{d.category}</td>
                          <td className="px-3 py-2 text-zinc-600">{d.brand}</td>
                          <td className="px-3 py-2 text-zinc-600">{d.size}</td>
                          <td className="px-3 py-2 text-zinc-600">
                            {typeof d.price === "number" ? `$${d.price}` : d.pricePerValue != null ? `$${d.pricePerValue}` : "-"}
                          </td>
                          <td className="max-w-[140px] truncate px-3 py-2 text-zinc-600" title={d.tierName}>
                            {d.tierName}
                          </td>
                          <td className="px-3 py-2 text-zinc-600">{d.subtype}</td>
                          <td className="px-3 py-2 text-zinc-600">{d.sellableQty}</td>
                          <td className="px-3 py-2 text-zinc-600">{d.minVisible}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-zinc-200 px-6 py-3">
                <p className="text-sm text-zinc-500">
                  {totalCount.toLocaleString()} total · {PAGE_SIZE} per page
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => goToPage(page - 1)}
                    disabled={page <= 1 || loading}
                    className="rounded border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => goToPage(page + 1)}
                    disabled={page >= totalPages || loading}
                    className="rounded border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {selectedProductId && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setSelectedProductId(null)}
          >
            <div
              className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
                <h3 className="text-lg font-semibold text-zinc-900">Product Details</h3>
                <button
                  onClick={() => setSelectedProductId(null)}
                  className="rounded p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
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
              ) : productDetail ? (
                <div className="mt-4 space-y-4">
                  <DetailSection title="Basic" data={productDetail} keys={["product_id", "product_status", "category_type", "sellable_quantity"]} />
                  {productDetail.product_configurable_fields && (
                    <DetailSection
                      title="Configurable Fields"
                      data={productDetail.product_configurable_fields as Record<string, unknown>}
                      keys={Object.keys(productDetail.product_configurable_fields)}
                    />
                  )}
                  {productDetail.pricing && (
                    <DetailSection
                      title="Pricing"
                      data={productDetail.pricing as Record<string, unknown>}
                      keys={["price_type", "price_sell", "tier_name", "tier_method", "tier_pricing_detail"]}
                    />
                  )}
                  {productDetail.product_barcodes && productDetail.product_barcodes.length > 0 && (
                    <div>
                      <h4 className="mb-2 font-medium text-zinc-700">Barcodes</h4>
                      <pre className="overflow-x-auto rounded bg-zinc-100 p-3 text-xs">
                        {JSON.stringify(productDetail.product_barcodes, null, 2)}
                      </pre>
                    </div>
                  )}
                  <div>
                    <h4 className="mb-2 font-medium text-zinc-700">Full Data</h4>
                    <pre className="max-h-64 overflow-auto rounded bg-zinc-100 p-3 text-xs">
                      {JSON.stringify(productDetail, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <p className="py-8 text-center text-zinc-500">Product not found.</p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function DetailSection({
  title,
  data,
  keys,
}: {
  title: string;
  data: Record<string, unknown>;
  keys: string[];
}) {
  const items = keys
    .map((k) => {
      const v = data[k];
      if (v === undefined || v === null) return null;
      return { key: k, value: v };
    })
    .filter(Boolean) as { key: string; value: unknown }[];

  if (items.length === 0) return null;

  return (
    <div>
      <h4 className="mb-2 font-medium text-zinc-700">{title}</h4>
      <dl className="grid gap-2 sm:grid-cols-2">
        {items.map(({ key, value }) => (
          <div key={key} className="rounded bg-zinc-50 px-3 py-2">
            <dt className="text-xs text-zinc-500">{key}</dt>
            <dd className="mt-0.5 font-medium text-zinc-900">
              {typeof value === "object" ? JSON.stringify(value) : String(value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
