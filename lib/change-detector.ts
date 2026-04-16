import { TreezProduct } from "./treez";
import { supabase, ProductSnapshot, ProductChange } from "./supabase";

/**
 * Compare two product snapshots and return detected changes
 */
export function detectProductChanges(
  oldProduct: ProductSnapshot,
  newProduct: {
    product_name: string | null;
    price: number | null;
    barcode: string | null;
    category: string | null;
    size: string | null;
    unit: string | null;
  }
): ProductChange[] {
  const changes: ProductChange[] = [];

  // Check price change
  if (oldProduct.price !== newProduct.price && newProduct.price !== null) {
    changes.push({
      treez_product_id: oldProduct.treez_product_id,
      change_type: 'price',
      old_value: oldProduct.price?.toString() ?? null,
      new_value: newProduct.price.toString(),
      synced_to_opticon: false,
    });
  }

  // Check name change
  if (oldProduct.product_name !== newProduct.product_name && newProduct.product_name !== null) {
    changes.push({
      treez_product_id: oldProduct.treez_product_id,
      change_type: 'name',
      old_value: oldProduct.product_name,
      new_value: newProduct.product_name,
      synced_to_opticon: false,
    });
  }

  // Check barcode change
  if (oldProduct.barcode !== newProduct.barcode && newProduct.barcode !== null) {
    changes.push({
      treez_product_id: oldProduct.treez_product_id,
      change_type: 'barcode',
      old_value: oldProduct.barcode,
      new_value: newProduct.barcode,
      synced_to_opticon: false,
    });
  }

  // Check category change
  if (oldProduct.category !== newProduct.category && newProduct.category !== null) {
    changes.push({
      treez_product_id: oldProduct.treez_product_id,
      change_type: 'category',
      old_value: oldProduct.category,
      new_value: newProduct.category,
      synced_to_opticon: false,
    });
  }

  // Check size change
  if (oldProduct.size !== newProduct.size && newProduct.size !== null) {
    changes.push({
      treez_product_id: oldProduct.treez_product_id,
      change_type: 'size',
      old_value: oldProduct.size,
      new_value: newProduct.size,
      synced_to_opticon: false,
    });
  }

  return changes;
}

/**
 * Extract product data from Treez product for snapshot
 */
export function extractProductSnapshot(product: TreezProduct): Omit<ProductSnapshot, 'id' | 'created_at' | 'last_checked_at'> {
  const cfg = product.product_configurable_fields as Record<string, unknown> | undefined;
  const pricing = product.pricing as { 
    price_sell?: number;
    tier_pricing_detail?: Array<{ price_per_value?: number }>;
  } | undefined;
  const barcodes = product.product_barcodes as Array<{ sku?: string; barcode?: string }> | undefined;

  // Extract price (same logic as getProductDisplay)
  const tierDetail = pricing?.tier_pricing_detail?.[0];
  const priceVal = pricing?.price_sell ?? tierDetail?.price_per_value ?? product.price ?? product.retailPrice;
  const price = typeof priceVal === "number" ? priceVal : null;

  // Extract other fields
  const productName = cfg?.name ?? product.name ?? product.productName ?? null;
  const barcode = barcodes?.[0]?.barcode ?? barcodes?.[0]?.sku ?? cfg?.manufacturer_barcode ?? product.barcode ?? null;
  const category = product.category_type ?? product.category ?? product.categoryName ?? null;
  const size = cfg?.size ?? null;
  const unit = cfg?.size_unit ?? "EA";

  const treezProductId = product.product_id ?? product.productId ?? "";

  return {
    treez_product_id: String(treezProductId),
    opticon_barcode: String(treezProductId), // Use Treez ID as Opticon barcode
    product_name: productName ? String(productName) : null,
    price: price,
    barcode: barcode ? String(barcode) : null,
    category: category ? String(category) : null,
    size: size ? String(size) : null,
    unit: unit ? String(unit) : null,
    raw_data: product,
    last_updated_at: (product as any).updated_at ?? new Date().toISOString(),
  };
}

/**
 * Save or update product snapshot in Supabase
 */
export async function saveProductSnapshot(snapshot: Omit<ProductSnapshot, 'id' | 'created_at'>): Promise<{ success: boolean; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }
  
  try {
    const { error } = await supabase
      .from('product_snapshots')
      .upsert(snapshot, { onConflict: 'treez_product_id' });

    if (error) {
      console.error('[Snapshot] Save error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('[Snapshot] Exception:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Record detected changes in Supabase
 */
export async function saveProductChanges(changes: ProductChange[]): Promise<{ success: boolean; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }
  
  if (changes.length === 0) return { success: true };

  try {
    const { error } = await supabase
      .from('product_changes')
      .insert(changes);

    if (error) {
      console.error('[Changes] Save error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('[Changes] Exception:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Get all product snapshots from Supabase
 */
export async function getAllSnapshots(): Promise<{ success: boolean; snapshots?: ProductSnapshot[]; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    // PostgREST returns at most 1000 rows per request unless paginated.
    const pageSize = 1000;
    const all: ProductSnapshot[] = [];
    let from = 0;

    for (;;) {
      const { data, error } = await supabase
        .from('product_snapshots')
        .select('*')
        .order('treez_product_id', { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) {
        console.error('[Snapshots] Fetch error:', error);
        return { success: false, error: error.message };
      }

      const batch = (data ?? []) as ProductSnapshot[];
      all.push(...batch);
      if (batch.length < pageSize) break;
      from += pageSize;
    }

    return { success: true, snapshots: all };
  } catch (err) {
    console.error('[Snapshots] Exception:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Get recent changes from Supabase
 */
export async function getRecentChanges(limit = 50): Promise<{ success: boolean; changes?: ProductChange[]; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }
  
  try {
    const { data, error } = await supabase
      .from('product_changes')
      .select('*')
      .order('detected_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[Changes] Fetch error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, changes: data as ProductChange[] };
  } catch (err) {
    console.error('[Changes] Exception:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Get unsynced changes (not yet pushed to Opticon)
 */
export async function getUnsyncedChanges(): Promise<{ success: boolean; changes?: ProductChange[]; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }
  
  try {
    const { data, error } = await supabase
      .from('product_changes')
      .select('*')
      .eq('synced_to_opticon', false)
      .order('detected_at', { ascending: false });

    if (error) {
      console.error('[Changes] Fetch error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, changes: data as ProductChange[] };
  } catch (err) {
    console.error('[Changes] Exception:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
