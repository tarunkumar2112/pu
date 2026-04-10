import { NextRequest, NextResponse } from "next/server";
import { fetchTreezProducts } from "@/lib/treez";

const PAGE_SIZE = 100;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

    console.log(`[API] Fetching all products from Treez...`);

    const allProducts = await fetchTreezProducts({
      active: "ALL",
      above_threshold: false,
    });

    console.log(`[API] Total products fetched: ${allProducts.length}`);

    const totalCount = allProducts.length;
    const start = (page - 1) * PAGE_SIZE;
    const products = allProducts.slice(start, start + PAGE_SIZE);
    const totalPages = totalCount > 0 ? Math.ceil(totalCount / PAGE_SIZE) : 1;

    return NextResponse.json({
      success: true,
      products,
      page,
      page_count: products.length,
      total_count: totalCount,
      total_pages: totalPages,
    });
  } catch (error) {
    console.error("Treez products fetch error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch products",
      },
      { status: 500 }
    );
  }
}
