import { NextRequest, NextResponse } from "next/server";
import { type TreezProduct, treezBrandForOpticonNotUsed } from "@/lib/treez";
import { opticonBrandPayload } from "@/lib/opticon-brand-field";
import { extractProductSnapshot, saveProductSnapshot } from "@/lib/change-detector";
import { pushProductToEbs50 } from "@/lib/opticon";
import { recordWebhookProduct } from "@/lib/sync-engine-status";

/** Treez sometimes wraps the payload in `root`; portal “Test” may send non-PRODUCT types. */
function normalizeWebhookPayload(raw: unknown): {
  event_type?: string;
  data?: Record<string, unknown>;
} {
  if (!raw || typeof raw !== "object") return {};
  const b = raw as Record<string, unknown>;
  const root = b.root;
  if (root && typeof root === "object") {
    const r = root as Record<string, unknown>;
    return {
      event_type: typeof r.event_type === "string" ? r.event_type : undefined,
      data: r.data && typeof r.data === "object" ? (r.data as Record<string, unknown>) : undefined,
    };
  }
  return {
    event_type: typeof b.event_type === "string" ? b.event_type : undefined,
    data: b.data && typeof b.data === "object" ? (b.data as Record<string, unknown>) : undefined,
  };
}

function verifyWebhook(request: NextRequest): boolean {
  const secret = process.env.TREEZ_WEBHOOK_SECRET;
  if (!secret) return true;

  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;

  const headerSecret = request.headers.get("x-treez-webhook-secret");
  if (headerSecret === secret) return true;

  return false;
}

/**
 * Treez Product webhook — creation, updates, activate/deactivate, images.
 * POST /api/webhooks/treez/product
 *
 * Configure in Treez portal to point at your public URL, e.g.
 * https://your-domain.com/api/webhooks/treez/product
 *
 * Optional: set TREEZ_WEBHOOK_SECRET and send as
 * Authorization: Bearer <secret> or X-Treez-Webhook-Secret: <secret>
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    path: "/api/webhooks/treez/product",
    hint: "Treez sends PRODUCT events via POST. Use POST for integration tests.",
  });
}

export async function POST(request: NextRequest) {
  if (!verifyWebhook(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rawBody = await request.json();
    const { event_type: eventType, data } = normalizeWebhookPayload(rawBody);

    if (!eventType || eventType !== "PRODUCT") {
      return NextResponse.json({
        success: true,
        ignored: true,
        reason: `No PRODUCT handler for event_type=${eventType ?? "(missing)"} — subscription test OK`,
      });
    }

    if (!data?.product_id) {
      return NextResponse.json({
        success: true,
        ignored: true,
        reason: "PRODUCT event without data.product_id — acknowledged",
      });
    }

    const productId = String(data.product_id);

    const treezProduct = {
      ...data,
      product_id: data.product_id,
      productId: data.product_id,
    } as TreezProduct;

    const snap = extractProductSnapshot(treezProduct);
    const snapshot: any = {
      ...snap,
      last_checked_at: new Date().toISOString(),
      raw_data: treezProduct,
    };

    const save = await saveProductSnapshot(snapshot);
    if (!save.success) {
      recordWebhookProduct({
        productId,
        eventSummary: `PRODUCT webhook: Supabase save failed`,
        error: save.error || "save failed",
      });
      return NextResponse.json({ success: false, error: save.error }, { status: 500 });
    }

    const price = snapshot.price ?? 0;
    const opt = {
      NotUsed: "",
      ...opticonBrandPayload(treezBrandForOpticonNotUsed(treezProduct)),
      ProductId: "",
      Barcode: snapshot.treez_product_id,
      Description: snapshot.product_name || "",
      Group: snapshot.category || "",
      StandardPrice: String(price),
      SellPrice: String(price),
      Discount: "",
      Content: snapshot.size || "",
      Unit: snapshot.unit || "EA",
    };

    const push = await pushProductToEbs50(opt);
    if (!push.success) {
      recordWebhookProduct({
        productId,
        eventSummary: `PRODUCT webhook: Supabase OK, Opticon failed`,
        error: push.error || "opticon push failed",
      });
      return NextResponse.json(
        { success: false, error: push.error, supabase: true, opticon: false },
        { status: 502 }
      );
    }

    const status = String(data.product_status || "");
    recordWebhookProduct({
      productId,
      eventSummary: `PRODUCT webhook: ${status || "update"} — synced to Supabase + Opticon`,
      error: null,
    });

    return NextResponse.json({
      success: true,
      product_id: productId,
      product_status: data.product_status,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    recordWebhookProduct({
      productId: "—",
      eventSummary: "PRODUCT webhook exception",
      error: msg,
    });
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
