# Opticon Sync Feature - Complete! ✅

## What's New:

### ✅ Sync to Opticon ESL

Changes detected from Treez can now be pushed to Opticon ESL displays!

---

## How It Works:

```
Treez Price Change
    ↓
Background Monitor Detects (1 min)
    ↓
Saves to Supabase (synced_to_opticon = false)
    ↓
Shows in Monitor Page with "⏳ Pending on Opticon" badge
    ↓
User clicks "Sync to Opticon" button
    ↓
Pushes to Opticon API
    ↓
Marks as synced (synced_to_opticon = true)
    ↓
Badge changes to "✓ Synced to Opticon"
```

---

## Files Created:

### **`app/api/products/sync-to-opticon/route.ts`** (NEW)

API endpoint to sync a change to Opticon ESL.

**What it does:**
1. Gets change details from Supabase
2. Gets current product state (snapshot)
3. Builds Opticon product payload
4. **Uses `opticon_barcode` as ProductId** (Treez UUID)
5. Pushes to Opticon API
6. Marks change as synced in database

**Important Mapping:**
- `ProductId` in Opticon = `opticon_barcode` (Treez Product UUID)
- `Barcode` in Opticon = Physical barcode from product
- This allows Opticon to identify products by Treez ID

---

## Monitor Page Updates:

### **New Features:**

1. **"Sync to Opticon" Button**
   - Appears on changes with "⏳ Pending on Opticon" badge
   - Click to push change to ESL
   - Shows loading state while syncing

2. **Sync Status Badges:**
   - 🔄 **"Syncing..."** - Currently pushing to Opticon
   - ✓ **"Just Synced!"** - Just completed (2 seconds)
   - ✓ **"Synced to Opticon"** - Already synced (permanent)
   - ⏳ **"Pending on Opticon"** - Not synced yet
   - ✗ **"Sync Failed"** - Error occurred

3. **Sync Timestamp:**
   - Shows when change was synced to Opticon
   - Format: "Synced to Opticon: 4/10/2026, 6:35 PM"

---

## Testing Guide:

### **Step 1: Delete Old Change Records**

```sql
-- In Supabase SQL Editor
DELETE FROM product_changes;
```

This clears old changes so you can test fresh.

### **Step 2: Change Price in Treez**

1. Go to Treez dashboard
2. Edit a product (e.g., AK-47 AIO 1G)
3. Change price: `$25 → $30`
4. Save

### **Step 3: Wait for Detection**

- **Automatic:** Wait 1 minute for background monitor
- **Manual:** Click "Check for Changes" button

### **Step 4: Check Monitor Page**

Should show:
```
💰 AK-47 AIO 1G [price]
✓ Synced to Supabase
⏳ Pending on Opticon
$25 → $30
Detected: 4/10/2026, 6:30 PM

[Sync to Opticon] ← Button
```

### **Step 5: Sync to Opticon**

1. Click **"Sync to Opticon"** button
2. Watch badge change to "🔄 Syncing..."
3. Wait 2-3 seconds
4. Badge changes to "✓ Just Synced!"
5. After 2 seconds → "✓ Synced to Opticon"
6. Button disappears

### **Step 6: Verify in Opticon**

1. Open Opticon EBS50 interface
2. Go to Products list
3. Find product by ProductId (Treez UUID)
4. Check if price updated to $30 ✅

---

## Console Logs:

### **When Syncing:**

