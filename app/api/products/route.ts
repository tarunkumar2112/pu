import { NextRequest, NextResponse } from "next/server";
import { fetchTreezProducts } from "@/lib/treez";

const PAGE_SIZE = 100;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const searchQuery = searchParams.get("search")?.trim() || "";

    console.log(`\n========================================`);
    console.log(`[API] Starting product fetch`);
    console.log(`[API] Search query: "${searchQuery}"`);
    console.log(`[API] Requested page: ${page}`);
    console.log(`========================================\n`);

    const allProducts = await fetchTreezProducts({
      active: "ALL",
      above_threshold: false,
    });

    console.log(`\n[API] ✓ Received ${allProducts.length} total products from Treez\n`);

    let filteredProducts = allProducts;

    if (searchQuery) {
      console.log(`[API] Filtering products with search: "${searchQuery}"`);
      const query = searchQuery.toLowerCase();
      filteredProducts = allProducts.filter(p => {
        const attrs = p.attributes as { internal_tags?: any[] } | undefined;
        const directTags = (p as { internal_tags?: any[] }).internal_tags;
        const tags = attrs?.internal_tags ?? directTags;
        
        let tagsString = "";
        if (Array.isArray(tags)) {
          tagsString = tags.map(t => {
            if (typeof t === 'string') return t;
            if (typeof t === 'object' && t !== null) {
              return (t as any).name ?? (t as any).label ?? JSON.stringify(t);
            }
            return String(t);
          }).join(' ').toLowerCase();
        }

        const name = (p.name ?? p.productName ?? (p.product_configurable_fields as any)?.name ?? '').toLowerCase();
        const sku = (p.sku ?? (p.product_barcodes as any)?.[0]?.sku ?? (p.product_configurable_fields as any)?.external_id ?? '').toLowerCase();
        
        return tagsString.includes(query) || name.includes(query) || sku.includes(query);
      });
      
      console.log(`[API] ✓ Found ${filteredProducts.length} products matching "${searchQuery}"\n`);
    }

    const totalCount = filteredProducts.length;
    const start = (page - 1) * PAGE_SIZE;
    const products = filteredProducts.slice(start, start + PAGE_SIZE);
    const totalPages = totalCount > 0 ? Math.ceil(totalCount / PAGE_SIZE) : 1;

    console.log(`[API] Returning page ${page} of ${totalPages} (${products.length} products)\n`);

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
