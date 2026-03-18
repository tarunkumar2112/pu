import { NextResponse } from "next/server";
import { getTreezAccessToken } from "@/lib/treez";

/**
 * Debug endpoint - test product_list request and return full response for troubleshooting
 */
export async function GET() {
  try {
    const token = await getTreezAccessToken();
    const baseUrl = process.env.TREEZ_API_URL?.replace(/\/+$/, "") ?? "";
    const dispensary = process.env.TREEZ_DISPENSARY ?? "";
    const clientId = process.env.TREEZ_CLIENT_ID ?? "somevaluenotvalidatedatthemoment";

    const url = `${baseUrl}/${dispensary}/product/product_list?active=all&above_threshold=true&page=1`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        client_id: clientId,
        Accept: "application/json",
      },
    });

    const body = await response.text();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(body);
    } catch {
      parsed = body;
    }

    return NextResponse.json({
      status: response.status,
      statusText: response.statusText,
      url,
      headersSent: {
        Authorization: `Bearer ${token.slice(0, 20)}...`,
        client_id: clientId,
      },
      responseBody: parsed,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
