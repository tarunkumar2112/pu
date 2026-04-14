import { fetchTreezProductById } from './treez';
import { 
  extractProductSnapshot, 
  detectProductChanges, 
  saveProductSnapshot, 
  saveProductChanges,
  getAllSnapshots 
} from './change-detector';
import fs from 'fs';
import path from 'path';

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
    
    // Run every 1 minute
    cron.schedule('*/1 * * * *', async () => {
      if (isJobRunning) {
        console.log('[Background Monitor] ⏭ Skipping - previous job still running');
        return;
      }

      isJobRunning = true;
      
      try {
        console.log('\n⏰ [Background Monitor] Starting scheduled check...');
        await checkForChanges();
      } catch (error) {
        console.error('[Background Monitor] ✗ Error:', error);
      } finally {
        isJobRunning = false;
      }
    });

    cronInitialized = true;
    
    console.log('✅ [Background Monitor] Cron job scheduled successfully');
    console.log('   - Checking every 1 minute');
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
  // Get product IDs from config
  const configPath = path.join(process.cwd(), "product-ids.json");
  let productIds: string[] = [];
  
  try {
    const fileContent = fs.readFileSync(configPath, "utf-8");
    const config = JSON.parse(fileContent);
    productIds = config.productIds || [];
  } catch (error) {
    console.error('[Background Monitor] Could not read product-ids.json');
    return;
  }

  if (productIds.length === 0) {
    console.error('[Background Monitor] No product IDs configured');
    return;
  }

  // Get existing snapshots from Supabase
  const snapshotsResult = await getAllSnapshots();
  
  if (!snapshotsResult.success || !snapshotsResult.snapshots) {
    console.error('[Background Monitor] Failed to fetch snapshots from Supabase:', snapshotsResult.error);
    return;
  }

  const snapshots = snapshotsResult.snapshots;
  
  if (snapshots.length === 0) {
    console.log('[Background Monitor] No products in Supabase yet. Run initial sync first.');
    return;
  }

  console.log(`[Background Monitor] Checking ${snapshots.length} products...`);

  let changesDetected = 0;
  let totalChanges = 0;
  const allChanges = [];

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
      } else {
        console.log(`  ✓ No changes detected`);
      }

    } catch (error) {
      console.error(`[Background Monitor] Error checking ${snapshot.product_name}:`, error);
    }
  }

  // Save all detected changes
  if (allChanges.length > 0) {
    console.log(`\n[Background Monitor] 💾 Saving ${allChanges.length} change(s) to Supabase...`);
    const saveResult = await saveProductChanges(allChanges);
    
    if (saveResult.success) {
      console.log('[Background Monitor] ✓ Changes synced to Supabase successfully!');
    } else {
      console.error('[Background Monitor] ✗ Failed to save changes:', saveResult.error);
    }
  }

  console.log(`[Background Monitor] ✓ Check complete: ${changesDetected} product(s) changed, ${totalChanges} total change(s)\n`);
}

/**
 * Manually trigger a check (for testing)
 */
export async function triggerManualCheck(): Promise<void> {
  console.log('[Background Monitor] Manual check triggered');
  await checkForChanges();
}
