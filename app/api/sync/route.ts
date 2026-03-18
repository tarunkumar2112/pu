import { NextResponse } from "next/server";
import { fetchTreezProducts } from "@/lib/treez";

/**
 * Manual sync endpoint - fetches products from Treez API
 * In future: will also push to EBS50 Opticon format
 */
export async function POST() {
  try {
    const products = await fetchTreezProducts({ active: "ALL", above_threshold: true });

    // TODO: Transform to Opticon format and POST to EBS50
    // POST /api/v2.0/Products/ChangeStrings on local EBS50

    return NextResponse.json({
      success: true,
      message: `Synced ${products.length} products from Treez`,
      count: products.length,
      products,
    });
  } catch (error) {
    console.error("Treez sync error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Sync failed",
      },
      { status: 500 }
    );
  }
}
