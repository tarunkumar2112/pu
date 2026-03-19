import { NextRequest, NextResponse } from "next/server";
import { linkEslToProduct } from "@/lib/opticon";

/**
 * POST /api/opticon/link
 * Body: { mac: string; productIdOrBarcode: string }
 * Links ESL (by MAC) to product (by ID, Barcode, or Description).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const mac = typeof body.mac === "string" ? body.mac.trim() : "";
    const productIdOrBarcode = typeof body.productIdOrBarcode === "string" ? body.productIdOrBarcode.trim() : "";

    if (!mac) {
      return NextResponse.json({ success: false, error: "No ESL MAC provided" }, { status: 400 });
    }
    if (!productIdOrBarcode) {
      return NextResponse.json({ success: false, error: "No product ID or barcode provided" }, { status: 400 });
    }

    const result = await linkEslToProduct(mac, productIdOrBarcode);
    return NextResponse.json({
      success: result.success,
      error: result.error,
    });
  } catch (error) {
    console.error("Opticon link error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to link ESL",
      },
      { status: 500 }
    );
  }
}
