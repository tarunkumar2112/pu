import { NextResponse } from "next/server";
import { fetchTreezProductById } from "@/lib/treez";
import { 
  extractProductSnapshot, 
  detectProductChanges, 
  saveProductSnapshot, 
  saveProductChanges,
  getAllSnapshots 
} from "@/lib/change-detector";

/**
 * Check for changes in products by comparing Treez data with Supabase snapshots
 * POST /api/products/check-changes
 */
export async function POST() {
  try {
    console.log('\n========================================');
    console.log('[Check Changes] Starting change detection');
    console.log('========================================\n');

    // Get all existing snapshots from Supabase
    const snapshotsResult = await getAllSnapshots();
    
    if (!snapshotsResult.success || !snapshotsResult.snapshots) {
      return NextResponse.json({
        success: false,
        error: snapshotsResult.error || "Failed to fetch snapshots",
      }, { status: 500 });
    }

    const snapshots = snapshotsResult.snapshots;
    
    if (snapshots.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No products in database. Run 'Sync Products from Treez' first.",
      }, { status: 400 });
    }

    console.log(`[Check] Found ${snapshots.length} products to check`);

    const results = {
      total: snapshots.length,
      checked: 0,
      changed: 0,
      unchanged: 0,
      errors: 0,
      totalChanges: 0,
      changedProducts: [] as string[],
    };

    const allChanges = [];

    // Check each product for changes
    for (let i = 0; i < snapshots.length; i++) {
      const snapshot = snapshots[i];
      console.log(`\n[Check] ${i + 1}/${snapshots.length}: ${snapshot.product_name}`);

      try {
        // Fetch latest data from Treez
        const latestProduct = await fetchTreezProductById(snapshot.treez_product_id);
        
        if (!latestProduct) {
          console.warn(`[Check] ⚠ Product not found in Treez`);
          results.errors++;
          continue;
        }

        // Extract latest snapshot data
        const latestSnapshot = extractProductSnapshot(latestProduct);

        // Detect changes
        const changes = detectProductChanges(snapshot, latestSnapshot);

        if (changes.length > 0) {
          console.log(`[Check] 🔔 ${changes.length} change(s) detected:`);
          changes.forEach(change => {
            console.log(`  - ${change.change_type}: ${change.old_value} → ${change.new_value}`);
          });

          results.changed++;
          results.totalChanges += changes.length;
          results.changedProducts.push(snapshot.product_name || snapshot.treez_product_id);
          allChanges.push(...changes);

          // Update snapshot with latest data
          latestSnapshot.last_checked_at = new Date().toISOString();
          await saveProductSnapshot(latestSnapshot);

        } else {
          console.log(`[Check] ✓ No changes`);
          results.unchanged++;

          // Update last_checked_at even if no changes
          await saveProductSnapshot({
            ...snapshot,
            last_checked_at: new Date().toISOString(),
          });
        }

        results.checked++;

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[Check] ✗ Error:`, errorMsg);
        results.errors++;
      }
    }

    // Save all detected changes to database
    if (allChanges.length > 0) {
      console.log(`\n[Check] Saving ${allChanges.length} change record(s) to database...`);
      const saveResult = await saveProductChanges(allChanges);
      
      if (!saveResult.success) {
        console.error(`[Check] Failed to save changes: ${saveResult.error}`);
      } else {
        console.log(`[Check] ✓ Changes saved`);
      }
    }

    console.log('\n========================================');
    console.log(`[Check] Complete!`);
    console.log(`  Checked: ${results.checked}/${results.total}`);
    console.log(`  Changed: ${results.changed}`);
    console.log(`  Unchanged: ${results.unchanged}`);
    console.log(`  Total Changes: ${results.totalChanges}`);
    console.log(`  Errors: ${results.errors}`);
    console.log('========================================\n');

    return NextResponse.json({
      success: true,
      results,
    });

  } catch (error) {
    console.error('[Check] Fatal error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to check for changes",
    }, { status: 500 });
  }
}
