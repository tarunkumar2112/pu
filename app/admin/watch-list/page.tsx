"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { WatchListItem } from "@/lib/watch-list";

const BRAND_BLUE = "#1F2B44";

type Tab = "all" | "matched" | "unmatched" | "failed";
type AutoSyncInterval = 5 | 10 | 15 | 30 | 60;

export default function WatchListPage() {
  const [items, setItems] = useState<WatchListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pasteText, setPasteText] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [parseLoading, setParseLoading] = useState(false);
  const [matchLoading, setMatchLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [autoSync, setAutoSync] = useState(false);
  const [autoInterval, setAutoInterval] = useState<AutoSyncInterval>(15);
  const [nextSyncIn, setNextSyncIn] = useState<number>(0);
  const [treezOk, setTreezOk] = useState<boolean | null>(null);
  const [opticonOk, setOpticonOk] = useState<boolean | null>(null);
  const autoSyncRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showMsg = (ok: boolean, text: string) => {
    setMessage({ ok, text });
    setTimeout(() => setMessage(null), 6000);
  };

  const loadItems = useCallback(async () => {
    try {
      const res = await fetch("/api/watch-list");
      const data = await res.json();
      if (data.success) setItems(data.items ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => setTreezOk(d.success))
      .catch(() => setTreezOk(false));
    fetch("/api/opticon")
      .then((r) => r.json())
      .then((d) => setOpticonOk(d.success && d.authenticated))
      .catch(() => setOpticonOk(false));
  }, [loadItems]);

  // Auto-sync logic
  const runSync = useCallback(async (silent = false) => {
    if (syncLoading) return;
    setSyncLoading(true);
    try {
      const res = await fetch("/api/watch-list/sync", { method: "POST" });
      const data = await res.json();
      await loadItems();
      if (!silent) {
        if (data.success) {
          showMsg(data.failed === 0, `Synced ${data.synced} products${data.failed > 0 ? `, ${data.failed} failed` : ""}.`);
        } else {
          showMsg(false, data.error ?? "Sync failed");
        }
      }
    } catch (err) {
      if (!silent) showMsg(false, err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncLoading(false);
    }
  }, [syncLoading, loadItems]);

  useEffect(() => {
    if (autoSync) {
      const intervalMs = autoInterval * 60 * 1000;
      setNextSyncIn(autoInterval * 60);

      autoSyncRef.current = setInterval(() => {
        runSync(true);
        setNextSyncIn(autoInterval * 60);
      }, intervalMs);

      countdownRef.current = setInterval(() => {
        setNextSyncIn((n) => Math.max(0, n - 1));
      }, 1000);
    } else {
      if (autoSyncRef.current) clearInterval(autoSyncRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    }
    return () => {
      if (autoSyncRef.current) clearInterval(autoSyncRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [autoSync, autoInterval, runSync]);

  const handleParse = async () => {
    if (!pasteText.trim()) return;
    setParseLoading(true);
    try {
      const res = await fetch("/api/watch-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pasteText }),
      });
      const data = await res.json();
      if (data.success) {
        setItems(data.items ?? []);
        setShowPaste(false);
        setPasteText("");
        showMsg(true, `Saved ${data.count} products to watch list.`);
      } else {
        showMsg(false, data.error ?? "Failed to parse");
      }
    } catch (err) {
      showMsg(false, err instanceof Error ? err.message : "Failed");
    } finally {
      setParseLoading(false);
    }
  };

  const handleMatch = async () => {
    setMatchLoading(true);
    try {
      const res = await fetch("/api/watch-list/match", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setItems(data.items ?? []);
        showMsg(
          true,
          `Matched ${data.matched} of ${data.total} products against ${data.totalTreezProducts} Treez products. ${data.unmatched} unmatched.`
        );
      } else {
        showMsg(false, data.error ?? "Match failed");
      }
    } catch (err) {
      showMsg(false, err instanceof Error ? err.message : "Match failed");
    } finally {
      setMatchLoading(false);
    }
  };

  const handleClear = async () => {
    if (!confirm("Clear the entire watch list?")) return;
    await fetch("/api/watch-list", { method: "DELETE" });
    setItems([]);
    showMsg(true, "Watch list cleared.");
  };

  const filteredItems = items.filter((item) => {
    if (tab === "matched") return !!item.matchedProductId;
    if (tab === "unmatched") return !item.matchedProductId;
    if (tab === "failed") return item.lastSynced && !item.lastSyncSuccess;
    return true;
  });

  const matched = items.filter((i) => i.matchedProductId).length;
  const synced = items.filter((i) => i.lastSyncSuccess).length;
  const failed = items.filter((i) => i.lastSynced && !i.lastSyncSuccess).length;
  const canSync = treezOk && opticonOk && matched > 0;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  const StatusDot = ({ ok }: { ok: boolean | null }) => (
    <span
      className={`h-2 w-2 rounded-full ${ok === true ? "bg-emerald-500" : ok === false ? "bg-red-500" : "animate-pulse bg-zinc-400"}`}
    />
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Watch List</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Products synced automatically from Treez → Opticon ESL labels
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
            <StatusDot ok={treezOk} /> Treez
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
            <StatusDot ok={opticonOk} /> Opticon
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total", value: items.length, color: "text-zinc-900" },
          { label: "Matched", value: matched, color: "text-emerald-700" },
          { label: "Synced OK", value: synced, color: "text-blue-700" },
          { label: "Sync Failed", value: failed, color: "text-red-700" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-zinc-500">{label}</p>
            <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <button
          onClick={() => setShowPaste((v) => !v)}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          {showPaste ? "Hide paste" : "📋 Paste product list"}
        </button>

        <button
          onClick={handleMatch}
          disabled={matchLoading || items.length === 0 || treezOk !== true}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:opacity-90 transition"
          style={{ backgroundColor: BRAND_BLUE }}
        >
          {matchLoading ? "Matching…" : "🔗 Match with Treez"}
        </button>

        <button
          onClick={() => runSync(false)}
          disabled={!canSync || syncLoading}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:opacity-90 transition"
          style={{ backgroundColor: "#16a34a" }}
        >
          {syncLoading ? "Syncing…" : `⟳ Sync now (${matched})`}
        </button>

        {/* Auto-sync toggle */}
        <div className="flex items-center gap-2 ml-auto">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-zinc-700">
            <span>Auto-sync</span>
            <button
              role="switch"
              aria-checked={autoSync}
              onClick={() => setAutoSync((v) => !v)}
              disabled={!canSync}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition disabled:opacity-40 ${autoSync ? "bg-emerald-500" : "bg-zinc-300"}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${autoSync ? "translate-x-6" : "translate-x-1"}`}
              />
            </button>
          </label>
          {autoSync && (
            <>
              <select
                value={autoInterval}
                onChange={(e) => setAutoInterval(Number(e.target.value) as AutoSyncInterval)}
                className="rounded border border-zinc-300 px-2 py-1 text-xs"
              >
                {([5, 10, 15, 30, 60] as AutoSyncInterval[]).map((v) => (
                  <option key={v} value={v}>{v} min</option>
                ))}
              </select>
              <span className="text-xs text-zinc-500">Next: {formatTime(nextSyncIn)}</span>
            </>
          )}
        </div>

        {items.length > 0 && (
          <button
            onClick={handleClear}
            className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Clear
          </button>
        )}
      </div>

      {/* Paste section */}
      {showPaste && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-zinc-900">Paste product list</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Copy from Excel and paste below. Columns: Brand · Product Type · Subtype · Size · Unit Price
          </p>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={"Brand\tProduct Type\tSubtype\tSize\tUnit Price\n530 GROWER\tBEVERAGE\tSODA\t100 MG\t$13.50"}
            className="mt-3 w-full rounded-lg border border-zinc-300 p-3 font-mono text-xs"
            rows={10}
            spellCheck={false}
          />
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={handleParse}
              disabled={parseLoading || !pasteText.trim()}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:opacity-90"
              style={{ backgroundColor: BRAND_BLUE }}
            >
              {parseLoading ? "Saving…" : "Save list"}
            </button>
            <button
              onClick={() => { setShowPaste(false); setPasteText(""); }}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Message banner */}
      {message && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm font-medium ${
            message.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Helper message when no match yet */}
      {!matchLoading && items.length > 0 && matched === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Watch list loaded with {items.length} items but none are matched yet.{" "}
          Click <strong>Match with Treez</strong> to find the products.
        </div>
      )}

      {/* Products table */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        {/* Tabs */}
        <div className="flex border-b border-zinc-200">
          {(
            [
              { key: "all", label: `All (${items.length})` },
              { key: "matched", label: `Matched (${matched})` },
              { key: "unmatched", label: `Unmatched (${items.length - matched})` },
              { key: "failed", label: `Failed (${failed})` },
            ] as { key: Tab; label: string }[]
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-3 text-sm font-medium transition ${
                tab === key
                  ? "border-b-2 text-zinc-900"
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
              style={tab === key ? { borderBottomColor: BRAND_BLUE, color: BRAND_BLUE } : undefined}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-24">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300"
              style={{ borderTopColor: BRAND_BLUE }}
            />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-24 text-center text-zinc-500">
            {items.length === 0
              ? "No products yet. Click \"Paste product list\" to get started."
              : "No items in this filter."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <th className="px-3 py-3 font-medium text-zinc-900">Brand</th>
                  <th className="px-3 py-3 font-medium text-zinc-900">Type</th>
                  <th className="px-3 py-3 font-medium text-zinc-900">Subtype</th>
                  <th className="px-3 py-3 font-medium text-zinc-900">Size</th>
                  <th className="px-3 py-3 font-medium text-zinc-900">Price</th>
                  <th className="px-3 py-3 font-medium text-zinc-900">Status</th>
                  <th className="px-3 py-3 font-medium text-zinc-900">Matched Product</th>
                  <th className="px-3 py-3 font-medium text-zinc-900">Last Sync</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const isMatched = !!item.matchedProductId;
                  const syncOk = item.lastSyncSuccess === true;
                  const syncFail = item.lastSynced && !item.lastSyncSuccess;

                  return (
                    <tr key={item.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                      <td className="px-3 py-2 font-medium text-zinc-900">{item.brand}</td>
                      <td className="px-3 py-2 text-zinc-600">{item.productType}</td>
                      <td className="px-3 py-2 text-zinc-600">{item.subtype}</td>
                      <td className="px-3 py-2 text-zinc-600">{item.size}</td>
                      <td className="px-3 py-2 text-zinc-600">${item.price.toFixed(2)}</td>
                      <td className="px-3 py-2">
                        {syncOk ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Synced
                          </span>
                        ) : syncFail ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800"
                            title={item.lastSyncError}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Failed
                          </span>
                        ) : isMatched ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Matched
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                            <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" /> Unmatched
                          </span>
                        )}
                      </td>
                      <td className="max-w-[200px] truncate px-3 py-2 text-zinc-600" title={item.matchedProductName}>
                        {item.matchedProductName
                          ? item.matchedProductName
                          : item.matchedProductId
                            ? item.matchedProductId
                            : <span className="text-zinc-400">—</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-zinc-500">
                        {item.lastSynced
                          ? new Date(item.lastSynced).toLocaleString()
                          : <span className="text-zinc-400">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {autoSync && (
        <p className="text-xs text-zinc-500">
          Auto-sync is active — keep this page open. Next sync in {formatTime(nextSyncIn)}.
        </p>
      )}
    </div>
  );
}
