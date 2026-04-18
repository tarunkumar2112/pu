import { NextResponse } from "next/server";
import { fetchTreezProducts, getProductDisplay, getTreezProductListId, TreezProduct } from "@/lib/treez";

type DiscountRow = {
  treezProductId: string;
  productName: string;
  brand: string;
  discountName: string;
  discountType: string;
  discountValue: string;
  startsAt: string;
  endsAt: string;
};

function parseDiscountsFromProduct(product: TreezProduct): Array<Record<string, unknown>> {
  const p = product as Record<string, unknown>;
  const pricing = (p.pricing ?? {}) as Record<string, unknown>;
  const candidates: unknown[] = [
    p.discounts,
    p.discount,
    p.active_discounts,
    p.applied_discounts,
    pricing.discounts,
    pricing.discount,
    pricing.applied_discounts,
    p.product_discounts,
    p.discount_list,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((d) => typeof d === "object" && d !== null) as Array<Record<string, unknown>>;
    }
    if (candidate && typeof candidate === "object") {
      return [candidate as Record<string, unknown>];
    }
  }

  return [];
}

function readField(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value);
  }
  return "";
}

function toDiscountRows(products: TreezProduct[]): DiscountRow[] {
  const result: DiscountRow[] = [];

  products.forEach((product) => {
    const display = getProductDisplay(product);
    const productId = getTreezProductListId(product);
    const discounts = parseDiscountsFromProduct(product);

    discounts.forEach((discount) => {
      const discountName = readField(discount, ["name", "discount_name", "title", "discountTitle"]);
      const discountType = readField(discount, ["type", "discount_type", "kind", "calculation_type"]);
      const discountValue = readField(discount, ["value", "amount", "discount_value", "percent", "percentage"]);
      const startsAt = readField(discount, ["start_date", "starts_at", "start", "startDate"]);
      const endsAt = readField(discount, ["end_date", "ends_at", "end", "endDate"]);

      result.push({
        treezProductId: productId || "",
        productName: display.name === "-" ? "" : display.name,
        brand: display.brand === "-" ? "" : display.brand,
        discountName: discountName || "Discount",
        discountType: discountType || "Unknown",
        discountValue: discountValue || "",
        startsAt,
        endsAt,
      });
    });
  });

  return result;
}

export async function GET() {
  try {
    const products = await fetchTreezProducts({
      active: "ALL",
      above_threshold: false,
      include_discounts: true,
      sellable_quantity_in_location: "FRONT OF HOUSE",
    });

    const rows = toDiscountRows(products);
    const byBrand: Record<string, number> = {};
    rows.forEach((row) => {
      const key = row.brand || "Unbranded";
      byBrand[key] = (byBrand[key] ?? 0) + 1;
    });

    return NextResponse.json({
      success: true,
      totalProductsScanned: products.length,
      totalDiscountRows: rows.length,
      brandCounts: byBrand,
      discounts: rows,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch Treez discounts",
      },
      { status: 500 }
    );
  }
}
