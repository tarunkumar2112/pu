"use client";

import { useState, useEffect, useCallback } from "react";

const BRAND_BLUE = "#1F2B44";

type OpticonProduct = Record<string, unknown>;

export default function OpticonAdminPage() {
  const [products, setProducts] = useState<OpticonProduct[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"checking" | "ok" | "fail">("checking");
  const [selectedProduct, setSelectedProduct] = useState<OpticonProduct | null>(null);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushResult, setPushResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [testProduct, setTestProduct] = useState(`{
  "NotUsed": "",
  "ProductId": "001",
  "Barcode": "3083680012256",
  "Description": "BONDUELLE CARROTS ",
  "Group": "93",
  "StandardPrice": "0,95",
  "SellPrice": "0,89",
  "Discount": "",
  "Content": "180",
  "Unit": "GR"
}`);

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

  const handlePushProduct = async () => {
    setPushLoading(true);
    setPushResult(null);
    try {
      const parsed = JSON.parse(testProduct) as Record<string, unknown>;
      const res = await fetch("/api/opticon/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      setPushResult(
        data.success ? { ok: true, msg: "Product pushed successfully" } : { ok: false, msg: data.error ?? "Failed" }
      );
      if (data.success) fetchProducts();
    } catch (err) {
      setPushResult({
        ok: false,
        msg: err instanceof Error ? err.message : "Invalid JSON or request failed",
      });
    } finally {
      setPushLoading(false);
    }
  };

  const StatusBadge = () => (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${
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
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-zinc-900">Opticon Products</h1>
        <div className="flex items-center gap-4">
          <StatusBadge />
          <button
            onClick={() => fetchProducts()}
            disabled={loading || connectionStatus !== "ok"}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50 hover:opacity-90"
            style={{ backgroundColor: BRAND_BLUE }}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      <div>
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

        <div className="mb-8 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Manual product upload (test)</h2>
          <p className="mt-1 text-sm text-zinc-500">Paste JSON and POST to EBS50 ChangeProducts</p>
          <textarea
            value={testProduct}
            onChange={(e) => setTestProduct(e.target.value)}
            className="mt-4 w-full rounded-lg border border-zinc-300 p-3 font-mono text-sm"
            rows={14}
            spellCheck={false}
          />
          <div className="mt-4 flex items-center gap-4">
            <button
              onClick={handlePushProduct}
              disabled={pushLoading || connectionStatus !== "ok"}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: BRAND_BLUE }}
            >
              {pushLoading ? "Pushing..." : "POST product"}
            </button>
            {pushResult && (
              <span className={`text-sm font-medium ${pushResult.ok ? "text-emerald-600" : "text-red-600"}`}>
                {pushResult.msg}
              </span>
            )}
          </div>
        </div>

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
      </div>

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
