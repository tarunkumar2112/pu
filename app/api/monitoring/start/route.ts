import { NextResponse } from "next/server";
import { startBackgroundChangeDetection } from "@/lib/background-monitor";

let isMonitoringStarted = false;

function isBackgroundSyncEnabled(): boolean {
  const v = process.env.ENABLE_BACKGROUND_SYNC?.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

/**
 * Initialize background monitoring
 * GET /api/monitoring/start
 */
export async function GET() {
  try {
    if (!isBackgroundSyncEnabled()) {
      return NextResponse.json({
        success: false,
        message:
          "Background monitoring is off. Set ENABLE_BACKGROUND_SYNC=true in the environment, restart the server, then call this route again.",
        status: "disabled",
      });
    }

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