```
[Opticon Sync] Starting sync for change: abc123...
[Opticon Sync] Change details: {
  type: 'price',
  product: '1060459d-bec9-48cf...',
  oldValue: '25',
  newValue: '30'
}
[Opticon Sync] Product: AK-47 AIO 1G
[Opticon Sync] Current state: {
  price: 30,
  barcode: '4c78d846...',
  opticonBarcode: '1060459d-bec9-48cf...'
}
[Opticon Sync] Pushing to Opticon: {
  NotUsed: '',
  ProductId: '1060459d-bec9-48cf...',
  Barcode: '4c78d846...',
  Description: 'AK-47 AIO 1G',
  Group: 'CARTRIDGE',
  StandardPrice: '30',
  SellPrice: '30',
  Discount: '',
  Content: '1',
  Unit: 'G'
}
[Opticon] Pushing product to EBS50: { ... }
[Opticon] Trying v1.0: POST https://ebs50.local/api/Products
[Opticon] v1.0 Response: 200 OK
[Opticon] Success response: OK
[Opticon] ✓ Product pushed successfully
[Opticon Sync] ✓ Successfully pushed to Opticon
[Opticon Sync] ✓ Marked as synced in database
[Opticon Sync] ✅ Complete!
```

---

## Important Notes:

### **ProductId Mapping:**

```
Treez Product UUID: 1060459d-bec9-48cf-a779-9f7ae5761337
         ↓
Stored as opticon_barcode in Supabase
         ↓
Used as ProductId in Opticon
         ↓
Opticon ESL identifies product by this UUID
```

**Why this mapping?**
- Treez uses long UUIDs for products
- Opticon needs a ProductId to identify ESL tags
- We use Treez UUID as the ProductId
- Physical barcode stored separately in Barcode field

### **Manual vs Automatic:**

**Current:** Manual sync (click button)
- ✅ Control when to update ESL
- ✅ Review changes before pushing
- ✅ Avoid accidental updates

**Future:** Automatic sync (optional)
- Auto-push changes to Opticon
- No button needed
- Enable/disable per product or globally

---

## Error Handling:

### **Common Errors:**

1. **"Product not found"**
   - Change exists but product deleted from Supabase
   - Solution: Re-sync products from Treez

2. **"Failed to sync to Opticon"**
   - Opticon API error (network, auth, etc.)
   - Check EBS50 is online and accessible
   - Check API key in .env.local

3. **"Supabase not configured"**
   - Missing NEXT_PUBLIC_SUPABASE_URL or ANON_KEY
   - Add to .env.local

### **Debugging:**

Check console logs for:
- `[Opticon Sync]` - Sync process
- `[Opticon]` - API calls to EBS50
- Error messages with details

---

## Stats Update:

Monitor page stats now show:
- **Total Changes**: All detected changes
- **Synced to Supabase**: 100% (automatic)
- **Pending on Opticon**: Changes not yet synced
- **Synced to Opticon**: Count decreases as you sync

---

## Next Steps (Optional):

### **Automatic Sync:**

Add toggle to enable auto-sync:

```typescript
if (autoSyncEnabled) {
  // Auto-sync new changes to Opticon
  // No button click needed
}
```

### **Bulk Sync:**

Add "Sync All to Opticon" button:
- Syncs all pending changes at once
- Useful for initial setup or bulk updates

### **Scheduled Sync:**

Background job to auto-sync:
- Every X minutes, check for pending changes
- Auto-push to Opticon
- Fully automated

---

## Complete System Flow:

```
1. Treez (Source)
   Product price: $25 → $30
   ↓
2. Background Monitor (Every 1 min)
   Detects change
   ↓
3. Supabase (Database)
   Logs: price change $25 → $30
   Status: synced_to_opticon = false
   ↓
4. Monitor UI (Real-time)
   Shows: "⏳ Pending on Opticon"
   Button: "Sync to Opticon"
   ↓
5. User Action
   Clicks "Sync to Opticon"
   ↓
6. API Call
   POST /api/products/sync-to-opticon
   ↓
7. Opticon EBS50 (Local)
   Updates product price to $30
   ↓
8. Supabase Update
   Marks: synced_to_opticon = true
   Saves: synced_at timestamp
   ↓
9. Monitor UI (Real-time)
   Shows: "✓ Synced to Opticon"
   Button: Disappears
   ↓
10. ESL Display (Store)
    Shows new price: $30
```

---

**System is now complete!** 🎉

Test karo:
1. Delete old changes from Supabase
2. Change price in Treez
3. Wait for detection
4. Click "Sync to Opticon"
5. Check Opticon products list
6. Price updated! ✅
