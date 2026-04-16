import { NextRequest, NextResponse } from "next/server";
import { saveProductSnapshot } from "@/lib/change-detector";

/**
 * POST /api/products/upload-snapshot
 * Upload a single product snapshot to Supabase
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { snapshot } = body;

    if (!snapshot || !snapshot.treez_product_id) {
      return NextResponse.json({
        success: false,
        error: "Invalid snapshot data",
      }, { status: 400 });
    }

    // Add timestamp + raw_data for DB compatibility
    const snapshotWithTimestamp = {
      ...snapshot,
      raw_data: snapshot.raw_data ?? {},
      last_checked_at: new Date().toISOString(),
    };

    // Save to Supabase
    const result = await saveProductSnapshot(snapshotWithTimestamp);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error || "Failed to save snapshot",
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Snapshot uploaded successfully",
    });

  } catch (error) {
    console.error('[Upload Snapshot] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to upload snapshot",
    }, { status: 500 });
  }
}
