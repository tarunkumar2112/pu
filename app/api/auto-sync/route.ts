import { NextResponse } from "next/server";
import { fetchTreezProducts } from "@/lib/treez";
import { getAllSnapshots, saveProductSnapshot } from "@/lib/change-detector";

/**
 * Background sync job - checks for new/deleted products
 * Runs every 5 minutes via cron
 */
export async function GET() {
  try {
    console.log('[Auto-Sync] Starting background sync check...');

    // 1. Fetch all products from Treez (FRONT OF HOUSE)
    const treezProducts = await fetchTreezProducts({
      active: "ALL",
      above_threshold: true,
      sellable_quantity_in_location: "FRONT OF HOUSE",
      page_size: 5000,
    });

    console.log(`[Auto-Sync] Found ${treezProducts.length} products in Treez`);

    // 2. Get all existing snapshots from Supabase
    const snapshots = await getAllSnapshots();
    const existingIds = new Set(
      Array.isArray(snapshots) ? snapshots.map(s => s.treez_product_id) : []
    );

    console.log(`[Auto-Sync] Found ${existingIds.size} products in Supabase`);

    // 3. Find NEW products (in Treez but not in Supabase)
    const newProducts = treezProducts.filter(p => {
      const productId = String(p.id || p.product_id || p.productId || "");
      return productId && !existingIds.has(productId);
    });

    console.log(`[Auto-Sync] Found ${newProducts.length} NEW products to sync`);

    // 4. Upload new products to Supabase
    const results = {
      checked: treezProducts.length,
      new: newProducts.length,
      uploaded: 0,
      failed: 0,
    };

    for (const product of newProducts) {
      try {
        const productId = String(product.id || product.product_id || product.productId || "");
        const cfg = product.product_configurable_fields as Record<string, unknown> | undefined;
        const pricing = product.pricing as { price_sell?: number; tier_pricing_detail?: Array<{ price_per_value?: number }> } | undefined;
        
        let price = 0;
        if (pricing?.price_sell) price = Number(pricing.price_sell);
        else if (pricing?.tier_pricing_detail?.[0]?.price_per_value) price = Number(pricing.tier_pricing_detail[0].price_per_value);
        else if (product.price) price = Number(product.price);

        const snapshot: any = {
          treez_product_id: productId,
          opticon_barcode: productId,
          product_name: String(cfg?.name || product.name || ""),
          category: String(product.category_type || product.category || ""),
          price: price,
          barcode: productId,
          size: String(cfg?.size || ""),
          unit: String(cfg?.size_unit || "EA"),
          last_checked_at: new Date().toISOString(),
        };

        // Save to Supabase
        const result = await saveProductSnapshot(snapshot);
        
        if (result.success) {
          results.uploaded++;
          console.log(`[Auto-Sync] ✓ Uploaded: ${snapshot.product_name}`);
          
          // Also upload to Opticon
          try {
            await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/opticon/products`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                NotUsed: "",
                ProductId: String(results.uploaded),
                Barcode: productId,
                Description: snapshot.product_name,
                Group: snapshot.category,
                StandardPrice: String(price),
                SellPrice: String(price),
                Discount: "",
                Content: snapshot.size,
                Unit: snapshot.unit,
              }),
            });
            console.log(`[Auto-Sync] ✓ Also uploaded to Opticon`);
          } catch (opticonError) {
            console.error(`[Auto-Sync] Opticon upload failed:`, opticonError);
          }
        } else {
          results.failed++;
          console.error(`[Auto-Sync] ✗ Failed to upload: ${result.error}`);
        }
      } catch (error) {
        results.failed++;
        console.error(`[Auto-Sync] Error processing product:`, error);
      }
    }

    // 5. Check for DELETED products (in Supabase but not in Treez)
    const treezIds = new Set(
      treezProducts.map(p => String(p.id || p.product_id || p.productId || ""))
    );
    
    const deletedCount = 0; // TODO: Implement deletion from Supabase and Opticon

    console.log(`[Auto-Sync] Complete! Uploaded: ${results.uploaded}, Failed: ${results.failed}`);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results: {
        ...results,
        deleted: deletedCount,
      },
    });

  } catch (error) {
    console.error('[Auto-Sync] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Auto-sync failed",
    }, { status: 500 });
  }
}
