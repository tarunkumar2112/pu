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

// Returns the regular (undiscounted) price — always price_sell
function toStandardPrice(product: Record<string, unknown>): string {
  const pricing = product.pricing as {
    price_sell?: number;
    tier_pricing_detail?: Array<{ price_per_value?: number }>;
  } | undefined;
  const raw = pricing?.price_sell ?? pricing?.tier_pricing_detail?.[0]?.price_per_value ?? "";
  const n = Number(raw);
  return Number.isFinite(n) ? n.toFixed(2) : "";
}

// Returns the discounted sell price if a discount exists, otherwise falls back to standard price
function toSellPrice(product: Record<string, unknown>): string {
  const pricing = product.pricing as {
    price_sell?: number;
    discounted_price?: number;
    tier_pricing_detail?: Array<{ price_per_value?: number }>;
  } | undefined;

  // Use pre-resolved discounted_price from Treez if available
  if (pricing?.discounted_price !== undefined && pricing.discounted_price !== null) {
    const n = Number(pricing.discounted_price);
    if (Number.isFinite(n) && n > 0) return n.toFixed(2);
  }

  // Fall back to standard price if no discount
  return toStandardPrice(product);
}

// Returns the discount percent as resolved by Treez (e.g. "53.00" for 53% off)
// Only applies to PERCENT-type discounts per client scope (Phase 1)
function toDiscount(product: Record<string, unknown>): string {
  const pricing = product.pricing as {
    discount_percent?: number;
  } | undefined;

  if (pricing?.discount_percent === undefined || pricing.discount_percent === null) return "";

  const n = Number(pricing.discount_percent);
  if (!Number.isFinite(n) || n <= 0) return "";

  return n.toFixed(2);
}

function toCsv(products: Record<string, unknown>[]): string {
  const lines: string[] = [CSV_HEADERS.join(",")];
  products.forEach((product, index) => {
    const cfg = product.product_configurable_fields as Record<string, unknown> | undefined;
    const treezUuid = getTreezProductListId(product as any);
    const standardPrice = toStandardPrice(product);
    const sellPrice = toSellPrice(product);
    const discount = toDiscount(product);
    const row = [
      String(index + 1).padStart(3, "0"),
      treezUuid,
      getBarcodeOrFallback(product, index),
      String(cfg?.name ?? product.name ?? product.productName ?? ""),
      String(cfg?.brand ?? product.brand ?? product.brandName ?? ""),
      String(product.category_type ?? product.category ?? product.categoryName ?? ""),
      standardPrice,   // StandardPrice — regular undiscounted price
      sellPrice,       // SellPrice — discounted price (or same as standard if no discount)
      discount,        // Discount — percent value resolved by Treez (e.g. "53.00")
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

    const products = await fetchTreezProducts({
      active: "ALL",
      above_threshold: true,
      sellable_quantity_in_location: location,
      include_discounts: true,
      page_size: 5000,
    });

    console.log(`[Location API] Fetched ${products.length} products at location "${location}"`);

    const transformedProducts = products.map((product: Record<string, unknown>) => {
      if (products.indexOf(product) === 0) {
        const pricing = product.pricing as Record<string, unknown> | undefined;
        console.log("[Location API] Sample product pricing:", JSON.stringify(pricing, null, 2));
        console.log("[Location API] Sample product discounts:", JSON.stringify(product.discounts, null, 2));
      }
      return product;
    });

    console.log(`[Location API] Transformed ${transformedProducts.length} products`);

    if (wantsCsv) {
      const csv = toCsv(transformedProducts);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `inline; filename="treez-${location.replace(/\s+/g, "-").toLowerCase()}.csv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      location,
      total: transformedProducts.length,
      products: transformedProducts,
    });

  } catch (error: any) {
    console.error("[Location API] Error:", error);
    if (wantsCsv) {
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