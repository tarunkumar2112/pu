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
  product_id?: number;
  sku?: string;
  name?: string;
  productName?: string;
  description?: string;
  barcode?: string;
  price?: number;
  retailPrice?: number;
  category?: string;
  categoryName?: string;
  brand?: string;
  brandName?: string;
  isActive?: boolean;
  updatedDate?: string;
  [key: string]: unknown;
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

  const allProducts: TreezProduct[] = [];
  let page = options.page ?? 1;
  let hasMore = true;

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

    const pageSize = data.page_count ?? (list.length || 1000);
    const totalCount = data.total_count ?? 0;
    const totalPages =
      pageSize > 0 && totalCount > 0 ? Math.ceil(totalCount / pageSize) : 0;

    hasMore =
      list.length >= pageSize && (totalPages === 0 || page < totalPages);
    page++;
  }

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

  const url = `${baseUrl}/product/product_list?${new URLSearchParams(params)}`;

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
