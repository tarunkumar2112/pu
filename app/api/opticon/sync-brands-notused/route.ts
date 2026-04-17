import { NextRequest, NextResponse } from "next/server";

/** Long-running: self-hosted / tunnel recommended; Vercel may time out on full catalogs. */
export const maxDuration = 300;
import {
  fetchTreezProducts,
  getTreezProductListId,
  normalizeTreezProductId,
  treezBrandForOpticonNotUsed,
} from "@/lib/treez";
import { fetchEbs50Products, pushProductToEbs50, ebs50ProductRowToPayload } from "@/lib/opticon";

type Body = {
  /** Same slice as middleware / by-location (default FRONT OF HOUSE) */
  location?: string;
  /** Pause between Opticon writes (ms), default 75 */
  delayMs?: number;
  /** If true, only report counts — no POST to EBS50 */
  dryRun?: boolean;
  /** Max Opticon rows to process (default: all) */
  limit?: number;
};

/**
 * POST /api/opticon/sync-brands-notused
 * For each EBS50 product row, match Barcode (Treez UUID) to Treez catalog and set NotUsed = brand.
 */
export async function POST(request: NextRequest) {
  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    body = {};
  }

  const location = body.location?.trim() || "FRONT OF HOUSE";
  const delayMs = Math.min(Math.max(Number(body.delayMs) || 75, 0), 2000);
  const dryRun = Boolean(body.dryRun);
  const limit = body.limit !== undefined ? Math.min(Math.max(Number(body.limit), 1), 20000) : undefined;

  try {
    const treezProducts = await fetchTreezProducts({
      active: "ALL",
      above_threshold: true,
      sellable_quantity_in_location: location,
      page_size: 5000,
    });

    const brandByBarcode = new Map<string, string>();
    for (const p of treezProducts) {
      const k = normalizeTreezProductId(getTreezProductListId(p));
      if (!k) continue;
      const b = treezBrandForOpticonNotUsed(p);
      if (b) brandByBarcode.set(k, b);
    }

    const opt = await fetchEbs50Products();
    if (!opt.success) {
      return NextResponse.json(
        { success: false, error: opt.error || "Opticon fetch failed" },
        { status: 502 }
      );
    }

    const rows = opt.products;
    const maxRows = limit !== undefined ? Math.min(limit, rows.length) : rows.length;

    let examined = 0;
    let updated = 0;
    let wouldUpdate = 0;
    let skippedNoTreezOrBrand = 0;
    let skippedAlready = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < maxRows; i++) {
      const row = rows[i];
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const rawBc = r.Barcode ?? r.barcode ?? r.BARCODE;
      if (rawBc === undefined || rawBc === null) continue;

      const bc = normalizeTreezProductId(String(rawBc));
      if (!bc) continue;

      examined++;

      const brand = brandByBarcode.get(bc);
      if (!brand) {
        skippedNoTreezOrBrand++;
        continue;
      }

      const curNot = String(r.NotUsed ?? r.notUsed ?? "").trim();
      if (curNot === brand) {
        skippedAlready++;
        continue;
      }

      if (dryRun) {
        wouldUpdate++;
        continue;
      }

      const payload = ebs50ProductRowToPayload(r, { NotUsed: brand });
      const res = await pushProductToEbs50(payload);
      if (res.success) {
        updated++;
      } else {
        failed++;
        if (errors.length < 30) {
          errors.push(`${bc.slice(0, 8)}…: ${res.error || "push failed"}`);
        }
      }

      if (delayMs > 0 && i < maxRows - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      location,
      delayMs,
      treezProductCount: treezProducts.length,
      treezBarcodesWithBrand: brandByBarcode.size,
      opticonRowCount: rows.length,
      rowsProcessed: maxRows,
      examined,
      updated,
      wouldUpdate: dryRun ? wouldUpdate : undefined,
      skippedNoTreezOrBrand,
      skippedAlready,
      failed,
      errors: errors.length ? errors : undefined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
