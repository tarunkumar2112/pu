'use client';

import { useEffect } from 'react';

/**
 * Initialize background monitoring on app load
 * This component should be included in the root layout
 */
export function BackgroundMonitorInit() {
  useEffect(() => {
    // Call health check to ensure background monitoring starts
    fetch('/api/health')
      .then(res => res.json())
      .then(data => {
        if (data.backgroundMonitoring === 'active') {
          console.log('✅ Background monitoring confirmed active');
        }
      })
      .catch(err => {
        console.error('Failed to check background monitoring:', err);
      });
  }, []);

  return null; // This component doesn't render anything
}
