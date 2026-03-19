import { NextResponse } from "next/server";
import { fetchEbs50Esls } from "@/lib/opticon";

/**
 * GET /api/opticon/esl
 * Returns list of ESLs from EBS50.
 */
export async function GET() {
  try {
    const result = await fetchEbs50Esls();
    return NextResponse.json({
      success: result.success,
      esls: result.esls ?? [],
      error: result.error,
    });
  } catch (error) {
    console.error("Opticon ESL fetch error:", error);
    return NextResponse.json(
      {
        success: false,
        esls: [],
        error: error instanceof Error ? error.message : "Failed to fetch ESLs",
      },
      { status: 500 }
    );
  }
}
