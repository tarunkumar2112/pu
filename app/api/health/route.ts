import { NextResponse } from "next/server";

/**
 * Health check endpoint
 * GET /api/health
 *
 * Background crons are opt-in via ENABLE_BACKGROUND_SYNC=true (see /api/monitoring/start).
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    status: "healthy",
    backgroundMonitoring: "not_started_from_health",
    timestamp: new Date().toISOString(),
  });
}
