/**
 * Watch List utilities
 * Manages a persistent list of products (by Brand/Type/Subtype/Size/Price)
 * that get matched to Treez product IDs and auto-synced to Opticon EBS50.
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { TreezProduct } from "./treez";

const DATA_FILE = path.join(process.cwd(), "data", "watch-list.json");

export interface WatchListItem {
  id: string;
  brand: string;
  productType: string;
  subtype: string;
  size: string;
  price: number;
  matchedProductId?: string;
  matchedProductName?: string;
  matchedBarcode?: string;
  lastSynced?: string;
  lastSyncSuccess?: boolean;
  lastSyncError?: string;
}

export async function readWatchList(): Promise<WatchListItem[]> {
  try {
    const text = await fs.readFile(DATA_FILE, "utf-8");
    return JSON.parse(text) as WatchListItem[];
  } catch {
    return [];
  }
}

export async function writeWatchList(items: WatchListItem[]): Promise<void> {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(items, null, 2), "utf-8");
}

export function normalize(s: unknown): string {
  if (s === undefined || s === null) return "";
  return String(s).trim().toUpperCase();
}

export function makeItemId(
  brand: string,
  productType: string,
  subtype: string,
  size: string,
  price: number
): string {
  return [normalize(brand), normalize(productType), normalize(subtype), normalize(size), price].join("|");
}

/**
 * Parse tab-separated text pasted from Excel.
 * Expected columns: Brand | Product Type | Subtype | Size | Unit Price
 */
export function parseWatchListText(text: string): Omit<WatchListItem, "id">[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const start = lines[0]?.toLowerCase().includes("brand") ? 1 : 0;
  const result: Omit<WatchListItem, "id">[] = [];

  for (const line of lines.slice(start)) {
    const cols = line.split("\t");
    const brand = cols[0]?.trim() ?? "";
    const productType = cols[1]?.trim() ?? "";
    const subtype = cols[2]?.trim() ?? "";
    const size = cols[3]?.trim() ?? "";
    const priceStr = (cols[4]?.trim() ?? "0").replace(/[$,\s]/g, "");
    const price = parseFloat(priceStr) || 0;
    if (brand && productType) {
      result.push({ brand, productType, subtype, size, price });
    }
  }
  return result;
}

/**
 * Build a lookup map from Treez products keyed by BRAND|TYPE|SUBTYPE|SIZE.
 */
export function buildProductLookup(products: TreezProduct[]): Map<string, TreezProduct[]> {
  const map = new Map<string, TreezProduct[]>();
  for (const p of products) {
    const cfg = (p.product_configurable_fields as Record<string, unknown>) ?? {};
    const key = [
      normalize(cfg.brand ?? p.brand ?? p.brandName),
      normalize(p.category_type ?? p.category ?? p.categoryName),
      normalize(cfg.subtype ?? p.product_subtype ?? p.subtype),
      normalize(cfg.size ?? p.size),
    ].join("|");
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }
  return map;
}

export function getProductPrice(p: TreezProduct): number {
  const pricing = p.pricing as {
    price_sell?: number;
    tier_pricing_detail?: Array<{ price_per_value?: number }>;
  } | undefined;
  return pricing?.price_sell ?? pricing?.tier_pricing_detail?.[0]?.price_per_value ?? 0;
}

/**
 * Find the best matching Treez product for a watch list item.
 * Matches on brand+type+subtype+size, uses price as tiebreaker.
 */
export function matchItemToProduct(
  item: WatchListItem,
  lookup: Map<string, TreezProduct[]>
): TreezProduct | null {
  const key = [
    normalize(item.brand),
    normalize(item.productType),
    normalize(item.subtype),
    normalize(item.size),
  ].join("|");

  const candidates = lookup.get(key);
  if (!candidates || candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  return candidates.reduce((best, p) => {
    const bestDiff = Math.abs(getProductPrice(best) - item.price);
    const pDiff = Math.abs(getProductPrice(p) - item.price);
    return pDiff < bestDiff ? p : best;
  });
}
