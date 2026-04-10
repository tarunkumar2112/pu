# ID Mapping Strategy for Treez-Opticon Sync

## Problem
- Treez uses long UUIDs (36 characters): `4df8b3f6-ea86-4b3f-9e0c-066f828f6d9a`
- Opticon's `ProductId` field has MaxLength limit (probably ~20 characters)
- Need to preserve Treez ID for future sync and price updates

## Solution

### Short ID for ProductId
Use **Barcode** as the `ProductId` in Opticon (shorter and unique):
- If barcode exists → Use it as ProductId
- If no barcode → Use first 20 characters of UUID

### Full ID Preservation
Store the complete Treez UUID in the **Description** field:
```
Description: "PRODUCT NAME [4df8b3f6-ea86-4b3f-9e0c-066f828f6d9a]"
```

## Example Mapping

**Treez Product:**
```json
{
  "product_id": "4df8b3f6-ea86-4b3f-9e0c-066f828f6d9a",
  "name": "DO-SI-LATO CURED RESIN 1G",
  "barcode": "4c78d8465085",
  "price": 45.00
}
```

**Opticon Product:**
```json
{
  "NotUsed": "",
  "ProductId": "4c78d8465085",  // ← Short barcode as ID
  "Barcode": "4c78d8465085",
  "Description": "DO-SI-LATO CURED RESIN 1G [4df8b3f6-ea86-4b3f-9e0c-066f828f6d9a]",  // ← Full UUID preserved
  "Group": "FLOWER",
  "StandardPrice": "45.00",
  "SellPrice": "45.00",
  "Discount": "",
  "Content": "1",
  "Unit": "G"
}
```

## Future Sync Strategy

### For Price Updates:
1. **Find by Barcode** - Use Opticon's ProductId (barcode) to locate the product
2. **Verify with UUID** - Extract UUID from Description field `[...]` to confirm it's the right product
3. **Update Price** - Send updated StandardPrice/SellPrice

### Sync Workflow:
```javascript
// 1. Get updated product from Treez by UUID
const treezProduct = await fetchTreezProductById(treezUUID);

// 2. Find in Opticon by barcode
const opticonProduct = await findOpticonProductByBarcode(barcode);

// 3. Verify UUID match from description
const uuidMatch = opticonProduct.Description.match(/\[(.*?)\]/);
if (uuidMatch[1] === treezUUID) {
  // 4. Update price
  await updateOpticonProduct(barcode, { SellPrice: newPrice });
}
```

## Benefits

✅ **Works within Opticon's MaxLength limit**  
✅ **Preserves full Treez UUID for sync**  
✅ **Uses barcode as primary identifier** (human-readable, shorter)  
✅ **Enables future price updates**  
✅ **Easy to parse UUID from description when needed**

## Notes

- Console logs show: `[Upload] Product {barcode}: Using ProductId="{barcode}", Full ID in Description="{uuid}"`
- If product has no barcode, uses first 20 chars of UUID as fallback
- UUID regex to extract: `/\[(.*?)\]/` from Description field
