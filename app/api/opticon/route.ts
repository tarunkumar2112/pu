import { NextResponse } from "next/server";
import { testEbs50Connection } from "@/lib/opticon";

/**
 * Test Opticon EBS50 connection.
 * GET /api/opticon – no params, uses EBS50_BASE_URL and EBS50_API_KEY from env
 */
export async function GET() {
  try {
    const result = await testEbs50Connection();
    return NextResponse.json({
      success: result.success,
      reachable: result.reachable,
      authenticated: result.authenticated,
      version: result.version,
      error: result.error,
    });
  } catch (error) {
    console.error("Opticon EBS50 connection test error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Connection test failed",
      },
      { status: 500 }
    );
  }
}
