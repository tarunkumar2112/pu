import { NextResponse } from "next/server";
import { startBackgroundChangeDetection } from "@/lib/background-monitor";

let isMonitoringStarted = false;

/**
 * Initialize background monitoring
 * GET /api/monitoring/start
 */
export async function GET() {
  try {
    if (isMonitoringStarted) {
      return NextResponse.json({
        success: true,
        message: "Background monitoring already running",
        status: "active",
      });
    }

    // Start the cron job
    startBackgroundChangeDetection();
    isMonitoringStarted = true;

    return NextResponse.json({
      success: true,
      message: "Background monitoring started successfully",
      status: "active",
      interval: "1 minute",
    });
  } catch (error) {
    console.error('[Monitoring API] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to start monitoring",
    }, { status: 500 });
  }
}
