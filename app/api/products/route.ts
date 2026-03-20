import { NextRequest, NextResponse } from "next/server";
import { fetchTreezProducts, fetchTreezProductsPage, productHasBarcode, productHasEslTag } from "@/lib/treez";

const PAGE_SIZE = 100;
const TREEZ_PAGE_SIZE = 1000;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const filter = searchParams.get("filter") ?? "SELLABLE";
    const locationId = searchParams.get("location") ?? undefined;
    const barcodeOnly = searchParams.get("barcode_only") === "true";
    const eslTaggedOnly = searchParams.get("esl_tagged_only") === "true";

    const filterConfig: Record<string, { active: "ALL" | "TRUE" | "FALSE"; above_threshold: boolean }> = {
      SELLABLE: { active: "ALL", above_threshold: true },
      ALL: { active: "ALL", above_threshold: false },
      ACTIVE: { active: "TRUE", above_threshold: false },
      DEACTIVATED: { active: "FALSE", above_threshold: false },
    };
    const { active, above_threshold } = filterConfig[filter] ?? filterConfig.SELLABLE;

    let products: Awaited<ReturnType<typeof fetchTreezProductsPage>>["products"];
    let totalCount: number;

    if (barcodeOnly || eslTaggedOnly) {
      const allProducts = await fetchTreezProducts({
        active,
        above_threshold,
        sellable_quantity_in_location: locationId,
      });
      let filtered = allProducts;
      if (barcodeOnly) filtered = filtered.filter(productHasBarcode);
      if (eslTaggedOnly) filtered = filtered.filter(productHasEslTag);
      totalCount = filtered.length;
      const start = (page - 1) * PAGE_SIZE;
      products = filtered.slice(start, start + PAGE_SIZE);
    } else {
      const treezPage = Math.ceil((page * PAGE_SIZE) / TREEZ_PAGE_SIZE);
      const offsetInTreezPage = ((page - 1) * PAGE_SIZE) % TREEZ_PAGE_SIZE;

      const result = await fetchTreezProductsPage(treezPage, {
        active,
        above_threshold,
        sellable_quantity_in_location: locationId,
      });

      const allProducts = result.products ?? [];
      products = allProducts.slice(offsetInTreezPage, offsetInTreezPage + PAGE_SIZE);
      totalCount = result.total_count ?? 0;
    }

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
