import { NextResponse } from "next/server";
import { startBackgroundChangeDetection } from "@/lib/background-monitor";

// This will be initialized when the module loads (on first API call)
let initialized = false;

function ensureBackgroundMonitoringStarted() {
  if (!initialized) {
    console.log('[Init] Starting background monitoring...');
    startBackgroundChangeDetection();
    initialized = true;
  }
}

// Start monitoring as soon as this module loads
ensureBackgroundMonitoringStarted();

/**
 * Health check endpoint
 * GET /api/health
 */
export async function GET() {
  ensureBackgroundMonitoringStarted();
  
  return NextResponse.json({
    success: true,
    status: "healthy",
    backgroundMonitoring: initialized ? "active" : "inactive",
    timestamp: new Date().toISOString(),
  });
}
