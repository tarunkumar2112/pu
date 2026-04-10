# Upload to Opticon Feature

## Overview
Feature to upload Treez products to Opticon EBS50 ESL system.

## Features Implemented

### 1. Individual Upload
- **Upload button on each product row** in the Actions column
- Click "Upload" to send a single product to Opticon
- Real-time status indicators:
  - `Upload` (idle) - Ready to upload
  - `Uploading...` (blue) - Upload in progress
  - `✓ Uploaded` (green) - Successfully uploaded
  - `✗ Failed` (red) - Upload failed

### 2. Bulk Upload
- **"Upload All to Opticon"** button at the top of the page
- Uploads all products sequentially with 500ms delay between each
- Shows count: "Upload All to Opticon (11)"
- Disabled when:
  - Loading products
  - Already uploading
  - No products available
  - Opticon not connected

### 3. Data Mapping (Treez → Opticon)

Maps Treez product fields to Opticon's required format:

```javascript
{
  NotUsed: "",                    // Required empty field
  ProductId: product_id,          // Unique product identifier
  Barcode: barcode,               // Product barcode (from barcodes array)
  Description: name,              // Product name
  Group: category,                // Product category/group
  StandardPrice: price,           // Regular price (as string)
  SellPrice: price,               // Selling price (same as standard for now)
  Discount: "",                   // Discount (empty if none)
  Content: size,                  // Product size/content
  Unit: size_unit or "EA"         // Unit of measure (EA = Each)
}
```

**Note:** All price values are converted to strings as required by Opticon API.

### 4. Status Tracking
- Each product has its own upload status
- Status persists during the session
- Success status auto-clears after 3 seconds
- Console logs show upload errors

## Usage

### Upload Single Product
1. Find the product in the table
2. Click the **"Upload"** button in the Actions column
3. Watch the status change from "Uploading..." to "✓ Uploaded"

### Upload All Products
1. Click **"Upload All to Opticon (X)"** button at the top
2. All products will be uploaded one by one
3. Each product's status will update as it uploads

## Requirements
- Opticon connection must be active (green status badge)
- If Opticon is not connected, upload buttons are disabled

## API Endpoint Used
- `POST /api/opticon/products`
- Body: Opticon product object (mapped from Treez format)

## Error Handling
- Upload failures are indicated with red "✗ Failed" button
- Errors are logged to console
- Failed uploads can be retried by clicking the upload button again

## Next Steps (To Discuss)
1. Link uploaded products to ESL labels
2. Batch update/sync feature
3. Product comparison (Treez vs Opticon)
4. Update existing products in Opticon
