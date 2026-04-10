# External Mapping Strategy for Treez-Opticon Sync

## Problem Solved
- ALL Opticon fields have MaxLength limits (even NotUsed, Discount)
- Cannot store long UUIDs (36 chars) or long SKUs in Opticon
- Need to preserve Treez UUID and SKU for future sync

## Solution: External Mapping File

Store the Treez ↔ Opticon mapping in **our application** instead of in Opticon fields!

### Mapping Storage
File: `treez-opticon-mapping.json`

```json
{
  "mappings": [
    {
      "opticonProductId": "1",
      "treezProductId": "1060459d-bec9-48cf-a779-9f7ae5761337",
      "treezSku": "4c78d846",
      "barcode": "4c78d8465085"
    },
    {
      "opticonProductId": "2",
      "treezProductId": "4df8b3f6-ea86-4b3f-9e0c-066f828f6d9a",
      "treezSku": "DO-SI-LATO-1G",
      "barcode": "3083680012256"
    }
  ]
}
```

### Opticon Products (Clean - No Long Strings!)

```json
{
  "NotUsed": "",
  "ProductId": "1",           // Simple sequential number
  "Barcode": "4c78d8465085",  // Product barcode
  "Description": "LEMON JACK 7G",  // Clean product name
  "Group": "FLOWER",
  "StandardPrice": "35.00",
  "SellPrice": "35.00",
  "Discount": "",
  "Content": "7",
  "Unit": "G"
}
```

## How It Works

### On Upload:
1. Upload product to Opticon with simple ProductId (1, 2, 3...)
2. **Automatically save mapping** to `treez-opticon-mapping.json` via API
3. Mapping links: Opticon ProductId ↔ Treez UUID + SKU + Barcode

### On Sync (Future Price Updates):
```javascript
// 1. Read mapping file
const mappings = await fetch('/api/sync/mapping').then(r => r.json());

// 2. For each mapping, get updated Treez product
for (const mapping of mappings.mappings) {
  const treezProduct = await fetchTreezProductById(mapping.treezProductId);
  const opticonProduct = await findOpticonProduct(mapping.opticonProductId);
  
  // 3. Compare and update price
  if (treezProduct.price !== parseFloat(opticonProduct.SellPrice)) {
    await updateOpticonPrice(mapping.opticonProductId, treezProduct.price);
    console.log(`Updated ${mapping.treezSku}: ${treezProduct.price}`);
  }
}
```

## Benefits

✅ **No MaxLength issues** - Nothing long stored in Opticon  
✅ **Clean Opticon data** - Only essential product info  
✅ **Full Treez data preserved** - UUID, SKU, Barcode all saved  
✅ **Easy lookup** - Can search by any field  
✅ **Automatic mapping** - Saved on upload, no manual work  
✅ **Future-proof** - Can add more fields to mapping anytime  

## API Endpoints

### GET /api/sync/mapping
Returns all mappings

### POST /api/sync/mapping
Save/update a mapping:
```json
{
  "opticonProductId": "1",
  "treezProductId": "uuid",
  "treezSku": "sku",
  "barcode": "barcode"
}
```

## Mapping File Structure

The mapping file is automatically maintained:
- **On upload**: New entry added or existing updated
- **On sync**: Read to find Treez IDs for price updates
- **Manual edit**: Can edit JSON file directly if needed

## Example Queries

### Find Treez UUID by Opticon ID:
```javascript
const mapping = mappings.find(m => m.opticonProductId === "1");
const treezUUID = mapping.treezProductId;
```

### Find Opticon ID by Treez UUID:
```javascript
const mapping = mappings.find(m => m.treezProductId === "1060459d-...");
const opticonId = mapping.opticonProductId;
```

### Find by Barcode:
```javascript
const mapping = mappings.find(m => m.barcode === "4c78d8465085");
```

## Console Logs

```
[Upload] Product #1: Name="LEMON JACK 7G", Treez UUID="1060459d-...", SKU="4c78d846", Barcode="..."
[Mapping] Saved: Opticon #1 → Treez 1060459d-bec9-48cf-a779-9f7ae5761337
```
