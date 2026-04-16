import { NextResponse } from "next/server";
import { fetchTreezProductById } from "@/lib/treez";
import { extractProductSnapshot, saveProductSnapshot, getAllSnapshots } from "@/lib/change-detector";
import fs from "fs";
import path from "path";

/**
 * GET /api/products/sync-snapshot
 * Fetch all product snapshots from Supabase
 */
export async function GET() {
  try {
    const snapshots = await getAllSnapshots();
    
    return NextResponse.json({
      success: true,
      snapshots: snapshots,
      total: snapshots.length,
    });
  } catch (error) {
    console.error('[Sync Snapshot GET] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch snapshots",
      snapshots: [],
    }, { status: 500 });
  }
}

/**
 * Sync products from product-ids.json to Supabase
 * POST /api/products/sync-snapshot
 */
export async function POST() {
  try {
    console.log('\n========================================');
    console.log('[Sync Snapshot] Starting initial sync from Treez to Supabase');
    console.log('========================================\n');

    // Read product IDs from config file
    const configPath = path.join(process.cwd(), "product-ids.json");
    let productIds: string[] = [];
    
    try {
      const fileContent = fs.readFileSync(configPath, "utf-8");
      const config = JSON.parse(fileContent);
      productIds = config.productIds || [];
    } catch (error) {
      console.error('[Sync] Could not read product-ids.json:', error);
      return NextResponse.json({
        success: false,
        error: "Could not read product-ids.json",
      }, { status: 500 });
    }

    if (productIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No product IDs configured in product-ids.json",
      }, { status: 400 });
    }

    console.log(`[Sync] Found ${productIds.length} product IDs to sync`);

    const results = {
      total: productIds.length,
      synced: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Fetch and save each product
    for (let i = 0; i < productIds.length; i++) {
      const productId = productIds[i];
      console.log(`\n[Sync] Processing ${i + 1}/${productIds.length}: ${productId}`);

      try {
        // Fetch from Treez
        const product = await fetchTreezProductById(productId);
        
        if (!product) {
          console.warn(`[Sync] ⚠ Product not found in Treez: ${productId}`);
          results.failed++;
          results.errors.push(`${productId}: Not found in Treez`);
          continue;
        }

        // Extract snapshot data
        const snapshot: any = extractProductSnapshot(product);
        snapshot.last_checked_at = new Date().toISOString();

        console.log(`[Sync] Product: ${snapshot.product_name}, Price: $${snapshot.price}`);

        // Save to Supabase
        const saveResult = await saveProductSnapshot(snapshot);
        
        if (!saveResult.success) {
          console.error(`[Sync] ✗ Failed to save: ${saveResult.error}`);
          results.failed++;
          results.errors.push(`${productId}: ${saveResult.error}`);
        } else {
          console.log(`[Sync] ✓ Saved to Supabase`);
          results.synced++;
        }

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[Sync] ✗ Error processing ${productId}:`, errorMsg);
        results.failed++;
        results.errors.push(`${productId}: ${errorMsg}`);
      }
    }

    console.log('\n========================================');
    console.log(`[Sync] Complete! Synced: ${results.synced}, Failed: ${results.failed}`);
    console.log('========================================\n');

    return NextResponse.json({
      success: true,
      results,
    });

  } catch (error) {
    console.error('[Sync] Fatal error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to sync products",
    }, { status: 500 });
  }
}
