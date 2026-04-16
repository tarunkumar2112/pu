import { NextResponse } from "next/server";
import { getSyncEngineStatus } from "@/lib/sync-engine-status";

/**
 * GET /api/sync/engine-status
 * Telemetry for cron + webhook sync engine (in-process).
 */
export async function GET() {
  const status = getSyncEngineStatus();
  return NextResponse.json({
    success: true,
    ...status,
  });
}
