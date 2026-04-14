import { NextRequest, NextResponse } from 'next/server';
import { startBackgroundChangeDetection } from '@/lib/background-monitor';

// Global flag to track if monitoring has started
let monitoringInitialized = false;

/**
 * Middleware to initialize background monitoring on any page load
 * This ensures the background job starts as soon as the app is accessed
 */
export function middleware(request: NextRequest) {
  // Start background monitoring if not already started
  if (!monitoringInitialized) {
    console.log('[Middleware] Initializing background monitoring...');
    startBackgroundChangeDetection();
    monitoringInitialized = true;
  }

  return NextResponse.next();
}

// Run middleware on all admin routes
export const config = {
  matcher: '/admin/:path*',
};
