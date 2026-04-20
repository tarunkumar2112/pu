import { NextRequest, NextResponse } from "next/server";
import { fetchTreezTicketPreview, type CartPreviewItemInput } from "@/lib/treez";

type PreviewRequestBody = {
  customer_id?: string;
  items?: CartPreviewItemInput[];
};

type CacheEntry = {
  data: unknown;
  expiresAt: number;
};

const CACHE_TTL_MS = 20_000;
const previewCache = new Map<string, CacheEntry>();

function validateBody(body: PreviewRequestBody): { customerId: string; items: CartPreviewItemInput[] } {
  const customerId = body.customer_id?.trim();
  if (!customerId) throw new Error("customer_id is required");

  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw new Error("items must be a non-empty array");
  }

  const items = body.items.map((item, idx) => {
    const inventoryId = String(item.inventory_id ?? "").trim();
    const quantity = Number(item.quantity);
    if (!inventoryId) throw new Error(`items[${idx}].inventory_id is required`);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error(`items[${idx}].quantity must be a positive number`);
    }
    return { inventory_id: inventoryId, quantity };
  });

  return { customerId, items };
}

function buildCacheKey(customerId: string, items: CartPreviewItemInput[]): string {
  const normalizedItems = [...items]
    .map((i) => ({ inventory_id: i.inventory_id, quantity: i.quantity }))
    .sort((a, b) => a.inventory_id.localeCompare(b.inventory_id));
  return JSON.stringify({ customer_id: customerId, items: normalizedItems });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PreviewRequestBody;
    const { customerId, items } = validateBody(body);
    const cacheKey = buildCacheKey(customerId, items);
    const now = Date.now();

    const cached = previewCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return NextResponse.json({ success: true, data: cached.data, cached: true });
    }

    const data = await fetchTreezTicketPreview({
      customer_id: customerId,
      items,
    });

    previewCache.set(cacheKey, {
      data,
      expiresAt: now + CACHE_TTL_MS,
    });

    console.log(
      `[Cart Preview] customer=${customerId} items=${items.length} total_discount=${data.total_discount} total_price=${data.total_price}`
    );

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to preview cart";
    const status = /required|non-empty|positive number/.test(message) ? 400 : 500;
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status }
    );
  }
}
