import { NextResponse } from "next/server";
import { fetchTreezProductsPage } from "@/lib/treez";

/**
 * Returns raw structure of first product for debugging field mapping
 */
export async function GET() {
  try {
    const result = await fetchTreezProductsPage(1, { active: "ALL", above_threshold: true });
    const sample = result.products[0] ?? null;
    const barcodes = sample?.product_barcodes;
    const firstBc = Array.isArray(barcodes) ? barcodes[0] : null;
    return NextResponse.json({
      totalProducts: result.total_count,
      sampleProduct: sample,
      sampleKeys: sample ? Object.keys(sample) : [],
      product_barcodes_raw: barcodes,
      product_barcodes_first: firstBc,
      product_barcodes_first_keys: firstBc && typeof firstBc === "object" ? Object.keys(firstBc as object) : null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
