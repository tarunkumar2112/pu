/**
 * Treez API Client
 * Handles authentication and product fetching for Treez dispensary API v2
 */

const DEFAULT_CLIENT_ID = "somevaluenotvalidatedatthemoment";

function getClientId(): string {
  return process.env.TREEZ_CLIENT_ID ?? DEFAULT_CLIENT_ID;
}

export interface TreezTokenResponse {
  resultCode: string;
  resultReason?: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  expires_in: number;
}

export interface TreezProduct {
  productId?: number;
  product_id?: string | number;
  sku?: string;
  name?: string;
  productName?: string;
  description?: string;
  barcode?: string;
  price?: number;
  retailPrice?: number;
  category?: string;
  category_type?: string;
  categoryName?: string;
  brand?: string;
  brandName?: string;
  isActive?: boolean;
  updatedDate?: string;
  product_status?: string;
  sellable_quantity?: number;
  product_configurable_fields?: Record<string, unknown>;
  pricing?: Record<string, unknown>;
  product_barcodes?: Array<{ sku?: string; type?: string }>;
  e_commerce?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ProductDisplay {
  name: string;
  status: string;
  sku: string;
  category: string;
  brand: string;
  size: string;
  price: string;
  tier: string;
  subtype: string;
  qty: string;
  minVisible: string;
}

export function getProductDisplay(p: TreezProduct): ProductDisplay {
  const get = (v: unknown): string =>
    v === undefined || v === null ? "-" : String(v);
  const num = (v: unknown): string =>
    typeof v === "number" && !Number.isNaN(v) ? String(v) : "-";
  const cfg = p.product_configurable_fields as Record<string, unknown> | undefined;
  const pricing = p.pricing as {
    price_sell?: number;
    tier_name?: string;
    tier_pricing_detail?: Array<{ price_per_value?: number }>;
  } | undefined;
  const tierDetail = pricing?.tier_pricing_detail?.[0];
  const priceVal = pricing?.price_sell ?? tierDetail?.price_per_value ?? p.price ?? p.retailPrice;
  const skuFromBc = (p.product_barcodes as Array<{ sku?: string }> | undefined)?.[0]?.sku;
  const statusVal = p.product_status ?? (p.isActive === true ? "ACTIVE" : p.isActive === false ? "DEACTIVATED" : undefined);
  return {
    name: get(cfg?.name ?? p.name ?? p.productName ?? (p.e_commerce as { menu_title?: string })?.menu_title),
    status: get(statusVal) === "ACTIVE" ? "Active" : get(statusVal) === "DEACTIVATED" ? "Deactivated" : get(statusVal),
    sku: get(skuFromBc ?? cfg?.external_id ?? p.sku),
    category: get(p.category_type ?? p.category ?? p.categoryName ?? cfg?.category),
    brand: get(cfg?.brand ?? p.brand ?? p.brandName),
    size: get(cfg?.size ?? p.size ?? p.size_unit ?? p.productSize),
    price: typeof priceVal === "number" ? `$${priceVal}` : num(priceVal),
    tier: get(pricing?.tier_name ?? p.category_type ?? p.tier),
    subtype: get(cfg?.subtype ?? p.product_subtype ?? p.subtype),
    qty: num(p.sellable_quantity ?? p.quantity ?? p.qty),
    minVisible: num((p.e_commerce as { minimum_visible_inventory_level?: number })?.minimum_visible_inventory_level ?? p.min_visible_quantity ?? p.minVisible ?? p.min_visible),
  };
}

/**
 * Get nested value from object by dot path (e.g. "product_configurable_fields.name").
 * Supports array indices: "product_barcodes[0].sku"
 */
export function getNestedValue(obj: unknown, path: string): unknown {
  if (obj === undefined || obj === null) return undefined;
  const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
  let current: unknown = obj;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    const num = parseInt(part, 10);
    if (!Number.isNaN(num) && Array.isArray(current)) {
      current = current[num];
    } else if (typeof current === "object" && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

/** Check if product has "ESL" in attributes.internal_tags or internal_tags directly */
export function productHasEslTag(p: TreezProduct): boolean {
  const attrs = p.attributes as { internal_tags?: any[] } | undefined;
  const directTags = (p as { internal_tags?: any[] }).internal_tags;
  const tags = attrs?.internal_tags ?? directTags;
  
  const productName = p.name ?? p.productName ?? (p.product_configurable_fields as any)?.name ?? 'Unknown';
  
  if (!Array.isArray(tags)) {
    // Check if internal_tags exists anywhere else in the product object
    const allKeys = Object.keys(p);
    const tagKeys = allKeys.filter(k => k.toLowerCase().includes('tag'));
    if (tagKeys.length > 0) {
      console.log(`[ESL Check] ${productName} - Found tag-related keys:`, tagKeys.map(k => `${k}: ${JSON.stringify((p as any)[k])}`));
    }
    return false;
  }
  
  // Log the actual structure of tags
  console.log(`[ESL Check] ${productName} - Tags structure:`, JSON.stringify(tags, null, 2));
  
  // Check if tags contain ESL as text or if there's a UUID
  const hasEslText = tags.some((t) => String(t).toUpperCase() === "ESL");
  const hasEslInObject = tags.some((t) => {
    if (typeof t === 'object' && t !== null) {
      const str = JSON.stringify(t).toUpperCase();
      return str.includes('ESL');
    }
    return false;
  });
  
  const hasEsl = hasEslText || hasEslInObject;
  console.log(`[ESL Check] ${productName} - Has ESL: ${hasEsl} (text: ${hasEslText}, in object: ${hasEslInObject})`);
  
  return hasEsl;
}

/** Check if product has a barcode (product_barcodes, manufacturer_barcode, or barcode) */
export function productHasBarcode(p: TreezProduct): boolean {
  const barcodes = p.product_barcodes as Array<{ sku?: string; barcode?: string }> | undefined;
  const first = barcodes?.[0];
  const fromBarcodes = first?.sku ?? (first as { barcode?: string })?.barcode;
  const cfg = p.product_configurable_fields as Record<string, unknown> | undefined;
  const manufacturerBc = cfg?.manufacturer_barcode as string | undefined;
  const val = fromBarcodes ?? manufacturerBc ?? p.barcode ?? "";
  return typeof val === "string" && val.trim() !== "";
}

export interface TreezProductResponse {
  resultCode?: string;
  resultReason?: string;
  products?: TreezProduct[];
  product?: TreezProduct[];
  data?: TreezProduct[];
  page_count?: number;
  total_count?: number;
  product_list?: TreezProduct[];
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getBaseUrl(): Promise<string> {
  const baseUrl = (process.env.TREEZ_API_URL ?? "").replace(/\/+$/, "");
  const dispensary = process.env.TREEZ_DISPENSARY;
  if (!baseUrl || !dispensary) {
    throw new Error("TREEZ_API_URL and TREEZ_DISPENSARY must be set in environment");
  }
  return `${baseUrl}/${dispensary}`;
}

export async function getTreezAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
    return cachedToken.token;
  }

  const apiKey = process.env.TREEZ_API_KEY;
  if (!apiKey) {
    throw new Error("TREEZ_API_KEY must be set in environment");
  }

  const baseUrl = await getBaseUrl();
  const response = await fetch(`${baseUrl}/config/api/gettokens`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      apikey: apiKey,
      client_id: getClientId(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Treez auth failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as TreezTokenResponse;
  if (data.resultCode !== "SUCCESS") {
    throw new Error(data.resultReason || "Treez authentication failed");
  }

  const expiresIn = (data.expires_in || 7200) * 1000;
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + expiresIn,
  };

  return data.access_token;
}

export interface TreezLocation {
  id?: string;
  name?: string;
  active?: boolean;
  inventory_type?: string;
  sellable?: boolean;
  parent_location_id?: string;
  [key: string]: unknown;
}

/**
 * Fetch locations from Treez API.
 * GET /location/list
 */
export async function fetchTreezLocations(): Promise<TreezLocation[]> {
  const token = await getTreezAccessToken();
  const baseUrl = await getBaseUrl();

  const url = `${baseUrl}/location/list?sellable=true`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "client_id": getClientId(),
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Treez location/list failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as {
    resultCode?: string;
    data?: TreezLocation[] | { location_list?: TreezLocation[] };
    location_list?: TreezLocation[];
  };

  if (data.data) {
    const d = data.data;
    if (Array.isArray(d)) return d;
    if (typeof d === "object" && "location_list" in d) return (d as { location_list?: TreezLocation[] }).location_list ?? [];
  }
  return data.location_list ?? [];
}

export interface FetchProductsOptions {
  /** active=TRUE | FALSE | ALL - default: ALL */
  active?: "TRUE" | "FALSE" | "ALL";
  /** only products above minimum visible inventory - default: true */
  above_threshold?: boolean;
  /** pagination page number */
  page?: number;
  /** items per page (default 1000 from Treez when excluded) */
  page_size?: number;
  /** filter by category_type */
  category_type?: string;
  /** up to 50 product IDs to fetch */
  ID?: string;
  /** filter by location */
  sellable_quantity_in_location?: string;
  /** MEDICAL | ADULT | ALL */
  sellable_quantity_in_type?: "MEDICAL" | "ADULT" | "ALL";
  /** include discount data */
  include_discounts?: boolean;
  /** filter by internal tag (e.g., "ESL") */
  internal_tag?: string;
}

/**
 * Fetch all products from Treez product_list endpoint.
 * Uses pagination to retrieve full catalog (max ~1000 per page).
 */
export async function fetchTreezProducts(
  options: FetchProductsOptions = {}
): Promise<TreezProduct[]> {
  const token = await getTreezAccessToken();
  const baseUrl = await getBaseUrl();

  const defaultParams: Record<string, string> = {
    active: (options.active ?? "ALL").toLowerCase(),
    above_threshold: String(options.above_threshold ?? false),
    include_discounts: "FALSE",
  };

  if (options.page !== undefined) defaultParams.page = String(options.page);
  if (options.category_type) defaultParams.category_type = options.category_type;
  if (options.ID) defaultParams.ID = options.ID;
  if (options.sellable_quantity_in_location)
    defaultParams.sellable_quantity_in_location = options.sellable_quantity_in_location;
  if (options.sellable_quantity_in_type)
    defaultParams.sellable_quantity_in_type = options.sellable_quantity_in_type;
  if (options.include_discounts === true) defaultParams.include_discounts = "TRUE";
  if (options.internal_tag) defaultParams.internal_tag = options.internal_tag;

  const allProducts: TreezProduct[] = [];
  let page = 1;
  let hasMore = true;
  const singlePageMode = options.page !== undefined;

  while (hasMore) {
    const params = new URLSearchParams({ ...defaultParams, page: String(page) });
    const url = `${baseUrl}/product/product_list?${params}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "client_id": getClientId(),
      Accept: "application/json",
    };

    const response = await fetch(url, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const body = await response.text();
      const hint =
        response.status === 403
          ? ` - Response: ${body.slice(0, 200)}`
          : "";
      throw new Error(`Treez product_list failed: ${response.status} ${response.statusText}${hint}`);
    }

    const data = (await response.json()) as TreezProductResponse & {
      product_list?: TreezProduct[];
      data?: TreezProduct[] | { product_list?: TreezProduct[]; products?: TreezProduct[] };
    };

    let products: TreezProduct[] | undefined = data.product_list ?? data.products ?? data.product;
    if (!products && data.data) {
      if (Array.isArray(data.data)) products = data.data;
      else if (typeof data.data === "object")
        products = (data.data as { product_list?: TreezProduct[] }).product_list ?? (data.data as { products?: TreezProduct[] }).products;
    }
    const list = Array.isArray(products) ? products : [];
    allProducts.push(...list);
    
    console.log(`[Treez] Page ${page}: fetched ${list.length} products, total so far: ${allProducts.length}`);

    const pageSize = data.page_count ?? (list.length || 1000);
    const totalCount = data.total_count ?? 0;
    const totalPages =
      pageSize > 0 && totalCount > 0 ? Math.ceil(totalCount / pageSize) : 0;

    if (singlePageMode) {
      hasMore = false;
    } else {
      hasMore =
        list.length >= pageSize && (totalPages === 0 || page < totalPages);
    }
    page++;
  }

  console.log(`[Treez] Total products fetched: ${allProducts.length}`);
  return allProducts;
}

export interface ProductListPageResult {
  products: TreezProduct[];
  page_count: number;
  total_count: number;
  page: number;
}

/**
 * Fetch a single page of products from Treez (faster, for paginated UI).
 * Uses include_discounts=false for smaller payload per Treez docs.
 */
export async function fetchTreezProductsPage(
  page: number = 1,
  options: Omit<FetchProductsOptions, "page"> = {}
): Promise<ProductListPageResult> {
  const token = await getTreezAccessToken();
  const baseUrl = await getBaseUrl();

  const params: Record<string, string> = {
    page: String(page),
    active: (options.active ?? "ALL").toLowerCase(),
    above_threshold: String(options.above_threshold ?? false),
    include_discounts: "FALSE",
  };
  if (options.page_size) params.page_size = String(options.page_size);
  if (options.category_type) params.category_type = options.category_type;
  if (options.ID) params.ID = options.ID;
  if (options.sellable_quantity_in_location)
    params.sellable_quantity_in_location = options.sellable_quantity_in_location;
  if (options.sellable_quantity_in_type)
    params.sellable_quantity_in_type = options.sellable_quantity_in_type;
  if (options.internal_tag) params.internal_tag = options.internal_tag;

  const url = `${baseUrl}/product/product_list?${new URLSearchParams(params)}`;
  
  console.log(`[Treez API] Calling: ${url.replace(baseUrl, '[BASE_URL]')}`);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "client_id": getClientId(),
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Treez product_list failed: ${response.status} ${response.statusText}${body.slice(0, 150)}`);
  }

  const data = (await response.json()) as TreezProductResponse & {
    data?: { product_list?: TreezProduct[]; page_count?: number; total_count?: number };
  };

  let products: TreezProduct[] = [];
  let pageCount = 0;
  let totalCount = 0;

  if (data.data && typeof data.data === "object" && !Array.isArray(data.data)) {
    const d = data.data as { product_list?: TreezProduct[]; page_count?: number; total_count?: number };
    products = d.product_list ?? [];
    pageCount = d.page_count ?? products.length;
    totalCount = d.total_count ?? 0;
  } else {
    products = data.product_list ?? data.products ?? data.product ?? [];
    pageCount = data.page_count ?? products.length;
    totalCount = data.total_count ?? 0;
  }

  console.log(`[Treez API] Response - products: ${products.length}, page_count: ${pageCount}, total_count: ${totalCount}`);

  return {
    products: Array.isArray(products) ? products : [],
    page_count: pageCount,
    total_count: totalCount,
    page,
  };
}

/**
 * Fetch a single product by ID from Treez API.
 * Tries: 1) GET /product/{product_id}, 2) GET /product/product_list?ID={product_id}
 */
export async function fetchTreezProductById(productId: string): Promise<TreezProduct | null> {
  const token = await getTreezAccessToken();
  const baseUrl = await getBaseUrl();
  const headers = {
    Authorization: `Bearer ${token}`,
    "client_id": getClientId(),
    Accept: "application/json",
  };

  const tryPath = async (url: string) => {
    const res = await fetch(url, { method: "GET", headers });
    if (!res.ok) return null;
    const data = (await res.json()) as TreezProductResponse & {
      data?: TreezProduct | TreezProduct[] | { product_list?: TreezProduct[] };
    };
    let product: TreezProduct | undefined;
    if (data.data) {
      const d = data.data;
      if (Array.isArray(d)) product = d[0];
      else if (typeof d === "object" && "product_list" in d) product = (d as { product_list?: TreezProduct[] }).product_list?.[0];
      else product = d as TreezProduct;
    } else {
      product = data.product_list?.[0] ?? data.products?.[0] ?? data.product?.[0];
    }
    return product ?? null;
  };

  const pathUrl = `${baseUrl}/product/${encodeURIComponent(productId)}?include_discounts=FALSE`;
  let product = await tryPath(pathUrl);
  if (product) return product;

  const listUrl = `${baseUrl}/product/product_list?ID=${encodeURIComponent(productId)}&include_discounts=FALSE`;
  product = await tryPath(listUrl);
  return product;
}
