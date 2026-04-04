import { NextRequest, NextResponse } from "next/server";
import {
  readWatchList,
  writeWatchList,
  parseWatchListText,
  makeItemId,
} from "@/lib/watch-list";
import type { WatchListItem } from "@/lib/watch-list";

/** GET /api/watch-list – return saved watch list */
export async function GET() {
  try {
    const items = await readWatchList();
    const matched = items.filter((i) => i.matchedProductId).length;
    const synced = items.filter((i) => i.lastSyncSuccess).length;
    return NextResponse.json({ success: true, items, matched, synced, total: items.length });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to read watch list" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/watch-list
 * Body: { text: string }  – parse pasted tab-separated text and save
 *    or { items: WatchListItem[] } – save items directly
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (typeof body.text === "string") {
      const parsed = parseWatchListText(body.text);
      // Preserve existing match/sync data for items with same ID
      const existing = await readWatchList();
      const existingMap = new Map(existing.map((item) => [item.id, item]));

      const items: WatchListItem[] = parsed.map((item) => {
        const id = makeItemId(item.brand, item.productType, item.subtype, item.size, item.price);
        const prev = existingMap.get(id);
        if (prev) return { ...prev, ...item, id };
        return { ...item, id };
      });

      await writeWatchList(items);
      return NextResponse.json({ success: true, items, count: items.length });
    }

    if (Array.isArray(body.items)) {
      await writeWatchList(body.items as WatchListItem[]);
      return NextResponse.json({ success: true, count: (body.items as WatchListItem[]).length });
    }

    return NextResponse.json(
      { success: false, error: "Provide 'text' (pasted data) or 'items' (array)" },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to save watch list" },
      { status: 500 }
    );
  }
}

/** DELETE /api/watch-list – clear all items */
export async function DELETE() {
  try {
    await writeWatchList([]);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to clear" },
      { status: 500 }
    );
  }
}
