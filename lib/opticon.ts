/**
 * Opticon EBS50 REST API client
 * ESL Web Server – User Manual: https://www.opticon.com/support/Display%20Solutions/ESL%20Web%20Server/ESL%20Web%20Server%20-%20User%20Manual-EN.pdf
 *
 * Connection flow: Treez API → local agent (this app) → EBS50 REST API
 * EBS50 is typically on store's local network (e.g. https://ebs50.local)
 */

import https from "node:https";

function getEbs50BaseUrl(): string {
  const base = process.env.EBS50_BASE_URL ?? "";
  return base.replace(/\/+$/, "");
}

function getEbs50ApiKey(): string {
  return process.env.EBS50_API_KEY ?? "";
}

/** Set to "true" if EBS50 uses self-signed cert (common on local devices) */
function isInsecure(): boolean {
  return process.env.EBS50_INSECURE === "true";
}

async function ebs50Fetch(
  url: string,
  headers: Record<string, string> = {},
  timeoutMs = 10_000
): Promise<Response> {
  if (!isInsecure()) {
    return fetch(url, {
      method: "GET",
      headers: { Accept: "application/json", ...headers },
      signal: AbortSignal.timeout(timeoutMs),
    });
  }
  const agent = new https.Agent({ rejectUnauthorized: false });
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: "GET",
        headers: { Accept: "application/json", ...headers },
        agent,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve(
            new Response(Buffer.concat(chunks).toString(), {
              status: res.statusCode ?? 500,
              headers: new Headers(res.headers as Record<string, string>),
            })
          )
        );
      }
    );
    req.on("error", reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error("timeout"));
    });
    req.end();
  });
}

export interface Ebs50ConnectionResult {
  success: boolean;
  reachable?: boolean;
  authenticated?: boolean;
  version?: string[];
  error?: string;
}

/**
 * Test connection to EBS50.
 * 1. GET /api/ (no auth) – verifies API is reachable, returns version info
 * 2. GET /api/EBS (with x-api-key) – verifies API key is valid
 */
