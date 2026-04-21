import { NextRequest, NextResponse } from "next/server";
import { fetchTreezProducts, getTreezProductListId } from "@/lib/treez";

interface TreezDiscount {
  discount_id: string;
  discount_title: string;
  discount_method: string;
  discount_amount: number;
  discount_affinity: string;
  discount_product_groups: string[];
  discount_condition_detail: Array<{
    discount_condition_type: string;
    discount_condition_schedule?: {
      start_date: string;
      end_date: string;
      repeat?: { days?: string[] };
    };
  }>;
}

function isCurrentlyActive(discount: TreezDiscount): boolean {
  const now = new Date();
  const scheduleConditions = discount.discount_condition_detail?.filter(
    (c) => c.discount_condition_type === "Schedule"
  );
  if (!scheduleConditions || scheduleConditions.length === 0) return true;

  return scheduleConditions.some((condition) => {
    const schedule = condition.discount_condition_schedule;
    if (!schedule?.start_date || !schedule?.end_date) return true;

    const start = new Date(schedule.start_date);
    const end = new Date(schedule.end_date);
    const nowTime = now.getHours() * 60 + now.getMinutes();
    const startTime = start.getHours() * 60 + start.getMinutes();
    const endTime = end.getHours() * 60 + end.getMinutes();

    const repeat = schedule.repeat as { days?: string[] } | undefined;
    if (repeat?.days && Array.isArray(repeat.days)) {
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const todayName = dayNames[now.getDay()];
      if (!repeat.days.includes(todayName)) return false;
    }

    return nowTime >= startTime && nowTime <= endTime;
  });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const location = searchParams.get("location") || "FRONT OF HOUSE";
  const activeOnly = searchParams.get("active_only") !== "false"; // default true

  try {
    console.log(`[Collections API] Fetching products to build collection map for location: ${location}`);

    const products = await fetchTreezProducts({
      active: "ALL",
      above_threshold: true,
      sellable_quantity_in_location: location,
      include_discounts: true,
      page_size: 5000,
    });

    console.log(`[Collections API] Fetched ${products.length} products`);

    // Build two maps:
    // 1. collection_id → { discount info + product_ids[] }
    // 2. product_id → { product info + discount_ids[] }

    const collectionMap = new Map<string, {
      collection_id: string;
      discount_id: string;
      discount_title: string;
      discount_percent: number;
      is_active_now: boolean;
      product_ids: string[];
      product_names: string[];
    }>();

    const productDiscountMap = new Map<string, {
      product_id: string;
      product_name: string;
      price_sell: number;
      applicable_discounts: Array<{
        discount_id: string;
        discount_title: string;
        discount_percent: number;
        collection_id: string;
        is_active_now: boolean;
      }>;
    }>();

    for (const product of products) {
      const discounts = product.discounts as TreezDiscount[] | undefined;
      if (!discounts || discounts.length === 0) continue;

      const productId = getTreezProductListId(product as any);
      const cfg = product.product_configurable_fields as Record<string, unknown> | undefined;
      const productName = String(cfg?.name ?? product.name ?? "");
      const pricing = product.pricing as { price_sell?: number } | undefined;
      const priceSell = Number(pricing?.price_sell ?? 0);

      for (const discount of discounts) {
        // Phase 1: PERCENT only
        if (discount.discount_method !== "PERCENT") continue;

        const isActive = activeOnly ? isCurrentlyActive(discount) : true;

        // For each collection this discount belongs to
        for (const collectionId of discount.discount_product_groups) {
          // Build collection → products map
          const existing = collectionMap.get(collectionId);
          if (existing) {
            if (!existing.product_ids.includes(productId)) {
              existing.product_ids.push(productId);
              existing.product_names.push(productName);
            }
          } else {
            collectionMap.set(collectionId, {
              collection_id: collectionId,
              discount_id: discount.discount_id,
              discount_title: discount.discount_title,
              discount_percent: discount.discount_amount,
              is_active_now: isActive,
              product_ids: [productId],
              product_names: [productName],
            });
          }

          // Build product → discounts map
          const existingProduct = productDiscountMap.get(productId);
          if (existingProduct) {
            existingProduct.applicable_discounts.push({
              discount_id: discount.discount_id,
              discount_title: discount.discount_title,
              discount_percent: discount.discount_amount,
              collection_id: collectionId,
              is_active_now: isActive,
            });
          } else {
            productDiscountMap.set(productId, {
              product_id: productId,
              product_name: productName,
              price_sell: priceSell,
              applicable_discounts: [{
                discount_id: discount.discount_id,
                discount_title: discount.discount_title,
                discount_percent: discount.discount_amount,
                collection_id: collectionId,
                is_active_now: isActive,
              }],
            });
          }
        }
      }
    }

    // Filter collections to active-only if requested
    let collections = Array.from(collectionMap.values());
    if (activeOnly) {
      collections = collections.filter((c) => c.is_active_now);
    }

    // Build products with discounts list — pick highest % per product (conflict resolution)
    const productsWithDiscounts = Array.from(productDiscountMap.values())
      .filter((p) => !activeOnly || p.applicable_discounts.some((d) => d.is_active_now))
      .map((p) => {
        const activeDiscounts = activeOnly
          ? p.applicable_discounts.filter((d) => d.is_active_now)
          : p.applicable_discounts;

        // Conflict resolution: pick highest percent
        const bestDiscount = activeDiscounts.reduce((best, curr) =>
          curr.discount_percent > best.discount_percent ? curr : best
        );

        const salePrice = parseFloat(
          (p.price_sell * (1 - bestDiscount.discount_percent / 100)).toFixed(2)
        );

        return {
          product_id: p.product_id,
          product_name: p.product_name,
          price_sell: p.price_sell,
          all_applicable_discounts: activeDiscounts,
          selected_discount: bestDiscount,   // highest % wins
          sale_price: salePrice,
        };
      })
      .sort((a, b) => b.selected_discount.discount_percent - a.selected_discount.discount_percent);

    console.log(`[Collections API] Built ${collections.length} collections, ${productsWithDiscounts.length} products with discounts`);

    return NextResponse.json({
      success: true,
      location,
      active_only: activeOnly,
      summary: {
        total_collections: collections.length,
        total_products_with_discounts: productsWithDiscounts.length,
      },
      // collection_id → product_ids mapping
      collections,
      // product_id → resolved discount + sale price
      products_with_discounts: productsWithDiscounts,
    });

  } catch (error: any) {
    console.error("[Collections API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch collections" },
      { status: 500 }
    );
  }
}
