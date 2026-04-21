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

// ─── Types ────────────────────────────────────────────────────────────────────

interface ResolvedDiscount {
  product_id: string;
  selected_discount: {
    discount_percent: number;
    discount_title: string;
  };
}

interface CollectionsApiResponse {
  success: boolean;
  products_with_discounts: ResolvedDiscount[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  return `${Date.now()}${index + 1}`.slice(-12);
}

function toStandardPrice(product: Record<string, unknown>): number {
  const pricing = product.pricing as {
    price_sell?: number;
    tier_pricing_detail?: Array<{ price_per_value?: number }>;
  } | undefined;
  const raw = pricing?.price_sell ?? pricing?.tier_pricing_detail?.[0]?.price_per_value ?? 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

// ─── Fetch discount percent map from /api/collections ────────────────────────

async function fetchDiscountPercentMap(
  location: string,
  baseUrl: string
): Promise<Map<string, number>> {
  try {
    // active_only=false — Treez already controls which discounts are active.
    // If a discount appears in discounts[], Treez has already determined it applies.
    const url = `${baseUrl}/api/collections?location=${encodeURIComponent(location)}&active_only=false`;
    console.log(`[Location API] Fetching discount map from: ${url}`);

    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[Location API] Collections API returned ${res.status}, skipping discounts`);
      return new Map();
    }

    const data: CollectionsApiResponse = await res.json();
    if (!data.success || !data.products_with_discounts) return new Map();

    // Build map: product_id → discount_percent (e.g. 40 means 40% off)
    // sale_price from collections is ignored — we recalculate it here using
    // the correct standardPrice from the product's own pricing object
    const map = new Map<string, number>();
    for (const item of data.products_with_discounts) {
      map.set(item.product_id, item.selected_discount.discount_percent);
    }

    console.log(`[Location API] Got discount % for ${map.size} products`);
    return map;
  } catch (err) {
    console.error("[Location API] Failed to fetch collections:", err);
    return new Map();
  }
}

// ─── CSV Builder ──────────────────────────────────────────────────────────────

function toCsv(
  products: Record<string, unknown>[],
  discountPercentMap: Map<string, number>
): string {
  const lines: string[] = [CSV_HEADERS.join(",")];

  products.forEach((product, index) => {
    const cfg = product.product_configurable_fields as Record<string, unknown> | undefined;
    const treezUuid = getTreezProductListId(product as any);

    // Always use the product's own price_sell as standard price — this is always correct
    const standardPriceNum = toStandardPrice(product);
    const standardPrice = standardPriceNum.toFixed(2);

    let sellPrice = standardPrice;
    let discount = "";

    // Priority 1: Collection-based discount percent
    const discountPercent = discountPercentMap.get(treezUuid);
    if (discountPercent !== undefined && discountPercent > 0) {
      // Calculate sale price locally using the correct standard price
      // Formula: sale_price = price_sell × (1 - discount_percent / 100)
      const salePrice = Math.max(0, standardPriceNum * (1 - discountPercent / 100));
      sellPrice = salePrice.toFixed(2);
      discount = discountPercent.toFixed(2);
    } else {
      // Priority 2: Product-level discount from Treez pricing object
      const pricing = product.pricing as {
        discounted_price?: number;
        discount_percent?: number;
      } | undefined;

      if (pricing?.discounted_price !== undefined && pricing.discounted_price !== null) {
        const n = Number(pricing.discounted_price);
        if (Number.isFinite(n) && n > 0 && n < standardPriceNum) {
          sellPrice = n.toFixed(2);
          discount = pricing.discount_percent
            ? Number(pricing.discount_percent).toFixed(2)
            : "";
        }
      }
    }

    const row = [
      String(index + 1).padStart(3, "0"),
      treezUuid,
      getBarcodeOrFallback(product, index),
      String(cfg?.name ?? product.name ?? product.productName ?? ""),
      String(cfg?.brand ?? product.brand ?? product.brandName ?? ""),
      String(product.category_type ?? product.category ?? product.categoryName ?? ""),
      standardPrice,  // StandardPrice — always regular undiscounted price
      sellPrice,      // SellPrice — correctly calculated from standardPrice × discount
      discount,       // Discount % — e.g. "40.00" for 40% off
      String(cfg?.size ?? ""),
      String(cfg?.size_unit ?? "EA"),
      "",
    ].map(csvEscape);

    lines.push(row.join(","));
  });

  return lines.join("\n");
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const location = searchParams.get("location") || "FRONT OF HOUSE";
  const format = (searchParams.get("format") || "").toLowerCase();
  const wantsCsv = format === "csv" || request.headers.get("accept")?.includes("text/csv");

  const baseUrl = `${request.nextUrl.protocol}//${request.nextUrl.host}`;

  try {
    console.log(`[Location API] Fetching products for location: ${location}`);

    // Fetch products + discount percent map in parallel
    const [products, discountPercentMap] = await Promise.all([
      fetchTreezProducts({
        active: "ALL",
        above_threshold: true,
        sellable_quantity_in_location: location,
        include_discounts: true,
        page_size: 5000,
      }),
      fetchDiscountPercentMap(location, baseUrl),
    ]);

    console.log(`[Location API] Fetched ${products.length} products, ${discountPercentMap.size} with discounts`);

    if (wantsCsv) {
      const csv = toCsv(products, discountPercentMap);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `inline; filename="treez-${location.replace(/\s+/g, "-").toLowerCase()}.csv"`,
        },
      });
    }

    // JSON response — attach resolved discount info to each product
    const enrichedProducts = products.map((product: Record<string, unknown>) => {
      const treezUuid = getTreezProductListId(product as any);
      const standardPriceNum = toStandardPrice(product);
      const discountPercent = discountPercentMap.get(treezUuid);
      const salePrice = discountPercent
        ? Math.max(0, standardPriceNum * (1 - discountPercent / 100))
        : standardPriceNum;

      return {
        ...product,
        resolved_discount: discountPercent
          ? {
              discount_percent: discountPercent,
              standard_price: standardPriceNum,
              sale_price: parseFloat(salePrice.toFixed(2)),
            }
          : null,
      };
    });

    return NextResponse.json({
      success: true,
      location,
      total: enrichedProducts.length,
      discounts_applied: discountPercentMap.size,
      products: enrichedProducts,
    });

  } catch (error: any) {
    console.error("[Location API] Error:", error);
    if (wantsCsv) {
      return new NextResponse(`${CSV_HEADERS.join(",")}\n`, {
        status: 200,
        headers: { "Content-Type": "text/csv; charset=utf-8" },
      });
    }
    return NextResponse.json(
      { error: error.message || "Failed to fetch products" },
      { status: 500 }
    );
  }
}