export async function testEbs50Connection(): Promise<Ebs50ConnectionResult> {
  const baseUrl = getEbs50BaseUrl();
  const apiKey = getEbs50ApiKey();

  if (!baseUrl) {
    return {
      success: false,
      error: "EBS50_BASE_URL is not set (e.g. https://ebs50.local)",
    };
  }

  try {
    // Step 1: Root API – no auth required, confirms reachability
    const rootUrl = `${baseUrl}/api/`;
    const rootRes = await ebs50Fetch(rootUrl);

    if (!rootRes.ok) {
      return {
        success: false,
        reachable: true,
        error: `EBS50 responded ${rootRes.status} at ${rootUrl}`,
      };
    }

    let version: string[] = [];
    try {
      const data = await rootRes.json();
      version = Array.isArray(data) ? data : [String(data)];
    } catch {
      // Some EBS50 may return non-JSON
    }

    // Step 2: Authenticated request – verifies API key
    if (!apiKey) {
      return {
        success: true,
        reachable: true,
        authenticated: false,
        version,
        error: "EBS50 reachable but EBS50_API_KEY not set – create API key in EBS50 Account settings",
      };
    }

    const ebsUrl = `${baseUrl}/api/EBS`;
    const ebsRes = await ebs50Fetch(ebsUrl, { "x-api-key": apiKey });

    if (ebsRes.status === 401) {
      return {
        success: false,
        reachable: true,
        authenticated: false,
        version,
        error: "API key invalid or expired – check EBS50 Account → API key",
      };
    }

    if (!ebsRes.ok) {
      return {
        success: false,
        reachable: true,
        authenticated: false,
        version,
        error: `EBS50 API returned ${ebsRes.status}`,
      };
    }

    return {
      success: true,
      reachable: true,
      authenticated: true,
      version,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isNetwork =
      msg.includes("fetch") ||
      msg.includes("ECONNREFUSED") ||
      msg.includes("ENOTFOUND") ||
      msg.includes("timeout") ||
      msg.includes("network");

    return {
      success: false,
      reachable: false,
      error: isNetwork
        ? `Cannot reach EBS50 at ${baseUrl} – ensure this app runs on the same network as the EBS50 (or via VPN)`
        : msg,
    };
  }
}

/** In-process cache so batched brand sync does not re-download the full table every request. */
let ebs50ProductsCache: {
  expires: number;
  value: {
    success: boolean;
    products: Record<string, unknown>[];
    columns?: string[];
    error?: string;
  };
} | null = null;

function productsCacheTtlMs(): number {
  const n = Number(process.env.EBS50_PRODUCTS_CACHE_MS);
  if (Number.isFinite(n) && n >= 0) return n;
  return 180_000;
}

function productsFetchTimeoutMs(): number {
  const n = Number(process.env.EBS50_PRODUCTS_TIMEOUT_MS);
  if (Number.isFinite(n) && n >= 5_000) return n;
  return 300_000;
}

/** Drop cached GET /api/Products (e.g. after external edits on the hub). */
export function clearEbs50ProductsCache(): void {
  ebs50ProductsCache = null;
}

/**
 * Fetch products from EBS50 product table.
 * GET /api/Products – returns all rows; response reveals table structure (columns).
 *
 * `bypassCache`: always hit the hub (e.g. admin product browser).
 * Large stores: set `EBS50_PRODUCTS_TIMEOUT_MS` (default 300000) if downloads are slow.
 */
export async function fetchEbs50Products(options?: { bypassCache?: boolean }): Promise<{
  success: boolean;
  products: Record<string, unknown>[];
  columns?: string[];
  error?: string;
}> {
  const bypassCache = options?.bypassCache === true;
  const ttl = productsCacheTtlMs();
  if (!bypassCache && ttl > 0 && ebs50ProductsCache && ebs50ProductsCache.expires > Date.now()) {
    return ebs50ProductsCache.value;
  }

  const baseUrl = getEbs50BaseUrl();
  const apiKey = getEbs50ApiKey();

  if (!baseUrl) {
    return { success: false, products: [], error: "EBS50_BASE_URL is not set" };
  }
  if (!apiKey) {
    return { success: false, products: [], error: "EBS50_API_KEY is not set" };
  }

  try {
    const url = `${baseUrl}/api/Products`;
    const res = await ebs50Fetch(url, { "x-api-key": apiKey }, productsFetchTimeoutMs());

    if (res.status === 401) {
      return { success: false, products: [], error: "API key invalid or expired" };
    }
    if (!res.ok) {
      return { success: false, products: [], error: `EBS50 returned ${res.status}` };
    }

    const data = await res.json();
    let products: Record<string, unknown>[] = [];

    if (Array.isArray(data)) {
      products = data;
    } else if (data?.Rows && Array.isArray(data.Rows)) {
      products = data.Rows;
    } else if (data?.data && Array.isArray(data.data)) {
      products = data.data;
    } else if (typeof data === "object" && data !== null) {
      products = [data];
    }

    const columns =
      products.length > 0 && typeof products[0] === "object" && products[0] !== null
        ? Object.keys(products[0] as Record<string, unknown>)
        : undefined;

    const value = { success: true as const, products, columns };
    if (!bypassCache && ttl > 0) {
      ebs50ProductsCache = { expires: Date.now() + ttl, value };
    }
    return value;
  } catch (err) {
    return {
      success: false,
      products: [],
      error: err instanceof Error ? err.message : "Failed to fetch products",
    };
  }
}

/**
 * POST to EBS50 (for ChangeProducts, etc.)
 */
async function ebs50Post(url: string, body: unknown, headers: Record<string, string> = {}): Promise<Response> {
  const defaultHeaders: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...headers,
  };
  const bodyStr = body === undefined ? "" : JSON.stringify(body);
  if (!isInsecure()) {
    return fetch(url, {
      method: "POST",
      headers: defaultHeaders,
      body: bodyStr,
      signal: AbortSignal.timeout(15000),
    });
  }
  const agent = new https.Agent({ rejectUnauthorized: false });
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: "POST",
        headers: {
          ...defaultHeaders,
          "Content-Length": Buffer.byteLength(bodyStr),
        },
        agent,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve(
            new Response(Buffer.concat(chunks).toString(), {
              status: res.statusCode ?? 500,
              headers: new Headers(res.headers as Record<string, string>),
            })
          )
        );
      }
    );
    req.on("error", reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error("timeout"));
    });
    req.write(bodyStr);
    req.end();
  });
}

/**
 * Map one EBS50 GET /api/Products row into a POST body (PascalCase keys).
 * Use existing row values so updates do not wipe fields.
 */
export function ebs50ProductRowToPayload(
  row: Record<string, unknown>,
  overrides?: Partial<Record<string, string>>
): Record<string, unknown> {
  const pick = (pascal: string, camel: string, def = ""): string => {
    const v = row[pascal] ?? row[camel];
    if (v === undefined || v === null) return def;
    return String(v);
  };
  const payload: Record<string, unknown> = {
    NotUsed: pick("NotUsed", "notUsed"),
    ProductId: pick("ProductId", "productId"),
    Barcode: pick("Barcode", "barcode"),
    Description: pick("Description", "description"),
    Group: pick("Group", "group"),
    StandardPrice: pick("StandardPrice", "standardPrice"),
    SellPrice: pick("SellPrice", "sellPrice"),
    Discount: pick("Discount", "discount"),
    Content: pick("Content", "content"),
    Unit: pick("Unit", "unit") || "EA",
  };
  if (overrides) {
    for (const [k, v] of Object.entries(overrides)) {
      if (v !== undefined) payload[k] = v;
    }
  }
  return payload;
}

