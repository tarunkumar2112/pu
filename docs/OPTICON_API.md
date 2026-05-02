# Opticon EBS50 API Reference

**Links:** [Opticon](https://opticon.com/) | [Treez](https://www.treez.io/)  
**Manuals (official PDFs):**

- [ESL Web Server – User Manual (EBS-50, includes API CSV)](https://www.opticon.com/support/Display%20Solutions/ESL%20Web%20Server/ESL%20Web%20Server%20-%20User%20Manual-EN.pdf)
- [EBS-50 User Manual](https://www.opticon.com/support/Display%20Solutions/EBS-50/EBS-50%20User%20Manual-EN.pdf) (same product line; cross-check chapter numbers)
- [Opticon ESL Server Manual](https://www.opticon.com/support/Display%20Solutions/ESL%20Server/Opticon%20ESL%20Server%20Manual-EN.pdf) (Windows ESL Server app; CSV field separator UI)

---

## HTTP API CSV — confirmed requirements (vs our app)

Use this when the **ESL Web Server** polls your **HTTPS CSV endpoint** (not `ChangeStrings`). Sources: EBS-50 / ESL Web Server manual §8.4.1.1.x (API CSV), ESL Server manual §7.2.6.7 and appendix on CSV format.

| Topic | Confirmed from Opticon docs | Action for our integration |
|--------|-----------------------------|----------------------------|
| **Field delimiter** | **EBS-50 ESL Web Server:** On ingest, the delimiter is **auto-detected** as a single character among **comma, semicolon, tab, pipe, colon, circumflex** (`^`). | **Comma is valid** if the file is consistent. Support’s note about **`;`** matches European CSV and **SQL hybrid** setups where the DB UI uses **“Field separator (for CSV-import)”** — that setting applies to **files dropped in the Input folder**, not necessarily rewriting HTTP bodies. Still: if the server was configured expecting `;`, verify in **Products → database / CSV wizard** what the **parsed** column count is after a test fetch. |
| **Encoding** | Supported: **UTF-8**, UTF-7, **ANSI**, Unicode (others on request). | Emit **UTF-8** without BOM unless Opticon asks otherwise. Set `Content-Type: text/csv; charset=utf-8`. |
| **Line endings** | Docs stress **one record per line**, comment lines with **`#`** first character, optional header detection. | Use **`\n`** or **`\r\n`** consistently **one row per product**. **Never** raw newlines inside a field unless the field is fully **quoted** per RFC 4180 (unquoted newlines → **one giant logical line** → matches support’s parser hang). |
| **Max rows** | “Load full product table in memory” warns for **exceptionally large** tables; no single hard **HTTP CSV row limit** called out in the sections reviewed. | Treat **payload size + parse time** as the limit. For **30s** budgets, cap rows or use **API CSV “modified since”** partial responses (manual §8.4.1.1.3). |
| **HTTP / API CSV behavior** | Endpoint is **http/https** reachable from the ESL Web Server. Optional **request headers** (e.g. API keys). **`modified since`**: ISO 8601 in header and query; **complete reload interval**: every *n*th sync does a **full** fetch without `modified since`. | Implement **`modified since`** if we want incremental CSV; ensure **full** responses stay under timeout. |
| **30 second limit** | **Not** stated as a fixed HTTP read timeout in the manual excerpts we used; it is your **observed / business** constraint (and Margaret’s reliability note). | Aim for about **25 seconds or less** end-to-end; ask Opticon for the **exact HTTP client timeout** on your **firmware / ESL Web Server version**. |
| **Retries / duplicate reloads** | ESL **poll interval** / **poll timeout** in manuals refer to **label ↔ base station** polls (e.g. default **20s** interval), not your CSV URL. | **Five** reloads from one button = treat as **UI retry or timeout resend** until Opticon confirms. Mitigate with **fast responses** and **idempotent** CSV. |

### Support thread (Margaret / engineer) — engineering interpretation

- **“One row, gigantic”:** Almost always **missing physical newlines** (buffering) or **unescaped newlines inside fields** so the server sees **one line**. Fix on our side: strict CSV escaping + reasonable row count.
- **`;` in this database”:** Aligns with **European CSV** or **configured** separator; **EBS-50 auto-detect** still allows `,` **if** the file is self-consistent. When in doubt, **match the sample** Opticon exports from your store wizard.
- **Serverless / Vercel:** Margaret’s point is **latency + cold starts**, not CSV grammar. Production CSV for ESL is better on an **always-on** host or **pre-generated file** if polls must never miss **30s**.

### What to ask Opticon in one email (if anything is still ambiguous)

1. Exact **HTTP(S) read timeout** for **API CSV** on our **ESL Web Server + firmware version**.  
2. Whether **API CSV** responses must use the same **field separator** as the **“Field separator (for CSV-import)”** UI setting when using **SQL hybrid**.  
3. Recommended **max response size** or **max rows per full sync** for stable parsing on EBS-50.  
4. Whether **Reload** on the product table can **retry** the same URL and how many times.

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
