"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface ProductSnapshot {
  id: string;
  treez_product_id: string;
  opticon_barcode: string;
  product_name: string;
  price: number;
  barcode: string;
  category: string;
  size: string;
  unit: string;
  last_checked_at: string;
  last_updated_at: string;
}

interface ProductChange {
  id: string;
  treez_product_id: string;
  change_type: string;
  old_value: string;
  new_value: string;
  detected_at: string;
  synced_to_opticon: boolean;
}

interface ChangeWithProduct extends ProductChange {
  product_name?: string;
}

export default function MonitorPage() {
  const [products, setProducts] = useState<ProductSnapshot[]>([]);
  const [changes, setChanges] = useState<ChangeWithProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(5); // minutes
  const [bgMonitoringActive, setBgMonitoringActive] = useState(true); // Always true since middleware starts it

  useEffect(() => {
    if (!supabase) {
      setError('Supabase not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local');
      setLoading(false);
      return;
    }
    
    fetchData();
    
    // Setup real-time subscription
    const channel = supabase
      .channel('product-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'product_changes' },
        () => {
          console.log('Real-time change detected, refreshing...');
          fetchData();
        }
      )
      .subscribe();

    // Cleanup on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(() => {
        checkForChanges();
      }, refreshInterval * 60 * 1000);
    }
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  const [uploadStatus, setUploadStatus] = useState<Record<string, "idle" | "syncing" | "success" | "error">>({});

  const syncToOpticon = async (changeId: string, productName: string) => {
    setUploadStatus(prev => ({ ...prev, [changeId]: "syncing" }));

    try {
      const res = await fetch('/api/products/sync-to-opticon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changeId }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Sync failed');
      }

      setUploadStatus(prev => ({ ...prev, [changeId]: "success" }));
      
      // Refresh data to show updated sync status
      setTimeout(() => {
        fetchData();
        setUploadStatus(prev => ({ ...prev, [changeId]: "idle" }));
      }, 2000);

    } catch (error) {
      console.error('Sync error:', error);
      setUploadStatus(prev => ({ ...prev, [changeId]: "error" }));
      setError(error instanceof Error ? error.message : 'Sync failed');
      
      setTimeout(() => {
        setUploadStatus(prev => ({ ...prev, [changeId]: "idle" }));
      }, 3000);
    }
  };

  const fetchData = async () => {
    if (!supabase) {
      setError('Supabase not configured. Add credentials to .env.local');
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      // Fetch products
      const { data: productsData, error: productsError } = await supabase
        .from('product_snapshots')
        .select('*')
        .order('product_name');

      if (productsError) throw productsError;
      setProducts(productsData || []);

      // Fetch recent changes
      const { data: changesData, error: changesError } = await supabase
        .from('product_changes')
        .select('*')
        .order('detected_at', { ascending: false })
        .limit(50);

      if (changesError) throw changesError;

      // Enrich changes with product names
      const enrichedChanges = (changesData || []).map((change: any) => {
        const product = productsData?.find((p: any) => p.treez_product_id === change.treez_product_id);
        return {
          ...change,
          product_name: product?.product_name,
        };
      });

      setChanges(enrichedChanges);
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const syncProducts = async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch('/api/products/sync-snapshot', { method: 'POST' });
      const data = await res.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Sync failed');
      }

      alert(`✓ Synced ${data.results.synced} products. Failed: ${data.results.failed}`);
      fetchData();
    } catch (err) {
      console.error('Sync error:', err);
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const checkForChanges = async () => {
    setChecking(true);
    setError(null);
    try {
      const res = await fetch('/api/products/check-changes', { method: 'POST' });
      const data = await res.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Check failed');
      }

      setLastCheck(new Date());
      
      if (data.results.totalChanges > 0) {
        alert(`🔔 Found ${data.results.totalChanges} change(s) in ${data.results.changed} product(s)!`);
      } else {
        alert('✓ No changes detected');
      }
      
      fetchData();
    } catch (err) {
      console.error('Check error:', err);
      setError(err instanceof Error ? err.message : 'Check failed');
    } finally {
      setChecking(false);
    }
  };

  const getChangeIcon = (type: string) => {
    switch (type) {
      case 'price': return '💰';
      case 'name': return '📝';
      case 'barcode': return '🔖';
      case 'category': return '📁';
      case 'size': return '📏';
      default: return '🔄';
    }
  };

  const getChangeColor = (type: string) => {
    switch (type) {
      case 'price': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'name': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center py-12">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-2">Product Change Monitor</h1>
          <p className="text-gray-600">
            Real-time tracking of product changes from Treez
          </p>
          <div className="flex items-center gap-3 mt-2">
            {bgMonitoringActive && (
              <span className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                Background Monitor Active (1 min)
              </span>
            )}
            {lastCheck && (
              <p className="text-sm text-gray-500">
                Last checked: {lastCheck.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={syncProducts}
            disabled={syncing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 text-sm font-medium"
          >
            {syncing ? 'Syncing...' : 'Sync Products from Treez'}
          </button>
          <button
            onClick={checkForChanges}
            disabled={checking}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 text-sm font-medium"
          >
            {checking ? 'Checking...' : 'Check for Changes'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          Error: {error}
        </div>
      )}

      {/* Auto-refresh controls */}
      <div className="bg-white rounded-lg border p-4 flex items-center gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            className="rounded"
          />
          <span className="text-sm font-medium">Auto-refresh</span>
        </label>
        {autoRefresh && (
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            className="text-sm border rounded px-2 py-1"
          >
            <option value={1}>Every 1 min</option>
            <option value={5}>Every 5 min</option>
            <option value={10}>Every 10 min</option>
            <option value={30}>Every 30 min</option>
          </select>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-600">Total Products</div>
          <div className="text-2xl font-bold">{products.length}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-600">Total Changes</div>
          <div className="text-2xl font-bold">{changes.length}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-600">Synced to Supabase</div>
          <div className="text-2xl font-bold text-green-600">{changes.length}</div>
          <div className="text-xs text-gray-500 mt-1">All changes logged</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-600">Pending on Opticon</div>
          <div className="text-2xl font-bold text-orange-600">
            {changes.filter(c => !c.synced_to_opticon).length}
          </div>
          <div className="text-xs text-gray-500 mt-1">Not synced yet</div>
        </div>
      </div>

      {/* Recent Changes */}
      <div className="bg-white rounded-lg border">
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-semibold">Recent Changes (Last 50)</h2>
        </div>
        <div className="divide-y">
          {changes.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              No changes detected yet. Click "Check for Changes" to start monitoring.
            </div>
          ) : (
            changes.map((change) => {
              const syncStatus = uploadStatus[change.id] || "idle";
              
              return (
              <div key={change.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{getChangeIcon(change.change_type)}</span>
                      <span className="font-semibold">{change.product_name || change.treez_product_id}</span>
                      <span className={`text-xs px-2 py-0.5 rounded border ${getChangeColor(change.change_type)}`}>
                        {change.change_type}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-800 border border-green-300">
                        ✓ Synced to Supabase
                      </span>
                      {!change.synced_to_opticon && syncStatus === "idle" && (
                        <span className="text-xs px-2 py-0.5 rounded bg-orange-100 text-orange-800 border border-orange-300">
                          ⏳ Pending on Opticon
                        </span>
                      )}
                      {change.synced_to_opticon && (
                        <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-300">
                          ✓ Synced to Opticon
                        </span>
                      )}
                      {syncStatus === "syncing" && (
                        <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-300 animate-pulse">
                          🔄 Syncing...
                        </span>
                      )}
                      {syncStatus === "success" && (
                        <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-800 border border-green-300">
                          ✓ Just Synced!
                        </span>
                      )}
                      {syncStatus === "error" && (
                        <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-300">
                          ✗ Sync Failed
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">
                      <span className="line-through">{change.old_value}</span>
                      {' → '}
                      <span className="font-medium text-gray-900">{change.new_value}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Detected: {new Date(change.detected_at).toLocaleString()}
                      {change.synced_to_opticon && change.synced_at && (
                        <> • Synced to Opticon: {new Date(change.synced_at).toLocaleString()}</>
                      )}
                    </div>
                  </div>
                  {!change.synced_to_opticon && (
                    <button
                      onClick={() => syncToOpticon(change.id, change.product_name || 'Product')}
                      disabled={syncStatus === "syncing"}
                      className="ml-4 px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {syncStatus === "syncing" ? "Syncing..." : "Sync to Opticon"}
                    </button>
                  )}
                </div>
              </div>
            )})
          )}
        </div>
      </div>

      {/* Products List */}
      <div className="bg-white rounded-lg border">
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-semibold">Monitored Products ({products.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left font-medium">Product Name</th>
                <th className="px-6 py-3 text-left font-medium">Price</th>
                <th className="px-6 py-3 text-left font-medium">Category</th>
                <th className="px-6 py-3 text-left font-medium">Size</th>
                <th className="px-6 py-3 text-left font-medium">Opticon Barcode</th>
                <th className="px-6 py-3 text-left font-medium">Last Checked</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3">{product.product_name}</td>
                  <td className="px-6 py-3 font-mono">${product.price}</td>
                  <td className="px-6 py-3">{product.category}</td>
                  <td className="px-6 py-3">{product.size} {product.unit}</td>
                  <td className="px-6 py-3 font-mono text-xs">{product.opticon_barcode}</td>
                  <td className="px-6 py-3 text-xs text-gray-500">
                    {new Date(product.last_checked_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
