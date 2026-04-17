import { NextRequest, NextResponse } from "next/server";
import {
  fetchTreezProducts,
  getTreezProductListId,
  normalizeTreezProductId,
  treezBrandForOpticonNotUsed,
} from "@/lib/treez";
import { fetchEbs50Products, pushProductToEbs50, ebs50ProductRowToPayload } from "@/lib/opticon";

/** Long-running: self-hosted / tunnel recommended; Vercel may time out on full catalogs. */
export const maxDuration = 300;

type Body = {
  location?: string;
  delayMs?: number;
  dryRun?: boolean;
  /** Process entire table in one request (legacy). If omitted with no offset, treated as full run. */
  limit?: number;
  /** Start index into Opticon rows (for batched / progress UI). */
  offset?: number;
  /** Rows to process this request (default 120 when offset is used; else all). */
  batchSize?: number;
};

/** Avoid refetching Treez on every batch from the same Node process (serverless: best-effort). */
const brandMapCache = new Map<
  string,
  { expires: number; map: Map<string, string>; treezProductCount: number }
>();
const BRAND_CACHE_MS = 120_000;

async function getBrandByBarcodeMap(location: string): Promise<{
  map: Map<string, string>;
  treezProductCount: number;
}> {
  const now = Date.now();
  const hit = brandMapCache.get(location);
  if (hit && hit.expires > now) return { map: hit.map, treezProductCount: hit.treezProductCount };

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

  brandMapCache.set(location, {
    expires: now + BRAND_CACHE_MS,
    map: brandByBarcode,
    treezProductCount: treezProducts.length,
  });
  return { map: brandByBarcode, treezProductCount: treezProducts.length };
}

/**
 * POST /api/opticon/sync-brands-notused
 * For each EBS50 product row, match Barcode (Treez UUID) to Treez catalog and set NotUsed = brand.
 *
 * **Batched mode:** send `offset` (0-based) and optional `batchSize` (default 120). Response includes
 * `nextOffset`, `hasMore`, and batch counters so the client can show progress.
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
  const explicitOffset = body.offset !== undefined && body.offset !== null;
  const offset = explicitOffset ? Math.max(0, Math.floor(Number(body.offset))) : 0;
  const batchSize = explicitOffset
    ? Math.min(Math.max(Number(body.batchSize) || 120, 1), 500)
    : body.limit !== undefined
      ? Math.min(Math.max(Number(body.limit), 1), 20000)
      : undefined;

  try {
    const { map: brandByBarcode, treezProductCount } = await getBrandByBarcodeMap(location);

    const opt = await fetchEbs50Products();
    if (!opt.success) {
      return NextResponse.json(
        { success: false, error: opt.error || "Opticon fetch failed" },
        { status: 502 }
      );
    }

    const rows = opt.products;
    const totalOpticonRows = rows.length;

    let rangeStart: number;
    let rangeEnd: number;

    if (explicitOffset) {
      const bs = batchSize ?? 120;
      rangeStart = Math.min(offset, totalOpticonRows);
      rangeEnd = Math.min(rangeStart + bs, totalOpticonRows);
    } else if (batchSize !== undefined) {
      rangeStart = 0;
      rangeEnd = Math.min(batchSize, totalOpticonRows);
    } else {
      rangeStart = 0;
      rangeEnd = totalOpticonRows;
    }

    let examined = 0;
    let updated = 0;
    let wouldUpdate = 0;
    let skippedNoTreezOrBrand = 0;
    let skippedAlready = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = rangeStart; i < rangeEnd; i++) {
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
        if (errors.length < 20) {
          errors.push(`${bc.slice(0, 8)}…: ${res.error || "push failed"}`);
        }
      }

      if (delayMs > 0 && i < rangeEnd - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    const nextOffset = rangeEnd;
    const hasMore = nextOffset < totalOpticonRows;

    return NextResponse.json({
      success: true,
      dryRun,
      location,
      delayMs,
      treezProductCount,
      treezBarcodesWithBrand: brandByBarcode.size,
      opticonRowCount: totalOpticonRows,
      batch: {
        offsetStart: rangeStart,
        offsetEnd: nextOffset,
        rowsInBatch: rangeEnd - rangeStart,
        examined,
        updated,
        wouldUpdate: dryRun ? wouldUpdate : undefined,
        skippedNoTreezOrBrand,
        skippedAlready,
        failed,
        errors: errors.length ? errors : undefined,
      },
      nextOffset,
      hasMore,
      progress: {
        processedRows: nextOffset,
        totalRows: totalOpticonRows,
        percent: totalOpticonRows > 0 ? Math.round((nextOffset / totalOpticonRows) * 1000) / 10 : 100,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
