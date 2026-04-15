import { NextRequest, NextResponse } from "next/server";
import { fetchTreezProducts } from "@/lib/treez";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const location = searchParams.get("location") || "FRONT OF HOUSE";

    console.log(`[Location API] Fetching products for location: ${location}`);

    // Use the existing fetchTreezProducts function with location filter
    const products = await fetchTreezProducts({
      active: "ALL",
      above_threshold: true,
      sellable_quantity_in_location: location,
      page_size: 5000, // Get all products
    });

    console.log(`[Location API] Fetched ${products.length} products at location "${location}"`);

    // Transform products to include proper pricing
    const transformedProducts = products.map((product: any) => {
      // Log first product to see structure
      if (products.indexOf(product) === 0) {
        console.log('[Location API] Sample product structure:', JSON.stringify(product, null, 2));
      }

      return product; // Return as-is since fetchTreezProducts already returns proper format
    });

    console.log(`[Location API] Transformed ${transformedProducts.length} products`);

    return NextResponse.json({
      success: true,
      location: location,
      total: transformedProducts.length,
      products: transformedProducts,
    });

  } catch (error: any) {
    console.error("[Location API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch products" },
      { status: 500 }
    );
  }
}
