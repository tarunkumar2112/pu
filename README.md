# Treez Sync Middleware

Sync products from Treez dispensary POS to Opticon ESL (Electronic Shelf Labels) via EBS50 base stations.

## Features

- **Treez API integration** – Auth and product fetch (v2 sandbox)
- **Admin dashboard** – Product list and manual sync
- **EBS50 ready** – Structure prepared for Opticon ChangeStrings push

## Getting Started

1. Copy `.env.example` to `.env.local` and set your Treez credentials:

```
TREEZ_API_KEY=your_api_key
TREEZ_DISPENSARY=partnersandbox3
TREEZ_API_URL=https://api.treez.io/v2.0/dispensary
```

2. Run the development server:

```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) and go to **Admin Dashboard** to view products and run manual sync.

## Project Structure

- `app/admin/` – Admin dashboard (product list, manual sync)
- `app/api/products/` – Fetch products from Treez
- `app/api/sync/` – Manual sync endpoint
- `app/api/auth/` – Test Treez connection
- `lib/treez.ts` – Treez API client

## Next Steps

- Add EBS50 integration (POST to `/api/v2.0/Products/ChangeStrings`)
- Map Treez product fields to Opticon format
- Deploy agent in-store for EBS50 LAN access
