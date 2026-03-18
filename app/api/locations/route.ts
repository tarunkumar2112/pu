import { NextResponse } from "next/server";
import { fetchTreezLocations } from "@/lib/treez";

export async function GET() {
  try {
    const locations = await fetchTreezLocations();
    return NextResponse.json({
      success: true,
      locations: Array.isArray(locations) ? locations : [],
    });
  } catch (error) {
    console.error("Treez locations fetch error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch locations",
      },
      { status: 500 }
    );
  }
}
