"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";

const BRAND_BLUE = "#1F2B44";
const LOGO_URL = "https://cdn.prod.website-files.com/67ee6c6b271e5a2294abc43e/6814932c8fdab74d7cd6845d_Group%201577708998.webp";

type OpticonProduct = Record<string, unknown>;

export default function OpticonAdminPage() {
  const [products, setProducts] = useState<OpticonProduct[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"checking" | "ok" | "fail">("checking");
  const [selectedProduct, setSelectedProduct] = useState<OpticonProduct | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/opticon/products");
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to fetch products");
      }
      setProducts(data.products ?? []);
      setColumns(data.columns ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products");
      setProducts([]);
      setColumns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkConnection = useCallback(async () => {
    try {
      const res = await fetch("/api/opticon");
      const data = await res.json();
      setConnectionStatus(data.success && data.authenticated ? "ok" : "fail");
    } catch {
      setConnectionStatus("fail");
    }
  }, []);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  useEffect(() => {
    if (connectionStatus === "ok") fetchProducts();
  }, [connectionStatus, fetchProducts]);

  const getCellValue = (product: OpticonProduct, key: string): string => {
    const v = product[key];
    if (v === undefined || v === null) return "-";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      <header
        className="border-b border-zinc-200 bg-white px-6 py-4"
        style={{ borderBottomColor: "rgba(31,43,68,0.1)" }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="flex items-center gap-4">
              <Image
                src={LOGO_URL}
                alt="Perfect Union"
                width={140}
                height={40}
                className="h-10 w-auto object-contain"
                unoptimized
              />
            </Link>
            <div>
              <h1 className="text-lg font-semibold text-zinc-900">Opticon Admin</h1>
              <p className="text-sm text-zinc-500">EBS50 product table</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm ${
                connectionStatus === "ok"
                  ? "bg-emerald-100 text-emerald-800"
                  : connectionStatus === "fail"
                    ? "bg-red-100 text-red-800"
                    : "bg-zinc-200 text-zinc-600"
              }`}
              title="EBS50 connection"
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  connectionStatus === "ok" ? "bg-emerald-500" : connectionStatus === "fail" ? "bg-red-500" : "animate-pulse bg-zinc-400"
                }`}
              />
              {connectionStatus === "ok" ? "Connected" : connectionStatus === "fail" ? "Disconnected" : "Checking..."}
            </span>
            <Link
              href="/admin"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              ← Treez Admin
            </Link>
            <button
              onClick={() => fetchProducts()}
              disabled={loading || connectionStatus !== "ok"}
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

        {connectionStatus !== "ok" && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
            Connect to EBS50 first. Ensure the app runs on the same network as the EBS50 and check .env.local (EBS50_BASE_URL, EBS50_API_KEY).
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">Products in EBS50</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {products.length > 0
                    ? `${products.length.toLocaleString()} product(s) · ${columns.length} column(s)`
                    : "Product table structure from EBS50"}
                </p>
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
            <div className="py-24 text-center text-zinc-500">
              {connectionStatus === "ok"
                ? "No products in EBS50. Configure the product table in EBS50 or run a sync."
                : "Connect to EBS50 to view products."}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50">
                      {columns.map((col) => (
                        <th key={col} className="max-w-[180px] truncate px-3 py-3 font-medium text-zinc-900" title={col}>
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p, i) => (
                      <tr
                        key={i}
                        onClick={() => setSelectedProduct(p)}
                        className="cursor-pointer border-b border-zinc-100 transition hover:bg-zinc-50"
                      >
                        {columns.map((col) => (
                          <td
                            key={col}
                            className="max-w-[180px] truncate px-3 py-2 text-zinc-600"
                            title={getCellValue(p, col)}
                          >
                            {getCellValue(p, col)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

      </main>

      {selectedProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
              <h3 className="text-lg font-semibold text-zinc-900">Product meta</h3>
              <button
                onClick={() => setSelectedProduct(null)}
                className="rounded p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
              >
                ✕
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <dl className="grid gap-2 sm:grid-cols-2">
                {Object.entries(selectedProduct).map(([key, value]) => (
                  <div key={key} className="rounded bg-zinc-50 px-3 py-2">
                    <dt className="text-xs text-zinc-500">{key}</dt>
                    <dd className="mt-0.5 font-medium text-zinc-900 break-all">
                      {typeof value === "object" ? JSON.stringify(value) : String(value ?? "-")}
                    </dd>
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
          </div>
        </div>
      )}
    </div>
  );
}
