import { fetchTreezProductById } from './treez';
import {
  extractProductSnapshot,
  detectProductChanges,
  saveProductSnapshot,
  saveProductChanges,
  getAllSnapshots,
} from './change-detector';
import { runAutoSyncCatalog } from './auto-sync-catalog';
import {
  recordChangeDetectionTick,
  recordChangeDetectionResult,
  recordCatalogSyncTick,
} from './sync-engine-status';

let isJobRunning = false;
let cronInitialized = false;

/**
 * Background job to check for product changes every minute
 * Runs independently of whether the monitor page is open
 */
export async function startBackgroundChangeDetection() {
  // Only run on server side
  if (typeof window !== 'undefined') {
    return;
  }

  // Prevent multiple initializations
  if (cronInitialized) {
    console.log('[Background Monitor] Already initialized, skipping');
    return;
  }

  try {
    // Dynamic import to avoid Turbopack issues
    const cron = await import('node-cron');
    
    console.log('\n🚀 [Background Monitor] Starting automatic change detection (1 minute interval)');
    console.log('🆕 [Auto-Sync] Starting automatic new product detection (5 minute interval)');
    
    // Run change detection every 1 minute
    cron.schedule('*/1 * * * *', async () => {
      if (isJobRunning) {
        console.log('[Background Monitor] ⏭ Skipping - previous job still running');
        return;
      }

      isJobRunning = true;
      
      try {
        recordChangeDetectionTick();
        console.log('\n⏰ [Background Monitor] Starting scheduled check...');
        await checkForChanges();
      } catch (error) {
        console.error('[Background Monitor] ✗ Error:', error);
      } finally {
        isJobRunning = false;
      }
    });

    // Run catalog auto-sync every 5 minutes (in-process; no HTTP self-call)
    cron.schedule('*/5 * * * *', async () => {
      try {
        recordCatalogSyncTick();
        console.log('\n🔄 [Auto-Sync] Running scheduled catalog sync...');
        const data = await runAutoSyncCatalog();
        console.log('[Auto-Sync] Result:', data);
      } catch (error) {
        console.error('[Auto-Sync] ✗ Error:', error);
      }
    });

    cronInitialized = true;
    
    console.log('✅ [Background Monitor] Cron job scheduled successfully');
    console.log('   - Change detection: every 1 minute');
    console.log('   - Auto-sync new products: every 5 minutes');
    console.log('   - Works even when monitor page is closed');
    console.log('   - Changes will be synced to Supabase automatically\n');
    
  } catch (error) {
    console.error('[Background Monitor] Failed to initialize:', error);
  }
}

/**
 * Check for changes in all configured products
 */
