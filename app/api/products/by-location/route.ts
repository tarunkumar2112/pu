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
      return {
        id: product.id || product.product_id,
        name: product.name || product.productName,
        sku: product.sku,
        barcode: product.barcode || product.id,
        category: product.category || product.categoryName || product.category_type,
        brand: product.brand || product.brandName,
        size: product.size,
        unit: product.unit_of_measure || product.unit,
        pricing: product.pricing || {},
        sellable_quantity_detail: product.sellable_quantity_detail || [],
        internal_tags: product.internal_tags || [],
        sellable_quantity: product.sellable_quantity,
      };
    });

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
