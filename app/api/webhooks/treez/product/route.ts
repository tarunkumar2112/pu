import { NextRequest, NextResponse } from "next/server";
import type { TreezProduct } from "@/lib/treez";
import { extractProductSnapshot, saveProductSnapshot } from "@/lib/change-detector";
import { pushProductToEbs50 } from "@/lib/opticon";
import { recordWebhookProduct } from "@/lib/sync-engine-status";

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
export async function POST(request: NextRequest) {
  if (!verifyWebhook(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const eventType = body?.event_type;
    const data = body?.data;

    if (eventType !== "PRODUCT" || !data?.product_id) {
      return NextResponse.json(
        { success: false, error: "Expected event_type PRODUCT and data.product_id" },
        { status: 400 }
      );
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
