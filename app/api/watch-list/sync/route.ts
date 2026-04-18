import { NextResponse } from "next/server";
import { readWatchList, writeWatchList } from "@/lib/watch-list";
import { fetchTreezProductById, getNestedValue, treezBrandForOpticonNotUsed } from "@/lib/treez";
import { opticonBrandPayload } from "@/lib/opticon-brand-field";
import { pushProductToEbs50 } from "@/lib/opticon";
import type { WatchListItem } from "@/lib/watch-list";
import type { TreezProduct } from "@/lib/treez";

const DEFAULT_MAPPINGS = [
  { treez: "product_id", opticon: "ProductId" },
  { treez: "product_barcodes[0].sku", opticon: "Barcode" },
  { treez: "product_configurable_fields.name", opticon: "Description" },
  { treez: "category_type", opticon: "Group" },
  { treez: "pricing.price_sell", opticon: "StandardPrice" },
  { treez: "pricing.price_sell", opticon: "SellPrice" },
  { treez: "product_configurable_fields.amount", opticon: "Content" },
  { treez: "product_configurable_fields.uom", opticon: "Unit" },
];

function productToOpticon(product: TreezProduct): Record<string, unknown> {
  const result: Record<string, unknown> = {
    NotUsed: "",
    ...opticonBrandPayload(treezBrandForOpticonNotUsed(product)),
  };
  for (const { treez: treezPath, opticon: opticonKey } of DEFAULT_MAPPINGS) {
    const val = getNestedValue(product, treezPath);
    if (val !== undefined && val !== null) {
      result[opticonKey] = typeof val === "number" ? String(val) : val;
    }
  }
  return result;
}

/** Run promises with concurrency limit */
async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;
  async function worker(): Promise<void> {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

/**
 * POST /api/watch-list/sync
 * Re-fetches all matched products from Treez and pushes current data to Opticon.
 * Updates lastSynced / lastSyncSuccess on each watch-list item.
 */
export async function POST() {
  try {
    const items = await readWatchList();
    const toSync = items.filter((i) => i.matchedProductId);

    if (toSync.length === 0) {
      return NextResponse.json(
        { success: false, error: "No matched products to sync. Run Match first." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const syncResults = await runWithConcurrency(toSync, 5, async (item: WatchListItem) => {
      try {
        const product = await fetchTreezProductById(item.matchedProductId!);
        if (!product) {
          return { item, success: false, error: "Not found in Treez" };
        }
        const opticonProduct = productToOpticon(product);
        const result = await pushProductToEbs50(opticonProduct);
        return { item, success: result.success, error: result.error };
      } catch (err) {
        return { item, success: false, error: err instanceof Error ? err.message : "Error" };
      }
    });

    // Update the full items list with sync results
    const resultMap = new Map(syncResults.map((r) => [r.item.id, r]));
    const updatedItems = items.map((item) => {
      const result = resultMap.get(item.id);
      if (!result) return item;
      return {
        ...item,
        lastSynced: now,
        lastSyncSuccess: result.success,
        lastSyncError: result.success ? undefined : result.error,
      };
    });

    await writeWatchList(updatedItems);

    const synced = syncResults.filter((r) => r.success).length;
    const failed = syncResults.filter((r) => !r.success).length;

    return NextResponse.json({
      success: true,
      synced,
      failed,
      total: toSync.length,
      failedDetails: syncResults
        .filter((r) => !r.success)
        .map((r) => ({ brand: r.item.brand, id: r.item.matchedProductId, error: r.error })),
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
