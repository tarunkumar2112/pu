"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const BRAND_BLUE = "#1F2B44";

export default function DashboardPage() {
  const [treezStatus, setTreezStatus] = useState<"checking" | "ok" | "fail">("checking");
  const [opticonStatus, setOpticonStatus] = useState<"checking" | "ok" | "fail" | "not_configured">("checking");
  const [treezCount, setTreezCount] = useState<number | null>(null);
  const [opticonCount, setOpticonCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => setTreezStatus(d.success ? "ok" : "fail"))
      .catch(() => setTreezStatus("fail"));
  }, []);

  useEffect(() => {
    fetch("/api/opticon")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.authenticated) setOpticonStatus("ok");
        else if (d.error?.toLowerCase().includes("not set")) setOpticonStatus("not_configured");
        else setOpticonStatus("fail");
      })
      .catch(() => setOpticonStatus("fail"));
  }, []);

  useEffect(() => {
    if (treezStatus === "ok") {
      fetch("/api/products?page=1&filter=SELLABLE")
        .then((r) => r.json())
        .then((d) => setTreezCount(d.total_count ?? null))
        .catch(() => {});
    }
  }, [treezStatus]);

  useEffect(() => {
    if (opticonStatus === "ok") {
      fetch("/api/opticon/products")
        .then((r) => r.json())
        .then((d) => setOpticonCount(d.success && Array.isArray(d.products) ? d.products.length : null))
        .catch(() => {});
    }
  }, [opticonStatus]);

  const StatusBadge = ({ status }: { status: string }) => {
    const ok = status === "ok";
    const fail = status === "fail";
    const warn = status === "not_configured";
    return (
      <span
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${
          ok ? "bg-emerald-100 text-emerald-800" : fail ? "bg-red-100 text-red-800" : warn ? "bg-amber-100 text-amber-800" : "bg-zinc-200 text-zinc-600"
        }`}
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Dashboard</h1>
        <p className="mt-1 text-zinc-600">Overview of connections and product counts</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Treez</h2>
              <p className="mt-1 text-sm text-zinc-500">Product source (POS)</p>
            </div>
            <StatusBadge status={treezStatus} />
          </div>
          {treezCount != null && (
            <p className="mt-4 text-2xl font-bold text-zinc-900">{treezCount.toLocaleString()} products</p>
          )}
          <Link
            href="/admin/treez"
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium"
            style={{ color: BRAND_BLUE }}
          >
            View Treez Products →
          </Link>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Opticon EBS50</h2>
              <p className="mt-1 text-sm text-zinc-500">ESL labels (destination)</p>
            </div>
            <StatusBadge status={opticonStatus} />
          </div>
          {opticonCount != null && (
            <p className="mt-4 text-2xl font-bold text-zinc-900">{opticonCount.toLocaleString()} products</p>
          )}
          <Link
            href="/admin/opticon"
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium"
            style={{ color: BRAND_BLUE }}
          >
            View Opticon Products →
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Sync</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Map Treez products to Opticon format and sync in batches
        </p>
        <Link
          href="/admin/sync"
          className="mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: BRAND_BLUE }}
        >
          Open Sync →
        </Link>
      </div>
    </div>
  );
}
