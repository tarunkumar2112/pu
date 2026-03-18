import { NextResponse } from "next/server";
import { getTreezAccessToken } from "@/lib/treez";

/**
 * Test Treez API authentication
 */
export async function GET() {
  try {
    const token = await getTreezAccessToken();
    return NextResponse.json({
      success: true,
      message: "Treez API authentication successful",
      tokenPreview: token ? `${token.slice(0, 20)}...` : null,
    });
  } catch (error) {
    console.error("Treez auth error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Authentication failed",
      },
      { status: 500 }
    );
  }
}
