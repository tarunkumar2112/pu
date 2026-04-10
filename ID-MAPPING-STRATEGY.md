# ID Mapping Strategy for Treez-Opticon Sync

## Problem
- Treez uses long UUIDs (36 characters): `4df8b3f6-ea86-4b3f-9e0c-066f828f6d9a`
- Opticon's `ProductId` field has strict MaxLength limit (~10 characters)
- Need to preserve Treez ID for future sync and price updates

## Solution: Sequential Numbers + UUID in Description

### Simple Sequential ProductId
Use **simple numbers** (1, 2, 3, etc.) as `ProductId` in Opticon:
- Product 1 → ProductId = "1"
- Product 2 → ProductId = "2"
- Product 3 → ProductId = "3"
- etc.

### Full UUID in Description
Store the complete Treez UUID in the **Description** field with a special marker:
```
Description: "PRODUCT NAME [TREEZ_ID:4df8b3f6-ea86-4b3f-9e0c-066f828f6d9a]"
```

## Example Mapping

**Treez Products:**
```json
[
  {
    "product_id": "1060459d-bec9-48cf-a779-9f7ae5761337",
    "name": "LEMON JACK 7G",
    "barcode": "4c78d8465085",
    "price": 35.00
  },
  {
    "product_id": "4df8b3f6-ea86-4b3f-9e0c-066f828f6d9a",
    "name": "DO-SI-LATO CURED RESIN 1G",
    "barcode": "3083680012256",
    "price": 45.00
  }
]
```

**Opticon Products:**
```json
[
  {
    "ProductId": "1",  // ← Simple sequential number
    "Barcode": "4c78d8465085",
    "Description": "LEMON JACK 7G [TREEZ_ID:1060459d-bec9-48cf-a779-9f7ae5761337]",  // ← Full UUID
    "StandardPrice": "35.00",
    "SellPrice": "35.00"
  },
  {
    "ProductId": "2",  // ← Next sequential number
    "Barcode": "3083680012256",
    "Description": "DO-SI-LATO CURED RESIN 1G [TREEZ_ID:4df8b3f6-ea86-4b3f-9e0c-066f828f6d9a]",
    "StandardPrice": "45.00",
    "SellPrice": "45.00"
  }
]
```

## Future Sync Strategy

### For Price Updates:
1. **Extract UUID from Description** - Use regex: `/\[TREEZ_ID:(.*?)\]/`
2. **Get updated price from Treez** - Fetch by UUID
3. **Find in Opticon** - Can use ProductId or barcode
4. **Update Price** - Send updated StandardPrice/SellPrice

### Sync Workflow:
```javascript
// 1. Get all Opticon products
const opticonProducts = await fetchEbs50Products();

// 2. For each product, extract Treez UUID
for (const opticonProduct of opticonProducts) {
  const match = opticonProduct.Description.match(/\[TREEZ_ID:(.*?)\]/);
  if (match) {
    const treezUUID = match[1];
    
    // 3. Get updated product from Treez
    const treezProduct = await fetchTreezProductById(treezUUID);
    
    // 4. Compare and update price if changed
    if (treezProduct.price !== parseFloat(opticonProduct.SellPrice)) {
      await updateOpticonProduct(opticonProduct.ProductId, {
        SellPrice: String(treezProduct.price)
      });
    }
  }
}
```

## Benefits

✅ **Super short ProductId** (1, 2, 3) - fits any MaxLength limit  
✅ **Human-readable** - Easy to understand  
✅ **Preserves full Treez UUID** in Description for sync  
✅ **Easy to extract** UUID with regex: `/\[TREEZ_ID:(.*?)\]/`  
✅ **Enables future price updates** via UUID lookup  
✅ **No collision issues** - Sequential numbers guaranteed unique  

## Console Logs

```
[Upload] Product #1: ProductId="1", Treez UUID="1060459d-bec9-48cf-a779-9f7ae5761337", Barcode="..."
[Upload] Product #2: ProductId="2", Treez UUID="4df8b3f6-ea86-4b3f-9e0c-066f828f6d9a", Barcode="..."
```

## UUID Extraction

To get Treez UUID from Opticon product:
```javascript
const description = "LEMON JACK 7G [TREEZ_ID:1060459d-bec9-48cf-a779-9f7ae5761337]";
const match = description.match(/\[TREEZ_ID:(.*?)\]/);
const treezUUID = match ? match[1] : null;
// Result: "1060459d-bec9-48cf-a779-9f7ae5761337"
```
