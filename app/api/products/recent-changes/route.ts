import { NextResponse } from "next/server";
import { getRecentChanges } from "@/lib/change-detector";

/** GET /api/products/recent-changes — last N rows from product_changes */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || "25")));

  const res = await getRecentChanges(limit);
  if (!res.success) {
    return NextResponse.json(
      { success: false, error: res.error, changes: [] },
      { status: 500 }
    );
  }
  return NextResponse.json({ success: true, changes: res.changes ?? [] });
}
