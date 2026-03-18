import { NextResponse } from "next/server";
import { fetchEbs50Products } from "@/lib/opticon";

/**
 * Fetch products from EBS50 product table.
 * GET /api/opticon/products
 */
export async function GET() {
  try {
    const result = await fetchEbs50Products();
    return NextResponse.json({
      success: result.success,
      products: result.products,
      columns: result.columns,
      error: result.error,
    });
  } catch (error) {
    console.error("Opticon products fetch error:", error);
    return NextResponse.json(
      {
        success: false,
        products: [],
        error: error instanceof Error ? error.message : "Failed to fetch products",
      },
      { status: 500 }
    );
  }
}
