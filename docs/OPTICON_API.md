# Opticon EBS50 API Reference

**Links:** [Opticon](https://opticon.com/) | [Treez](https://www.treez.io/)  
**Manual:** [ESL Web Server User Manual (PDF)](https://www.opticon.com/support/Display%20Solutions/ESL%20Web%20Server/ESL%20Web%20Server%20-%20User%20Manual-EN.pdf)

---

## Device List (Perfect Union)

- **EBS50 Hub** – Integrated VPN support, 1 per retail location
- **ESL Labels** – Several hundreds

---

## Treez ↔ Opticon Integration Overview

1. Pull products from Treez API
2. Transform Treez product data into Opticon product-table format
3. Send changed rows to `POST /api/v2.0/Products/ChangeStrings` on the local EBS50
4. Optionally send deletes for discontinued products

**Connection flow:** Treez API → local agent (this app) → EBS-50 REST API

- Treez is cloud-accessible via API/auth
- EBS-50 exposes REST API on store’s local network (e.g. `https://ebs50.local`)
- Local agent makes outbound calls to Treez and local LAN calls to EBS-50

---

## Authentication

- Create API user/role in EBS50, generate API key
- Send API key in request header: `x-api-key`
- API versioning: URI `/api/v2.0/...` or `api-version` header
- JSON is the default format

---

## Root API (Connection Test)

| Method | Endpoint | Auth | Returns |
|--------|----------|------|---------|
| GET | `https://ebs50.local/api/` | None | List of version strings for ESL Web Server and backend |

---

## Products API v2.0 (Product Sync)

### POST /api/v2.0/Products/ChangeStrings

- **Purpose:** Bulk product sync (insert/update/delete)
- **Body:** String array formatted like Opticon product CSV
- **Action column:** `[I]nsert`, `[U]pdate`, `[D]elete` (optional; default = insert/update)
- **Content-Type:** `application/json` or `application/xml`
- **Example (JSON):** `[";001;3083680012256;New product name;93;0,95;0,95;;180;GR"]`

---

## Field Mapping (EBS50 Database Wizard)

Configure which columns map to:

- **Product ID / UID**
- **Barcode**
- **Description**

These fields are used by Quick Link and product lookup when linking labels to products.

---

## ESL API (Labels)

### GET /api/ESL

- Returns all ESLs and their properties

### GET /api/ESL/{mac_or_id}

- Returns ESL by MAC or all ESLs linked to a Product ID

### POST /api/ESL/{mac}/LINK/{id}

- Link ESL to product by ID, Barcode, or Description

### DELETE /api/ESL/{mac}/LINK

- Unlink ESL from product

---

## EBS API (Base Stations)

### GET /api/EBS

- Returns all connected Base Stations and their settings

### GET /api/EBS/ALL

- Returns all Base Stations (including offline)

### GET /api/EBS/{mac}

- Returns settings for a single Base Station

### GET /api/EBS/{mac}/{property}

- Returns a single property (e.g. IP, PORT, MODEL, STATUS, NR_OF_ESL)

---

## Sync Behavior

- Use EBS50 “All data internal” for products
- Push product updates from Treez into EBS50 via REST API
- Keep product table read-only from EBS50 UI; Treez overwrites during sync
- Product sync and label linking are separate; link labels after products exist

---

## Open Question (Asher)

Do we want linking product SKU to ESL labels handled separately, or automate label assignment?
