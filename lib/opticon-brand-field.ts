/**
 * Treez brand is written to this EBS50 product column (PascalCase for JSON API).
 * Override with OPTICON_BRAND_FIELD (server) or NEXT_PUBLIC_OPTICON_BRAND_FIELD (client bundle).
 */
export const DEFAULT_OPTICON_BRAND_FIELD = "Brandname";

export function getOpticonBrandField(): string {
  if (typeof process !== "undefined" && typeof process.env !== "undefined") {
    const server = process.env.OPTICON_BRAND_FIELD?.trim();
    if (server) return server;
    const pub = process.env.NEXT_PUBLIC_OPTICON_BRAND_FIELD?.trim();
    if (pub) return pub;
  }
  return DEFAULT_OPTICON_BRAND_FIELD;
}

export function pascalToCamelFieldKey(pascal: string): string {
  if (!pascal) return "";
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

export function readProductRowBrandField(row: Record<string, unknown>, field = getOpticonBrandField()): string {
  const camel = pascalToCamelFieldKey(field);
  const v = row[field] ?? row[camel];
  if (v === undefined || v === null) return "";
  return String(v);
}

export function writeProductRowBrandField(
  row: Record<string, unknown>,
  value: string,
  field = getOpticonBrandField()
): void {
  row[field] = value;
  row[pascalToCamelFieldKey(field)] = value;
}

/** Single-field override for ebs50ProductRowToPayload / manual product objects. */
export function opticonBrandPayload(brand: string): Record<string, string> {
  const f = getOpticonBrandField();
  if (!brand) return {};
  return { [f]: brand };
}
