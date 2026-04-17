import { fetchTreezProducts, treezBrandForOpticonNotUsed } from "@/lib/treez";
import { getAllSnapshots, saveProductSnapshot } from "@/lib/change-detector";
import { pushProductToEbs50 } from "@/lib/opticon";
import { supabase } from "@/lib/supabase";
import { recordCatalogSyncResult } from "@/lib/sync-engine-status";

const DEFAULT_LOCATION = "FRONT OF HOUSE";

export type CatalogSyncResult = {
  success: boolean;
  checked: number;
  newProducts: number;
  removedFromSupabase: number;
  opticonUploads: number;
  failed: number;
  error?: string;
  timestamp: string;
};

/**
 * Compare Treez FRONT_OF_HOUSE catalog vs Supabase snapshots:
 * - Upsert new Treez products to Supabase + Opticon
 * - Remove Supabase snapshots (and related changes) for products no longer in that Treez slice
 */
export async function runAutoSyncCatalog(): Promise<CatalogSyncResult> {
  const timestamp = new Date().toISOString();
  const location = process.env.TREEZ_SYNC_LOCATION || DEFAULT_LOCATION;

  try {
    const treezProducts = await fetchTreezProducts({
      active: "ALL",
      above_threshold: true,
      sellable_quantity_in_location: location,
      page_size: 5000,
    });

    const snapshotsResult = await getAllSnapshots();
    if (!snapshotsResult.success || !snapshotsResult.snapshots) {
      const err = snapshotsResult.error || "Could not load Supabase snapshots";
      recordCatalogSyncResult({
        newProducts: 0,
        removedFromSupabase: 0,
        opticonUploads: 0,
        failed: 0,
        error: err,
      });
      return {
        success: false,
        checked: treezProducts.length,
        newProducts: 0,
        removedFromSupabase: 0,
        opticonUploads: 0,
        failed: 0,
        error: err,
        timestamp,
      };
    }

    const existingSnapshots = snapshotsResult.snapshots;
    const existingIds = new Set(
      existingSnapshots.map((s) => String(s.treez_product_id)).filter(Boolean)
    );

    const treezIds = new Set(
      treezProducts
        .map((p) => String(p.id || p.product_id || p.productId || ""))
        .filter(Boolean)
    );

    let newProducts = 0;
    let opticonUploads = 0;
    let failed = 0;

    const newTreezProducts = treezProducts.filter((p) => {
      const id = String(p.id || p.product_id || p.productId || "");
      return id && !existingIds.has(id);
    });

    let seq = existingSnapshots.length;

    for (const product of newTreezProducts) {
      try {
        const productId = String(product.id || product.product_id || product.productId || "");
        const cfg = product.product_configurable_fields as Record<string, unknown> | undefined;
        const pricing = product.pricing as {
          price_sell?: number;
          tier_pricing_detail?: Array<{ price_per_value?: number }>;
        } | undefined;

        let price = 0;
        if (pricing?.price_sell) price = Number(pricing.price_sell);
        else if (pricing?.tier_pricing_detail?.[0]?.price_per_value)
          price = Number(pricing.tier_pricing_detail[0].price_per_value);
        else if (product.price) price = Number(product.price);

        seq += 1;

        const snapshot: Record<string, unknown> = {
          treez_product_id: productId,
          opticon_barcode: productId,
          product_name: String(cfg?.name || product.name || ""),
          category: String(product.category_type || product.category || ""),
          price,
          barcode: productId,
          size: String(cfg?.size || ""),
          unit: String(cfg?.size_unit || "EA"),
          raw_data: product,
          last_checked_at: new Date().toISOString(),
        };

        const saveRes = await saveProductSnapshot(snapshot as any);
        if (!saveRes.success) {
          failed++;
          continue;
        }
        newProducts++;

        const opt = {
          NotUsed: treezBrandForOpticonNotUsed(product),
          ProductId: String(seq),
          Barcode: productId,
          Description: String(snapshot.product_name),
          Group: String(snapshot.category),
          StandardPrice: String(price),
          SellPrice: String(price),
          Discount: "",
          Content: String(snapshot.size),
          Unit: String(snapshot.unit),
        };

        const push = await pushProductToEbs50(opt);
        if (push.success) opticonUploads++;
        else failed++;
      } catch {
        failed++;
      }
    }

    // Remove snapshots (and changes) for products not in current Treez location set
    let removedFromSupabase = 0;
    const orphanIds = existingSnapshots
      .map((s) => String(s.treez_product_id))
      .filter((id) => id && !treezIds.has(id));

    if (supabase && orphanIds.length > 0) {
      for (const oid of orphanIds) {
        try {
          await supabase.from("product_changes").delete().eq("treez_product_id", oid);
          const { error } = await supabase.from("product_snapshots").delete().eq("treez_product_id", oid);
          if (!error) removedFromSupabase++;
        } catch {
          failed++;
        }
      }
    }

    recordCatalogSyncResult({
      newProducts,
      removedFromSupabase,
      opticonUploads,
      failed,
      error: null,
    });

    return {
      success: true,
      checked: treezProducts.length,
      newProducts,
      removedFromSupabase,
      opticonUploads,
      failed,
      timestamp,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    recordCatalogSyncResult({
      newProducts: 0,
      removedFromSupabase: 0,
      opticonUploads: 0,
      failed: 0,
      error: msg,
    });
    return {
      success: false,
      checked: 0,
      newProducts: 0,
      removedFromSupabase: 0,
      opticonUploads: 0,
      failed: 0,
      error: msg,
      timestamp,
    };
  }
}
