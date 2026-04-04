import { NextResponse } from "next/server";
import {
  readWatchList,
  writeWatchList,
  buildProductLookup,
  matchItemToProduct,
} from "@/lib/watch-list";
import { fetchTreezProducts } from "@/lib/treez";

/**
 * POST /api/watch-list/match
 * Fetches all Treez products, matches each watch-list item by
 * Brand + ProductType + Subtype + Size (price as tiebreaker),
 * and saves the resolved product IDs back to the watch list.
 */
export async function POST() {
  try {
    const items = await readWatchList();
    if (items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Watch list is empty. Paste your product list first." },
        { status: 400 }
      );
    }

    // Fetch all products from Treez (handles pagination automatically)
    const allProducts = await fetchTreezProducts({ active: "ALL", above_threshold: false });
    const lookup = buildProductLookup(allProducts);

    let matched = 0;
    let unmatched = 0;

    const updated = items.map((item) => {
      const product = matchItemToProduct(item, lookup);
      if (product) {
        matched++;
        const id = String(product.product_id ?? product.productId ?? "");
        const cfg = (product.product_configurable_fields as Record<string, unknown>) ?? {};
        const name = String(
          cfg.name ?? product.name ?? product.productName ?? ""
        );
        const barcodes = product.product_barcodes as Array<{ sku?: string }> | undefined;
        const barcode = barcodes?.[0]?.sku ?? "";
        return { ...item, matchedProductId: id, matchedProductName: name, matchedBarcode: barcode };
      } else {
        unmatched++;
        return {
          ...item,
          matchedProductId: undefined,
          matchedProductName: undefined,
          matchedBarcode: undefined,
        };
      }
    });

    await writeWatchList(updated);

    return NextResponse.json({
      success: true,
      total: items.length,
      matched,
      unmatched,
      totalTreezProducts: allProducts.length,
      items: updated,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Match failed" },
      { status: 500 }
    );
  }
}