async function checkForChanges(): Promise<void> {
  // Monitored set = whatever is already in Supabase (middleware / location sync).
  // product-ids.json is optional legacy; do not block when it is empty.

  // Get existing snapshots from Supabase
  const snapshotsResult = await getAllSnapshots();

  if (!snapshotsResult.success || !snapshotsResult.snapshots) {
    const err = snapshotsResult.error || 'Unknown error';
    console.error('[Background Monitor] Failed to fetch snapshots from Supabase:', err);
    recordChangeDetectionResult({
      changesDetected: 0,
      syncedToSupabase: 0,
      syncedToOpticon: 0,
      error: err,
    });
    return;
  }

  const snapshots = snapshotsResult.snapshots;
  
  if (snapshots.length === 0) {
    console.log('[Background Monitor] No products in Supabase yet. Run initial sync first.');
    recordChangeDetectionResult({
      changesDetected: 0,
      syncedToSupabase: 0,
      syncedToOpticon: 0,
      error: null,
    });
    return;
  }

  console.log(`[Background Monitor] Checking ${snapshots.length} products...`);

  let changesDetected = 0;
  let totalChanges = 0;
  const allChanges: any[] = [];
  const updatedSnapshots: any[] = []; // Store updated snapshots for auto-sync

  try {
  // Check each product
  for (const snapshot of snapshots) {
    try {
      console.log(`[Background Monitor] Checking: ${snapshot.product_name}`);
      console.log(`  Current snapshot price in Supabase: $${snapshot.price}`);
      
      // Fetch latest from Treez
      const latestProduct = await fetchTreezProductById(snapshot.treez_product_id);
      
      if (!latestProduct) {
        console.log(`  ⚠ Product not found in Treez`);
        continue;
      }

      // Extract latest snapshot
      const latestSnapshot = extractProductSnapshot(latestProduct);
      console.log(`  Latest price from Treez: $${latestSnapshot.price}`);

      // Detect changes
      const changes = detectProductChanges(snapshot, latestSnapshot);

      if (changes.length > 0) {
        console.log(`[Background Monitor] 🔔 ${snapshot.product_name}: ${changes.length} change(s) detected`);
        changes.forEach(change => {
          console.log(`   - ${change.change_type}: ${change.old_value} → ${change.new_value}`);
        });

        changesDetected++;
        totalChanges += changes.length;
        allChanges.push(...changes);

        // Update snapshot with latest data
        const updatedSnapshot: any = { ...latestSnapshot };
        updatedSnapshot.last_checked_at = new Date().toISOString();
        await saveProductSnapshot(updatedSnapshot);
        console.log(`  ✓ Snapshot updated in Supabase with new price: $${latestSnapshot.price}`);
        
        // Store the UPDATED snapshot for auto-sync
        updatedSnapshots.push(updatedSnapshot);
        
      } else {
        console.log(`  ✓ No changes detected`);
      }

    } catch (error) {
      console.error(`[Background Monitor] Error checking ${snapshot.product_name}:`, error);
    }
  }

  let supabaseChangeRows = 0;
  let opticonSynced = 0;

  // Save all detected changes
  if (allChanges.length > 0) {
    console.log(`\n[Background Monitor] 💾 Saving ${allChanges.length} change(s) to Supabase...`);
    const saveResult = await saveProductChanges(allChanges);
    
    if (saveResult.success) {
      console.log('[Background Monitor] ✓ Changes synced to Supabase successfully!');
      supabaseChangeRows = allChanges.length;
      
      // AUTO-SYNC TO OPTICON with UPDATED snapshots
      console.log('[Background Monitor] 🔄 Auto-syncing changes to Opticon...');
      const { synced } = await autoSyncToOpticon(allChanges, updatedSnapshots);
      opticonSynced = synced;
      
    } else {
      console.error('[Background Monitor] ✗ Failed to save changes:', saveResult.error);
      recordChangeDetectionResult({
        changesDetected: totalChanges,
        syncedToSupabase: 0,
        syncedToOpticon: 0,
        error: saveResult.error || 'saveProductChanges failed',
      });
      return;
    }
  }

  console.log(`[Background Monitor] ✓ Check complete: ${changesDetected} product(s) changed, ${totalChanges} total change(s)\n`);

  recordChangeDetectionResult({
    changesDetected: totalChanges,
    syncedToSupabase: supabaseChangeRows,
    syncedToOpticon: opticonSynced,
    error: null,
  });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Background Monitor] Unexpected error:', err);
    recordChangeDetectionResult({
      changesDetected: 0,
      syncedToSupabase: 0,
      syncedToOpticon: 0,
      error: msg,
    });
  }
}

/**
 * Automatically sync changes to Opticon ESL
 */
async function autoSyncToOpticon(changes: any[], snapshots: any[]): Promise<{ synced: number; failed: number }> {
  let syncedCount = 0;
  let failedCount = 0;

  for (const change of changes) {
    try {
      // Find the product snapshot
      const product = snapshots.find(s => s.treez_product_id === change.treez_product_id);
      
      if (!product) {
        console.error(`[Opticon Auto-Sync] Product not found: ${change.treez_product_id}`);
        failedCount++;
        continue;
      }

      console.log(`[Opticon Auto-Sync] Syncing ${product.product_name}...`);

      // Build Opticon payload
      const opticonProduct = {
        NotUsed: "",
        ProductId: "",
        Barcode: product.opticon_barcode, // Treez UUID
        Description: product.product_name || "",
        Group: product.category || "",
        StandardPrice: String(product.price || 0),
        SellPrice: String(product.price || 0),
        Discount: "",
        Content: product.size || "",
        Unit: product.unit || "EA",
      };

      // Dynamic import to avoid edge runtime issues
      const { pushProductToEbs50 } = await import('./opticon');
      
      // Push to Opticon
      const result = await pushProductToEbs50(opticonProduct);

      if (result.success) {
        console.log(`[Opticon Auto-Sync] ✓ Synced ${product.product_name} to Opticon`);
        
        // Mark as synced in Supabase
        const { supabase } = await import('./supabase');
        if (supabase) {
          await supabase
            .from('product_changes')
            .update({
              synced_to_opticon: true,
              synced_at: new Date().toISOString(),
            })
            .eq('treez_product_id', change.treez_product_id)
            .eq('change_type', change.change_type)
            .is('synced_to_opticon', false);
        }
        
        syncedCount++;
      } else {
        console.error(`[Opticon Auto-Sync] ✗ Failed: ${result.error}`);
        failedCount++;
      }

    } catch (error) {
      console.error(`[Opticon Auto-Sync] ✗ Error:`, error);
      failedCount++;
    }
  }

  console.log(`[Opticon Auto-Sync] Complete: ${syncedCount} synced, ${failedCount} failed\n`);
  return { synced: syncedCount, failed: failedCount };
}

/**
 * Manually trigger a check (for testing)
 */
export async function triggerManualCheck(): Promise<void> {
  console.log('[Background Monitor] Manual check triggered');
  await checkForChanges();
}
