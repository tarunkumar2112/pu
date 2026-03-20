import { NextRequest, NextResponse } from "next/server";
import { fetchTreezProductById, getNestedValue } from "@/lib/treez";
import { pushProductToEbs50 } from "@/lib/opticon";
import type { TreezProduct } from "@/lib/treez";

export interface SyncMapping {
  treez: string;
  opticon: string;
}

function treezToOpticon(
  product: TreezProduct,
  mappings: SyncMapping[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const { treez: treezPath, opticon: opticonKey } of mappings) {
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
      const r = await fn(items[i]);
      results[i] = r;
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * POST /api/sync
 * Body: { productIds: string[]; mappings: SyncMapping[]; batchSize?: number }
 * Fetches Treez products by IDs (one-by-one for reliability), transforms using mappings, pushes to Opticon.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const productIds = Array.isArray(body.productIds) ? body.productIds as string[] : [];
    const mappings = Array.isArray(body.mappings) ? body.mappings as SyncMapping[] : [];
    const concurrency = Math.min(10, Math.max(1, parseInt(String(body.batchSize ?? 10), 10) || 10));

    if (productIds.length === 0) {
      return NextResponse.json({ success: false, error: "No product IDs provided" }, { status: 400 });
    }
    if (mappings.length === 0) {
      return NextResponse.json({ success: false, error: "No field mappings provided" }, { status: 400 });
    }

    const synced: string[] = [];
    const failed: { id: string; error: string }[] = [];

    const fetchResults = await runWithConcurrency(
      productIds,
      concurrency,
      async (id) => {
        const product = await fetchTreezProductById(id);
        return { id, product };
      }
    );

    for (const { id, product } of fetchResults) {
      if (!product) {
        failed.push({ id, error: "Product not found in Treez" });
        continue;
      }

      const opticonProduct = treezToOpticon(product, mappings);
      const result = await pushProductToEbs50(opticonProduct);
      if (result.success) {
        synced.push(id);
      } else {
        failed.push({ id, error: result.error ?? "Unknown error" });
      }
    }

    return NextResponse.json({
      success: true,
      synced: synced.length,
      failed: failed.length,
      syncedIds: synced,
      failedDetails: failed,
    });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Sync failed",
      },
      { status: 500 }
    );
  }
}
