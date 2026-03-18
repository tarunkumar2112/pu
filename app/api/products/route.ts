import { NextRequest, NextResponse } from "next/server";
import { fetchTreezProductsPage } from "@/lib/treez";

const PAGE_SIZE = 100;
const TREEZ_PAGE_SIZE = 1000;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const filter = searchParams.get("filter") ?? "SELLABLE";
    const locationId = searchParams.get("location") ?? undefined;

    const filterConfig: Record<string, { active: "ALL" | "TRUE" | "FALSE"; above_threshold: boolean }> = {
      SELLABLE: { active: "ALL", above_threshold: true },
      ALL: { active: "ALL", above_threshold: false },
      ACTIVE: { active: "TRUE", above_threshold: false },
      DEACTIVATED: { active: "FALSE", above_threshold: false },
    };
    const { active, above_threshold } = filterConfig[filter] ?? filterConfig.SELLABLE;

    const treezPage = Math.ceil((page * PAGE_SIZE) / TREEZ_PAGE_SIZE);
    const offsetInTreezPage = ((page - 1) * PAGE_SIZE) % TREEZ_PAGE_SIZE;

    const result = await fetchTreezProductsPage(treezPage, {
      active,
      above_threshold,
      sellable_quantity_in_location: locationId,
    });

    const allProducts = result.products ?? [];
    const products = allProducts.slice(offsetInTreezPage, offsetInTreezPage + PAGE_SIZE);

    const totalPages =
      result.total_count > 0 ? Math.ceil(result.total_count / PAGE_SIZE) : 1;

    return NextResponse.json({
      success: true,
      products,
      page,
      page_count: products.length,
      total_count: result.total_count,
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
