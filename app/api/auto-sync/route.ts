import { NextResponse } from "next/server";
import { recordCatalogSyncTick } from "@/lib/sync-engine-status";
import { runAutoSyncCatalog } from "@/lib/auto-sync-catalog";

/**
 * Manual or external trigger for catalog sync (same logic as 5-minute cron).
 * GET /api/auto-sync
 */
export async function GET() {
  try {
    recordCatalogSyncTick();
    const result = await runAutoSyncCatalog();
    return NextResponse.json({
      success: result.success,
      timestamp: result.timestamp,
      results: {
        checked: result.checked,
        new: result.newProducts,
        uploaded: result.opticonUploads,
        removed_from_supabase: result.removedFromSupabase,
        failed: result.failed,
        error: result.error,
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
