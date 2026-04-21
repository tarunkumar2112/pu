import { NextRequest, NextResponse } from "next/server";
import { fetchTreezDiscounts, fetchTreezProducts, TreezDirectDiscount } from "@/lib/treez";

function isCurrentlyActive(discount: TreezDirectDiscount): boolean {
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
  const activeOnly = searchParams.get("active_only") !== "false";
  const endpoint = searchParams.get("endpoint") || undefined;
  const format = searchParams.get("format") || "full"; // "full" | "summary"
  const allowFallback = searchParams.get("allow_fallback") !== "false";

  try {
    let source: "direct-discounts" | "products-fallback" = "direct-discounts";
    let directError: string | null = null;
    let allDiscounts: TreezDirectDiscount[] = [];

    try {
      allDiscounts = await fetchTreezDiscounts({ endpointOverride: endpoint });
    } catch (error: any) {
      directError = error?.message || "Unknown direct-discounts error";
      if (!allowFallback) {
        throw error;
      }

      // Fallback mode: derive unique discounts from products when direct endpoint is unavailable.
      const products = await fetchTreezProducts({
        active: "ALL",
        above_threshold: true,
        include_discounts: true,
        page_size: 5000,
      });

      const discountMap = new Map<string, TreezDirectDiscount>();
      for (const product of products) {
        const discounts = product.discounts as TreezDirectDiscount[] | undefined;
        if (!discounts || discounts.length === 0) continue;
        for (const discount of discounts) {
          const id = String(discount.discount_id ?? "");
          if (!id) continue;
          if (!discountMap.has(id)) {
            discountMap.set(id, discount);
          }
        }
      }
      allDiscounts = Array.from(discountMap.values());
      source = "products-fallback";
    }

    const filteredDiscounts = activeOnly
      ? allDiscounts.filter((d) => isCurrentlyActive(d))
      : allDiscounts;

    if (format === "summary") {
      const countByMethod: Record<string, number> = {};
      for (const d of filteredDiscounts) {
        const method = String(d.discount_method ?? "UNKNOWN");
        countByMethod[method] = (countByMethod[method] ?? 0) + 1;
      }

      return NextResponse.json({
        success: true,
        source,
        endpoint_override: endpoint ?? null,
        active_only: activeOnly,
        allow_fallback: allowFallback,
        direct_error: directError,
        total: filteredDiscounts.length,
        total_before_filter: allDiscounts.length,
        count_by_method: countByMethod,
      });
    }

    return NextResponse.json({
      success: true,
      source,
      endpoint_override: endpoint ?? null,
      active_only: activeOnly,
      allow_fallback: allowFallback,
      direct_error: directError,
      total: filteredDiscounts.length,
      total_before_filter: allDiscounts.length,
      discounts: filteredDiscounts,
    });
  } catch (error: any) {
    console.error("[Direct Discounts API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch direct discounts" },
      { status: 500 }
    );
  }
}
