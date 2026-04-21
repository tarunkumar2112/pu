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

interface ProductDiscount {
  discount_method?: string;
  discount_amount?: number;
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

function getBestPercentDiscount(product: Record<string, unknown>): number {
  const discounts = product.discounts as ProductDiscount[] | undefined;
  if (!discounts || discounts.length === 0) return 0;

  let best = 0;
  for (const d of discounts) {
    if (d.discount_method !== "PERCENT") continue;
    const amount = Number(d.discount_amount ?? 0);
    if (Number.isFinite(amount) && amount > best) {
      best = amount;
    }
  }
  return best;
}

// ─── CSV Builder ──────────────────────────────────────────────────────────────

function toCsv(products: Record<string, unknown>[]): string {
  const lines: string[] = [CSV_HEADERS.join(",")];

  products.forEach((product, index) => {
    const cfg = product.product_configurable_fields as Record<string, unknown> | undefined;
    const treezUuid = getTreezProductListId(product as any);

    // Always use the product's own price_sell as standard price — this is always correct
    const standardPriceNum = toStandardPrice(product);
    const standardPrice = standardPriceNum.toFixed(2);

    let sellPrice = standardPrice;
    let discount = "";

    const discountPercent = getBestPercentDiscount(product);
    if (discountPercent > 0) {
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

  try {
    console.log(`[Location API] Fetching products for location: ${location}`);

    const products = await fetchTreezProducts({
      active: "ALL",
      above_threshold: true,
      sellable_quantity_in_location: location,
      include_discounts: true,
      page_size: 5000,
    });
    const discountCount = products.reduce((count, product) => {
      return count + (getBestPercentDiscount(product as Record<string, unknown>) > 0 ? 1 : 0);
    }, 0);

    console.log(`[Location API] Fetched ${products.length} products, ${discountCount} with discounts`);

    if (wantsCsv) {
      const csv = toCsv(products);
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
      const standardPriceNum = toStandardPrice(product);
      const discountPercent = getBestPercentDiscount(product);
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
      discounts_applied: discountCount,
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
