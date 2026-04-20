import { NextRequest, NextResponse } from "next/server";
import { fetchTreezProducts, getTreezProductListId } from "@/lib/treez";

const CSV_HEADERS = [
  "ProductId",
  "TreezUUID",
  "Barcode",
  "Description",
  "Brandname",
  "Group",
  "StandardPrice",
  "SellPrice",
  "Discount",
  "Content",
  "Unit",
  "NotUsed",
];

function csvEscape(value: unknown): string {
  const s = value === undefined || value === null ? "" : String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function getBarcodeOrFallback(product: Record<string, unknown>, index: number): string {
  const barcodes = product.product_barcodes as Array<{ sku?: string; barcode?: string }> | undefined;
  const barcode = barcodes?.[0]?.barcode ?? product.barcode;
  if (barcode !== undefined && barcode !== null && String(barcode).trim() !== "") {
    return String(barcode).trim();
  }
  // Keep barcode numeric even when source has no barcode.
  return `${Date.now()}${index + 1}`.slice(-12);
}

function toPrice(product: Record<string, unknown>): string {
  const pricing = product.pricing as { price_sell?: number; tier_pricing_detail?: Array<{ price_per_value?: number }> } | undefined;
  const raw = pricing?.price_sell ?? pricing?.tier_pricing_detail?.[0]?.price_per_value ?? product.price ?? product.retailPrice ?? "";
  const n = Number(raw);
  return Number.isFinite(n) ? n.toFixed(2) : "";
}

function toCsv(products: Record<string, unknown>[]): string {
  const lines: string[] = [CSV_HEADERS.join(",")];
  products.forEach((product, index) => {
    const cfg = product.product_configurable_fields as Record<string, unknown> | undefined;
    const treezUuid = getTreezProductListId(product as any);
    const price = toPrice(product);
    const row = [
      String(index + 1).padStart(3, "0"),
      treezUuid,
      getBarcodeOrFallback(product, index),
      String(cfg?.name ?? product.name ?? product.productName ?? ""),
      String(cfg?.brand ?? product.brand ?? product.brandName ?? ""),
      String(product.category_type ?? product.category ?? product.categoryName ?? ""),
      price,
      price,
      "",
      String(cfg?.size ?? ""),
      String(cfg?.size_unit ?? "EA"),
      "",
    ].map(csvEscape);
    lines.push(row.join(","));
  });
  return lines.join("\n");
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const location = searchParams.get("location") || "FRONT OF HOUSE";
  const format = (searchParams.get("format") || "").toLowerCase();
  const wantsCsv = format === "csv" || request.headers.get("accept")?.includes("text/csv");

  try {
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
    const transformedProducts = products.map((product: Record<string, unknown>) => {
      // Log first product to see structure
      if (products.indexOf(product) === 0) {
        console.log('[Location API] Sample product structure:', JSON.stringify(product, null, 2));
      }

      return product; // Return as-is since fetchTreezProducts already returns proper format
    });

    console.log(`[Location API] Transformed ${transformedProducts.length} products`);

    if (wantsCsv) {
      const csv = toCsv(transformedProducts);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `inline; filename=\"treez-${location.replace(/\s+/g, "-").toLowerCase()}.csv\"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      location: location,
      total: transformedProducts.length,
      products: transformedProducts,
    });

  } catch (error: any) {
    console.error("[Location API] Error:", error);
    if (wantsCsv) {
      // Always return a valid CSV header even when upstream fails.
      return new NextResponse(`${CSV_HEADERS.join(",")}\n`, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
        },
      });
    }
    return NextResponse.json(
      { error: error.message || "Failed to fetch products" },
      { status: 500 }
    );
  }
}
