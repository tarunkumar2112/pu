import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { pushProductToEbs50 } from "@/lib/opticon";
import { type TreezProduct, treezBrandForOpticonNotUsed } from "@/lib/treez";

/**
 * Sync a specific change to Opticon ESL
 * POST /api/products/sync-to-opticon
 * Body: { changeId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { changeId } = body;

    if (!changeId) {
      return NextResponse.json({
        success: false,
        error: "changeId is required",
      }, { status: 400 });
    }

    console.log(`\n[Opticon Sync] Starting sync for change: ${changeId}`);

    if (!supabase) {
      return NextResponse.json({
        success: false,
        error: "Supabase not configured",
      }, { status: 500 });
    }

    // Get the change details
    const { data: change, error: changeError } = await supabase
      .from('product_changes')
      .select('*')
      .eq('id', changeId)
      .single();

    if (changeError || !change) {
      console.error('[Opticon Sync] Change not found:', changeError);
      return NextResponse.json({
        success: false,
        error: "Change not found",
      }, { status: 404 });
    }

    console.log(`[Opticon Sync] Change details:`, {
      type: change.change_type,
      product: change.treez_product_id,
      oldValue: change.old_value,
      newValue: change.new_value,
    });

    // Get the product snapshot (current state)
    const { data: product, error: productError } = await supabase
      .from('product_snapshots')
      .select('*')
      .eq('treez_product_id', change.treez_product_id)
      .single();

    if (productError || !product) {
      console.error('[Opticon Sync] Product not found:', productError);
      return NextResponse.json({
        success: false,
        error: "Product not found",
      }, { status: 404 });
    }

    console.log(`[Opticon Sync] Product: ${product.product_name}`);
    console.log(`[Opticon Sync] Current state:`, {
      price: product.price,
      treezId: product.treez_product_id,
      opticonBarcode: product.opticon_barcode,
    });

    const rawTreez = product.raw_data as TreezProduct | undefined;
    const notUsedBrand = rawTreez ? treezBrandForOpticonNotUsed(rawTreez) : "";

    // Build Opticon product payload
    // IMPORTANT: Find product in Opticon by BARCODE (Treez UUID), not ProductId
    // We need to UPDATE existing product, not create new one
    // Opticon uses Barcode field to identify which product to update
    const opticonProduct = {
      NotUsed: notUsedBrand,
      ProductId: "", // Empty - Opticon will find by Barcode
      Barcode: product.opticon_barcode, // Treez UUID - THIS is how Opticon identifies product
      Description: product.product_name || "",
      Group: product.category || "",
      StandardPrice: String(product.price || 0),
      SellPrice: String(product.price || 0),
      Discount: "",
      Content: product.size || "",
      Unit: product.unit || "EA",
    };

    console.log(`[Opticon Sync] Pushing to Opticon:`, opticonProduct);
    console.log(`[Opticon Sync] Note: Looking up product by Barcode = ${product.opticon_barcode}`);

    // Push to Opticon
    const result = await pushProductToEbs50(opticonProduct);

    if (!result.success) {
      console.error('[Opticon Sync] ✗ Failed to push to Opticon:', result.error);
      return NextResponse.json({
        success: false,
        error: result.error || "Failed to sync to Opticon",
      }, { status: 500 });
    }

    console.log('[Opticon Sync] ✓ Successfully pushed to Opticon');

    // Mark change as synced
    const { error: updateError } = await supabase
      .from('product_changes')
      .update({
        synced_to_opticon: true,
        synced_at: new Date().toISOString(),
      })
      .eq('id', changeId);

    if (updateError) {
      console.error('[Opticon Sync] Warning: Failed to mark as synced:', updateError);
      // Don't fail the request - Opticon update succeeded
    } else {
      console.log('[Opticon Sync] ✓ Marked as synced in database');
    }

    console.log(`[Opticon Sync] ✅ Complete!\n`);

    return NextResponse.json({
      success: true,
      message: "Successfully synced to Opticon",
      product: product.product_name,
      change: {
        type: change.change_type,
        from: change.old_value,
        to: change.new_value,
      },
    });

  } catch (error) {
    console.error('[Opticon Sync] Fatal error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to sync to Opticon",
    }, { status: 500 });
  }
}