/**
 * Push product(s) to EBS50.
 * Tries v1.0 POST /api/Products first (same format as GET returns).
 * Falls back to v2.0 POST /api/v2.0/Products/ChangeProducts if v1 returns 404.
 */
export async function pushProductToEbs50(product: Record<string, unknown>): Promise<{
  success: boolean;
  error?: string;
}> {
  const baseUrl = getEbs50BaseUrl();
  const apiKey = getEbs50ApiKey();

  if (!baseUrl) return { success: false, error: "EBS50_BASE_URL is not set" };
  if (!apiKey) return { success: false, error: "EBS50_API_KEY is not set" };

  const body = [product];
  const headers = { "x-api-key": apiKey };

  console.log(`[Opticon] Pushing product to EBS50:`, product);

  try {
    // v1.0: POST /api/Products – same format as GET returns
    let url = `${baseUrl}/api/Products`;
    console.log(`[Opticon] Trying v1.0: POST ${url}`);
    let res = await ebs50Post(url, body, headers);
    console.log(`[Opticon] v1.0 Response: ${res.status} ${res.statusText}`);

    if (res.status === 404) {
      // v2.0: POST /api/v2.0/Products/ChangeProducts
      url = `${baseUrl}/api/v2.0/Products/ChangeProducts`;
      console.log(`[Opticon] Trying v2.0: POST ${url}`);
      res = await ebs50Post(url, body, headers);
      console.log(`[Opticon] v2.0 Response: ${res.status} ${res.statusText}`);
    }

    if (res.status === 401) return { success: false, error: "API key invalid or expired" };
    if (!res.ok) {
      const text = await res.text();
      console.error(`[Opticon] Error response:`, text);
      return { success: false, error: `EBS50 returned ${res.status}: ${text.slice(0, 200)}` };
    }

    const text = await res.text();
    console.log(`[Opticon] Success response:`, text);
    
    if (!text) return { success: true };
    try {
      const data = JSON.parse(text) as { Result?: string; Param1?: string };
      console.log(`[Opticon] Parsed response:`, data);
      
      if (data?.Result && data.Result !== "OK" && !String(data.Result).startsWith("OK")) {
        return { success: false, error: data.Result ?? data.Param1 ?? "Unknown error" };
      }
    } catch {
      // v1.0 may return empty or non-JSON; 200 = success
    }
    
    console.log(`[Opticon] ✓ Product pushed successfully`);
    return { success: true };
  } catch (err) {
    console.error(`[Opticon] Exception:`, err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to push product",
    };
  }
}

/**
 * Fetch ESLs from EBS50.
 * GET /api/ESL
 */
export async function fetchEbs50Esls(): Promise<{
  success: boolean;
  esls?: Array<{ Mac?: string; [key: string]: unknown }>;
  error?: string;
}> {
  const baseUrl = getEbs50BaseUrl();
  const apiKey = getEbs50ApiKey();

  if (!baseUrl) return { success: false, error: "EBS50_BASE_URL is not set" };
  if (!apiKey) return { success: false, error: "EBS50_API_KEY is not set" };

  const url = `${baseUrl}/api/ESL`;
  const headers = { "x-api-key": apiKey };

  try {
    const res = await ebs50Fetch(url, headers);
    if (res.status === 401) return { success: false, error: "API key invalid or expired" };
    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `EBS50 returned ${res.status}: ${text.slice(0, 200)}` };
    }
    const data = (await res.json()) as Array<{ Mac?: string; [key: string]: unknown }> | { Mac?: string; [key: string]: unknown };
    const esls = Array.isArray(data) ? data : data ? [data] : [];
    return { success: true, esls };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to fetch ESLs",
    };
  }
}

/**
 * Link ESL (by MAC) to product (by ID, Barcode, or Description).
 * POST /api/ESL/{mac}/LINK/{id}
 */
export async function linkEslToProduct(mac: string, productIdOrBarcode: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const baseUrl = getEbs50BaseUrl();
  const apiKey = getEbs50ApiKey();

  if (!baseUrl) return { success: false, error: "EBS50_BASE_URL is not set" };
  if (!apiKey) return { success: false, error: "EBS50_API_KEY is not set" };

  const encoded = encodeURIComponent(productIdOrBarcode);
  const url = `${baseUrl}/api/ESL/${encodeURIComponent(mac)}/LINK/${encoded}`;
  const headers = { "x-api-key": apiKey };

  try {
    const res = await ebs50Post(url, {}, headers);
    if (res.status === 401) return { success: false, error: "API key invalid or expired" };
    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `EBS50 returned ${res.status}: ${text.slice(0, 200)}` };
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to link ESL",
    };
  }
}
