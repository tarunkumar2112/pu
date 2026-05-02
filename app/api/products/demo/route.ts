import { NextRequest, NextResponse } from "next/server";
import { fetchTreezProducts, getTreezProductListId } from "@/lib/treez";

const ALLOWED_ORIGINS = new Set([
  "http://ebs50.local",
  "http://169.254.139.79",
  "http://169.254.139.79/",
]);

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
  "DiscountTitle",
  "Content",
  "Unit",
  "NotUsed",
];

// ─── Request Deduplication (Simple In-Memory Cache) ─────────────────────────

const REQUEST_CACHE = new Map<
  string,
  { timestamp: number; promise: Promise<any> }
>();
const CACHE_TTL = 5000; // 5 seconds — prevents duplicate simultaneous requests

function getCacheKey(location: string, limit?: number): string {
  return `products:${location}:${limit ?? "all"}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface DiscountSchedule {
  type: string;
  start_date: string;
  end_date: string;
  repeat?: string | {
    interval_type?: string;
    days?: string[];
    end?: string | null;
  };
}

interface DiscountCondition {
  discount_condition_type: string;
  discount_condition_value: string;
  discount_condition_schedule?: DiscountSchedule;
}

interface TreezDiscount {
  discount_id: string;
  discount_title: string;
  discount_method: string;
  discount_amount: number;
  discount_affinity: string;
  discount_stackable: string;
  discount_product_groups: string[];
  discount_condition_detail: DiscountCondition[];
}

// ─── PST Schedule Checker ─────────────────────────────────────────────────────

function getTimeMinutes(isoLike: string): number {
  const m = isoLike.match(/T(\d{2}):(\d{2})/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const d = new Date(isoLike);
  return d.getHours() * 60 + d.getMinutes();
}

function inferWeekdayFromText(text: string | undefined): string | null {
  if (!text) return null;
  const t = text.toLowerCase();
  if (t.includes("monday") || /\bmon\b/.test(t)) return "Monday";
  if (t.includes("tuesday") || /\btue\b/.test(t)) return "Tuesday";
  if (t.includes("wednesday") || /\bwed\b/.test(t)) return "Wednesday";
  if (t.includes("thursday") || /\bthu\b/.test(t)) return "Thursday";
  if (t.includes("friday") || /\bfri\b/.test(t)) return "Friday";
  if (t.includes("saturday") || /\bsat\b/.test(t)) return "Saturday";
  if (t.includes("sunday") || /\bsun\b/.test(t)) return "Sunday";
  return null;
}

function isDiscountActiveNow(discount: TreezDiscount): boolean {
  const nowPST = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" })
  );
  const nowDate = nowPST;
  const nowTimeMinutes = nowPST.getHours() * 60 + nowPST.getMinutes();
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const todayName = dayNames[nowPST.getDay()];

  const scheduleConditions = discount.discount_condition_detail?.filter(
    (c) => c.discount_condition_type === "Schedule"
  );

  if (!scheduleConditions || scheduleConditions.length === 0) return false;

  return scheduleConditions.some((condition) => {
    const schedule = condition.discount_condition_schedule;
    if (!schedule?.start_date || !schedule?.end_date) return false;

    const start = new Date(schedule.start_date);
    const end = new Date(schedule.end_date);
    const startTimeMinutes = getTimeMinutes(schedule.start_date);
    const endTimeMinutes = getTimeMinutes(schedule.end_date);

    if (schedule.type === "DO_NOT") {
      const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      const nowDateOnly = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate());
      return nowDateOnly >= startDateOnly && nowDateOnly <= endDateOnly;
    }

    if (schedule.type === "WEEK" || schedule.type === "CUSTOM") {
      const repeat = schedule.repeat as { days?: string[]; end?: string | null } | undefined;
      if (repeat?.end) {
        const repeatEnd = new Date(repeat.end);
        if (nowDate > repeatEnd) return false;
      }

      let scheduledDay: string | null = null;
      if (repeat?.days && Array.isArray(repeat.days) && repeat.days.length > 0) {
        scheduledDay = repeat.days[0] ?? null;
      } else if (typeof schedule.repeat === "string") {
        scheduledDay = inferWeekdayFromText(schedule.repeat);
      }
      if (!scheduledDay) {
        scheduledDay = inferWeekdayFromText(condition.discount_condition_value);
      }
      if (!scheduledDay) return false;
      if (scheduledDay !== todayName) return false;

      return nowTimeMinutes >= startTimeMinutes && nowTimeMinutes <= endTimeMinutes;
    }

    if (schedule.type === "MONTH") {
      return nowTimeMinutes >= startTimeMinutes && nowTimeMinutes <= endTimeMinutes;
    }

    return true;
  });
}

// ─── Discount Resolver ────────────────────────────────────────────────────────

function getBestActiveDiscount(product: Record<string, unknown>): {
  percent: number;
  title: string;
} | null {
  const discounts = product.discounts as TreezDiscount[] | undefined;
  if (!discounts || discounts.length === 0) return null;

  let best: { percent: number; title: string } | null = null;

  for (const d of discounts) {
    if (d.discount_method !== "PERCENT") continue;

    const amount = Number(d.discount_amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    if (!isDiscountActiveNow(d)) continue;

    if (!best || amount > best.percent) {
      best = { percent: amount, title: d.discount_title };
    }
  }

  return best;
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

// ─── CSV Builder (Streaming-Ready) ────────────────────────────────────────────

function* generateCsvRows(products: Record<string, unknown>[]): Generator<string> {
  // Header row
  yield CSV_HEADERS.join(",");

  // Product rows (for...of so yield stays in the generator body; forEach callbacks cannot yield)
  for (const [index, product] of products.entries()) {
    const cfg = product.product_configurable_fields as Record<string, unknown> | undefined;
    const treezUuid = getTreezProductListId(product as any);
    const standardPriceNum = toStandardPrice(product);
    const standardPrice = standardPriceNum.toFixed(2);

    let sellPrice = standardPrice;
    let discount = "";
    let discountTitle = "";

    const bestDiscount = getBestActiveDiscount(product);
    if (bestDiscount) {
      const salePrice = Math.max(0, standardPriceNum * (1 - bestDiscount.percent / 100));
      sellPrice = salePrice.toFixed(2);
      discount = bestDiscount.percent.toFixed(2);
      discountTitle = bestDiscount.title;
    } else {
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
          discountTitle = "Product-Level Discount";
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
      standardPrice,
      sellPrice,
      discount,
      discountTitle,
      String(cfg?.size ?? ""),
      String(cfg?.size_unit ?? "EA"),
      "",
    ].map(csvEscape).join(",");

    yield row;
  }
}

// ─── CORS Helper ──────────────────────────────────────────────────────────────

function applyCors(request: NextRequest, response: NextResponse): NextResponse {
  const origin = request.headers.get("origin");
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Vary", "Origin");
  }
  response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");
  response.headers.set("Access-Control-Max-Age", "86400");
  return response;
}

// ─── Route Handlers ───────────────────────────────────────────────────────────

export async function OPTIONS(request: NextRequest) {
  return applyCors(request, new NextResponse(null, { status: 204 }));
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const location = searchParams.get("location") || "FRONT OF HOUSE";
  const format = (searchParams.get("format") || "").toLowerCase();
  const wantsCsv = format === "csv" || request.headers.get("accept")?.includes("text/csv");
  const rawLimit = searchParams.get("limit");
  const parsedLimit = rawLimit ? Number(rawLimit) : undefined;
  const limit =
    parsedLimit !== undefined && Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(Math.floor(parsedLimit), 5000)
      : undefined;
  const treezPageSize = limit ? Math.max(limit, 100) : 5000;

  const cacheKey = getCacheKey(location, limit);

  try {
    // ✅ Deduplication: Check if request is already in-flight
    const now = Date.now();
    const cached = REQUEST_CACHE.get(cacheKey);

    if (cached && now - cached.timestamp < CACHE_TTL) {
      console.log(`[Location API] Using cached promise for: ${cacheKey}`);
      const products = await cached.promise;

      // Return CSV or JSON
      if (wantsCsv) {
        const csv = Array.from(generateCsvRows(products)).join("\n");
        return applyCors(
          request,
          new NextResponse(csv, {
            status: 200,
            headers: {
              "Content-Type": "text/csv; charset=utf-8",
              "Content-Disposition": `attachment; filename="treez-${location.replace(/\s+/g, "-").toLowerCase()}.csv"`,
            },
          })
        );
      }

      const enrichedProducts = products.map((product: Record<string, unknown>) => {
        const standardPriceNum = toStandardPrice(product);
        const bestDiscount = getBestActiveDiscount(product);
        return {
          ...product,
          resolved_discount: bestDiscount
            ? {
                discount_title: bestDiscount.title,
                discount_percent: bestDiscount.percent,
                standard_price: standardPriceNum,
                sale_price: parseFloat(
                  Math.max(0, standardPriceNum * (1 - bestDiscount.percent / 100)).toFixed(2)
                ),
              }
            : null,
        };
      });

      return applyCors(
        request,
        NextResponse.json({
          success: true,
          location,
          limit: limit ?? null,
          total: enrichedProducts.length,
          discounts_applied: enrichedProducts.filter((p) => p.resolved_discount).length,
          products: enrichedProducts,
        })
      );
    }

    // ✅ Create promise and cache it
    const fetchPromise = (async () => {
      console.log(`[Location API] Fetching products for location: ${location}`);

      const fetchedProducts = await fetchTreezProducts({
        active: "ALL",
        above_threshold: true,
        sellable_quantity_in_location: location,
        include_discounts: true,
        page_size: treezPageSize,
        ...(limit ? { page: 1 } : {}),
      });

      return limit ? fetchedProducts.slice(0, limit) : fetchedProducts;
    })();

    REQUEST_CACHE.set(cacheKey, {
      timestamp: now,
      promise: fetchPromise,
    });

    // Clean up old cache entries
    for (const [key, value] of REQUEST_CACHE.entries()) {
      if (now - value.timestamp > CACHE_TTL * 2) {
        REQUEST_CACHE.delete(key);
      }
    }

    const products = await fetchPromise;

    const discountCount = products.filter(
      (p) => getBestActiveDiscount(p as Record<string, unknown>) !== null
    ).length;

    console.log(`[Location API] Fetched ${products.length} products, ${discountCount} with active discounts`);

    if (wantsCsv) {
      // ✅ Stream CSV as generator to avoid single giant row
      const csv = Array.from(generateCsvRows(products)).join("\n");

      return applyCors(
        request,
        new NextResponse(csv, {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="treez-${location.replace(/\s+/g, "-").toLowerCase()}.csv"`,
          },
        })
      );
    }

    // JSON response
    const enrichedProducts = products.map((product: Record<string, unknown>) => {
      const standardPriceNum = toStandardPrice(product);
      const bestDiscount = getBestActiveDiscount(product);
      return {
        ...product,
        resolved_discount: bestDiscount
          ? {
              discount_title: bestDiscount.title,
              discount_percent: bestDiscount.percent,
              standard_price: standardPriceNum,
              sale_price: parseFloat(
                Math.max(0, standardPriceNum * (1 - bestDiscount.percent / 100)).toFixed(2)
              ),
            }
          : null,
      };
    });

    return applyCors(
      request,
      NextResponse.json({
        success: true,
        location,
        limit: limit ?? null,
        total: enrichedProducts.length,
        discounts_applied: discountCount,
        products: enrichedProducts,
      })
    );

  } catch (error: any) {
    console.error("[Location API] Error:", error);

    // Clear cache on error
    REQUEST_CACHE.delete(cacheKey);

    if (wantsCsv) {
      return applyCors(
        request,
        new NextResponse(`${CSV_HEADERS.join(",")}\n`, {
          status: 200,
          headers: { "Content-Type": "text/csv; charset=utf-8" },
        })
      );
    }

    return applyCors(
      request,
      NextResponse.json(
        { error: error.message || "Failed to fetch products" },
        { status: 500 }
      )
    );
  }
}
