import { NextRequest, NextResponse } from "next/server";
import { fetchTreezProducts, getNestedValue } from "@/lib/treez";
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

/**
 * POST /api/sync
 * Body: { productIds: string[]; mappings: SyncMapping[]; batchSize?: number }
 * Fetches Treez products by IDs, transforms using mappings, pushes to Opticon.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const productIds = Array.isArray(body.productIds) ? body.productIds as string[] : [];
    const mappings = Array.isArray(body.mappings) ? body.mappings as SyncMapping[] : [];
    const batchSize = Math.min(200, Math.max(10, parseInt(String(body.batchSize ?? 50), 10) || 50));

    if (productIds.length === 0) {
      return NextResponse.json({ success: false, error: "No product IDs provided" }, { status: 400 });
    }
    if (mappings.length === 0) {
      return NextResponse.json({ success: false, error: "No field mappings provided" }, { status: 400 });
    }

    const synced: string[] = [];
    const failed: { id: string; error: string }[] = [];

    // Treez API accepts up to 50 IDs per request; fetch in batches
    const idBatches: string[][] = [];
    for (let i = 0; i < productIds.length; i += 50) {
      idBatches.push(productIds.slice(i, i + 50));
    }

    for (const idBatch of idBatches) {
      const idsParam = idBatch.join(",");
      const products = await fetchTreezProducts({
        ID: idsParam,
        active: "ALL",
        above_threshold: false,
      });

      const productMap = new Map<string, TreezProduct>();
      for (const p of products) {
        const id = p.product_id ?? p.productId;
        if (id != null) productMap.set(String(id), p);
      }

      for (const id of idBatch) {
        const product = productMap.get(id);
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
