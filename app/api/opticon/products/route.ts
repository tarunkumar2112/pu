import { NextResponse } from "next/server";
import { fetchEbs50Products, pushProductToEbs50 } from "@/lib/opticon";

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

/**
 * Push a single product to EBS50 (test).
 * POST /api/opticon/products – body: product object
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const product = typeof body === "object" && body !== null ? body : {};
    const result = await pushProductToEbs50(product as Record<string, unknown>);
    return NextResponse.json({
      success: result.success,
      error: result.error,
    });
  } catch (error) {
    console.error("Opticon push product error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to push product" },
      { status: 500 }
    );
  }
}
