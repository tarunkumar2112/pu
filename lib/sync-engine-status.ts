/**
 * In-process sync engine telemetry (cron + webhook).
 * Resets when the Node server restarts.
 */

export type SyncEngineActivity = {
  at: string;
  channel: "change_detection" | "catalog_sync" | "webhook";
  message: string;
  meta?: Record<string, unknown>;
};

const MAX_ACTIVITY = 30;

const state = {
  changeDetection: {
    intervalMinutes: 1,
    lastTickAt: null as string | null,
    lastCompleteAt: null as string | null,
    lastError: null as string | null,
    lastChangesDetected: 0,
    lastSyncedToSupabase: 0,
    lastSyncedToOpticon: 0,
  },
  catalogSync: {
    intervalMinutes: 5,
    lastTickAt: null as string | null,
    lastCompleteAt: null as string | null,
    lastError: null as string | null,
    lastNewProducts: 0,
    lastRemovedFromSupabase: 0,
    lastOpticonUploads: 0,
    lastFailed: 0,
  },
  webhook: {
    lastReceivedAt: null as string | null,
    lastEventType: null as string | null,
    lastProductId: null as string | null,
    totalReceived: 0,
    lastError: null as string | null,
    lastSuccessAt: null as string | null,
  },
  activity: [] as SyncEngineActivity[],
};

function pushActivity(entry: SyncEngineActivity) {
  state.activity.unshift(entry);
  if (state.activity.length > MAX_ACTIVITY) state.activity.length = MAX_ACTIVITY;
}

export function recordChangeDetectionTick() {
  const at = new Date().toISOString();
  state.changeDetection.lastTickAt = at;
  pushActivity({ at, channel: "change_detection", message: "Scheduled check started" });
}

export function recordChangeDetectionResult(payload: {
  changesDetected: number;
  syncedToSupabase: number;
  syncedToOpticon: number;
  error?: string | null;
}) {
  const at = new Date().toISOString();
  state.changeDetection.lastChangesDetected = payload.changesDetected;
  state.changeDetection.lastSyncedToSupabase = payload.syncedToSupabase;
  state.changeDetection.lastSyncedToOpticon = payload.syncedToOpticon;
  if (payload.error) {
    state.changeDetection.lastError = payload.error;
    pushActivity({ at, channel: "change_detection", message: `Error: ${payload.error}` });
  } else {
    state.changeDetection.lastError = null;
    state.changeDetection.lastCompleteAt = at;
    pushActivity({
      at,
      channel: "change_detection",
      message: `Complete: ${payload.changesDetected} change(s); Supabase ${payload.syncedToSupabase}; Opticon ${payload.syncedToOpticon}`,
      meta: payload as Record<string, unknown>,
    });
  }
}

export function recordCatalogSyncTick() {
  const at = new Date().toISOString();
  state.catalogSync.lastTickAt = at;
  pushActivity({ at, channel: "catalog_sync", message: "Catalog sync (new / removed) started" });
}

export function recordCatalogSyncResult(payload: {
  newProducts: number;
  removedFromSupabase: number;
  opticonUploads: number;
  failed: number;
  error?: string | null;
}) {
  const at = new Date().toISOString();
  state.catalogSync.lastNewProducts = payload.newProducts;
  state.catalogSync.lastRemovedFromSupabase = payload.removedFromSupabase;
  state.catalogSync.lastOpticonUploads = payload.opticonUploads;
  state.catalogSync.lastFailed = payload.failed;
  if (payload.error) {
    state.catalogSync.lastError = payload.error;
    pushActivity({ at, channel: "catalog_sync", message: `Error: ${payload.error}` });
  } else {
    state.catalogSync.lastError = null;
    state.catalogSync.lastCompleteAt = at;
    pushActivity({
      at,
      channel: "catalog_sync",
      message: `New ${payload.newProducts}, removed from DB ${payload.removedFromSupabase}, Opticon uploads ${payload.opticonUploads}, failed ${payload.failed}`,
      meta: payload as Record<string, unknown>,
    });
  }
}

export function recordWebhookProduct(payload: {
  productId: string;
  eventSummary: string;
  error?: string | null;
}) {
  const at = new Date().toISOString();
  state.webhook.totalReceived++;
  state.webhook.lastReceivedAt = at;
  state.webhook.lastProductId = payload.productId;
  state.webhook.lastEventType = "PRODUCT";
  if (payload.error) {
    state.webhook.lastError = payload.error;
    pushActivity({ at, channel: "webhook", message: `PRODUCT ${payload.productId}: ${payload.error}` });
  } else {
    state.webhook.lastError = null;
    state.webhook.lastSuccessAt = at;
    pushActivity({
      at,
      channel: "webhook",
      message: payload.eventSummary,
      meta: { product_id: payload.productId },
    });
  }
}

export function getSyncEngineStatus() {
  return {
    changeDetection: { ...state.changeDetection },
    catalogSync: { ...state.catalogSync },
    webhook: { ...state.webhook },
    activity: [...state.activity],
  };
}
