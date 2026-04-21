import { NextRequest, NextResponse } from "next/server";
import { fetchTreezProducts } from "@/lib/treez";

interface TreezDiscount {
  discount_id: string;
  discount_title: string;
  discount_method: string;        // "PERCENT" | "DOLLAR" | "BOGO" | "COST"
  discount_amount: number;
  discount_affinity: string;
  discount_stackable: string;
  discount_product_groups: string[];
  discount_product_groups_required: string[];
  discount_condition_detail: Array<{
    discount_condition_type: string;
    discount_condition_value: string;
    discount_condition_schedule?: {
      type: string;
      start_date: string;
      end_date: string;
      repeat?: unknown;
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
  const format = searchParams.get("format") || "full"; // "full" | "summary"

  try {
    console.log(`[Discounts API] Fetching products for location: ${location}`);

    const products = await fetchTreezProducts({
      active: "ALL",
      above_threshold: true,
      sellable_quantity_in_location: location,
      include_discounts: true,
      page_size: 5000,
    });

    console.log(`[Discounts API] Fetched ${products.length} products`);

    // Extract ALL discount types (PERCENT, DOLLAR, BOGO, COST) for full visibility
    const discountMap = new Map<string, TreezDiscount & { product_count: number }>();

    for (const product of products) {
      const discounts = product.discounts as TreezDiscount[] | undefined;
      if (!discounts || discounts.length === 0) continue;

      for (const discount of discounts) {
        const existing = discountMap.get(discount.discount_id);
        if (existing) {
          existing.product_count++;
        } else {
          discountMap.set(discount.discount_id, { ...discount, product_count: 1 });
        }
      }
    }

    let allDiscounts = Array.from(discountMap.values());

    // Sort alphabetically by title for easy visual comparison with Treez portal
    allDiscounts.sort((a, b) => a.discount_title.localeCompare(b.discount_title));

    console.log(`[Discounts API] Found ${allDiscounts.length} unique discounts (all types)`);

    // ── SUMMARY FORMAT ──────────────────────────────────────────────────────
    // ?format=summary → grouped by method + percent for easy Treez portal comparison
    if (format === "summary") {
      // Group by method
      const byMethod: Record<string, Array<{
        title: string;
        amount: string;
        product_count: number;
        is_active_now: boolean;
      }>> = {};

      for (const d of allDiscounts) {
        const method = d.discount_method; // PERCENT | DOLLAR | BOGO | COST
        if (!byMethod[method]) byMethod[method] = [];

        const amount = method === "PERCENT"
          ? `${d.discount_amount}%`
          : method === "DOLLAR"
          ? `$${d.discount_amount}`
          : method === "BOGO"
          ? `BOGO`
          : `${d.discount_amount}`;

        byMethod[method].push({
          title: d.discount_title,
          amount,
          product_count: d.product_count,
          is_active_now: isCurrentlyActive(d),
        });
      }

      // Also group PERCENT discounts by % value for quick verification
      const percentByValue: Record<string, string[]> = {};
      for (const d of allDiscounts) {
        if (d.discount_method !== "PERCENT") continue;
        const key = `${d.discount_amount}%`;
        if (!percentByValue[key]) percentByValue[key] = [];
        percentByValue[key].push(d.discount_title);
      }

      // Count totals per method
      const countByMethod: Record<string, number> = {};
      for (const [method, items] of Object.entries(byMethod)) {
        countByMethod[method] = items.length;
      }

      return NextResponse.json({
        success: true,
        location,
        // ── Top level counts — compare these with Treez portal ──
        total_all_types: allDiscounts.length,
        count_by_method: countByMethod,

        // ── PERCENT discounts grouped by % — easiest to verify ──
        percent_discounts_by_value: percentByValue,

        // ── Full list grouped by method ──
        by_method: byMethod,
      });
    }

    // ── FULL FORMAT (default) ────────────────────────────────────────────────
    // Optionally filter by active_only
    let discounts = allDiscounts;
    if (activeOnly) {
      discounts = discounts.filter(isCurrentlyActive);
    }

    return NextResponse.json({
      success: true,
      location,
      active_only: activeOnly,
      total: discounts.length,
      total_all_types_before_filter: allDiscounts.length,
      discounts: discounts.map((d) => ({
        discount_id: d.discount_id,
        discount_title: d.discount_title,
        discount_method: d.discount_method,
        discount_percent: d.discount_method === "PERCENT" ? d.discount_amount : null,
        discount_amount: d.discount_amount,
        discount_affinity: d.discount_affinity,
        discount_stackable: d.discount_stackable,
        collection_ids: d.discount_product_groups,
        schedule: d.discount_condition_detail,
        is_active_now: isCurrentlyActive(d),
        product_count: d.product_count,
      })),
    });

  } catch (error: any) {
    console.error("[Discounts API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch discounts" },
      { status: 500 }
    );
  }
}
