# Product IDs Configuration

This file controls which specific products are fetched from Treez.

## How it works

- The API reads this file on every request
- Only products with IDs listed here will be fetched from Treez
- This is **much faster** than fetching all products (11 products vs 36,000+)

## How to edit

Simply edit the `productIds` array below:

```json
{
  "productIds": [
    "your-product-id-1",
    "your-product-id-2",
    "your-product-id-3"
  ]
}
```

## Limits

- Maximum 50 product IDs per the Treez API limit
- If you need more than 50, the system will automatically batch the requests

## To disable ID filtering

To fetch ALL products instead of specific IDs:
1. Empty the array: `"productIds": []`
2. Or delete this file

## Current configuration

Currently configured to fetch **11 specific products**.
