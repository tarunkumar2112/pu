# Real-Time Product Change Detection System

This system monitors products from Treez and detects changes in real-time, storing them in Supabase for tracking and future sync to Opticon ESL.

## 🚀 Quick Setup

### 1. Install Dependencies

```bash
npm install
```

The `@supabase/supabase-js` package should be automatically installed.

### 2. Setup Supabase

Follow the detailed instructions in **[SUPABASE-SETUP.md](./SUPABASE-SETUP.md)**

Quick steps:
1. Create free Supabase project at https://supabase.com
2. Run the SQL schema (copy from SUPABASE-SETUP.md)
3. Get your credentials (URL + Anon Key)
4. Add to `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Restart Dev Server

```bash
npm run dev
```

### 4. Access the Monitor Page

Navigate to: **http://localhost:3000/admin/treez/monitor**

---

## 📊 How It Works

### Architecture

```
┌─────────────┐
│ Treez API   │
│ (Source)    │
└──────┬──────┘
       │
       │ Fetch products
       ↓
┌─────────────┐
│ Next.js API │
│ /api/products/sync-snapshot
│ /api/products/check-changes
└──────┬──────┘
       │
       │ Store/Compare
       ↓
┌─────────────┐
│ Supabase DB │
│ - product_snapshots
│ - product_changes
└──────┬──────┘
       │
       │ Real-time updates
       ↓
┌─────────────┐
│ Monitor UI  │
│ /admin/treez/monitor
└─────────────┘
```

### Data Flow

1. **Initial Sync**: Products from `product-ids.json` → Supabase
2. **Change Detection**: Compare Treez current data vs. Supabase snapshot
3. **Store Changes**: Log all detected changes with timestamp
4. **Real-time UI**: Monitor page updates automatically via Supabase realtime
5. **Future**: Sync changes to Opticon ESL (not implemented yet)

---

## 🔧 Features

### Current (✅ Implemented)

- ✅ Initial product sync from Treez to Supabase
- ✅ Automatic change detection (price, name, barcode, category, size)
- ✅ Real-time UI updates using Supabase subscriptions
- ✅ Change history tracking
- ✅ Manual "Check for Changes" button
- ✅ Auto-refresh with configurable intervals (1/5/10/30 min)
- ✅ Product list with last checked timestamps
- ✅ Change statistics dashboard
- ✅ Treez ProductId mapped as Opticon Barcode

### Future (⏳ Planned)

- ⏳ Automatic sync to Opticon when changes detected
- ⏳ Webhook support from Treez (if available)
- ⏳ Email/SMS notifications for critical changes
- ⏳ Change approval workflow
- ⏳ Bulk sync to Opticon ESL

---

## 📖 Usage Guide

### Step 1: Initial Product Sync

1. Go to **Monitor** page (`/admin/treez/monitor`)
2. Click **"Sync Products from Treez"**
3. Wait for all products to be fetched and stored
4. Result: All 11 products from `product-ids.json` now in Supabase

### Step 2: Check for Changes

**Manual Check:**
- Click **"Check for Changes"** button
- System fetches latest data from Treez
- Compares with stored snapshots
- Shows alert with number of changes detected

**Auto-refresh:**
- Toggle "Auto-refresh" checkbox
- Select interval (1/5/10/30 minutes)
- System automatically checks in background

### Step 3: View Changes

**Recent Changes Section:**
- Shows last 50 detected changes
- Color-coded by change type:
  - 💰 **Price** (yellow)
  - 📝 **Name** (blue)
  - 🔖 **Barcode** (gray)
  - 📁 **Category** (gray)
  - 📏 **Size** (gray)
- "Not Synced" badge for changes not yet pushed to Opticon

**Products List:**
- All monitored products
- Current price, category, size
- Opticon barcode (= Treez ProductId)
- Last checked timestamp

### Step 4: Real-time Updates

- Changes detected by OTHER users/tabs appear automatically
- No page refresh needed
- Powered by Supabase real-time subscriptions

---

## 🗃️ Database Schema

### Table: `product_snapshots`

Stores current state of each product.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `treez_product_id` | TEXT | Treez product UUID (unique) |
| `opticon_barcode` | TEXT | Same as treez_product_id (for Opticon) |
| `product_name` | TEXT | Product name |
| `price` | DECIMAL | Current price |
| `barcode` | TEXT | Physical barcode |
| `category` | TEXT | Product category |
| `size` | TEXT | Size/weight |
| `unit` | TEXT | Unit (EA, G, etc.) |
| `raw_data` | JSONB | Full Treez product object |
| `last_checked_at` | TIMESTAMPTZ | Last time we checked Treez |
| `last_updated_at` | TIMESTAMPTZ | Last time Treez updated (from API) |
| `created_at` | TIMESTAMPTZ | When first added to database |

### Table: `product_changes`

Logs every detected change.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `treez_product_id` | TEXT | Product that changed |
| `change_type` | TEXT | 'price', 'name', 'barcode', etc. |
| `old_value` | TEXT | Previous value |
| `new_value` | TEXT | New value |
| `detected_at` | TIMESTAMPTZ | When change was detected |
| `synced_to_opticon` | BOOLEAN | Whether pushed to Opticon yet |
| `synced_at` | TIMESTAMPTZ | When synced to Opticon |

---

## 🔍 API Endpoints

### POST `/api/products/sync-snapshot`

Fetch all products from Treez and store in Supabase.

**Request:** None (uses `product-ids.json`)

**Response:**
```json
{
  "success": true,
  "results": {
    "total": 11,
    "synced": 11,
    "failed": 0,
    "errors": []
  }
}
```

### POST `/api/products/check-changes`

Compare current Treez data with Supabase snapshots.

**Request:** None

**Response:**
```json
{
  "success": true,
  "results": {
    "total": 11,
    "checked": 11,
    "changed": 2,
    "unchanged": 9,
    "errors": 0,
    "totalChanges": 3,
    "changedProducts": ["AK-47 AIO 1G", "LEMON JACK 76"]
  }
}
```

---

## 🐛 Troubleshooting

### "Missing Supabase environment variables"

- Check `.env.local` has both variables
- Restart Next.js dev server: `npm run dev`

### "No products in database. Run 'Sync Products from Treez' first"

- Click "Sync Products from Treez" button on Monitor page
- Wait for sync to complete

### Changes not appearing in real-time

- Check browser console for errors
- Verify Supabase credentials
- Check Supabase project is active (not paused)

### "Failed to fetch data"

- Check Supabase project status
- Verify SQL schema was run correctly
- Check table names match exactly

---

## 📝 Notes

### Treez ProductId = Opticon Barcode

The system uses **Treez Product UUID as the Opticon Barcode**. This mapping is stored in:
- Supabase: `product_snapshots.opticon_barcode`
- Same value as `treez_product_id`

This allows easy lookup when syncing to Opticon later.

### Monitoring Specific Products Only

Only products listed in `product-ids.json` are monitored. To add/remove products:

1. Edit `product-ids.json`
2. Click "Sync Products from Treez" to update database

### Performance

- **11 products**: ~10-15 seconds to check all
- **Auto-refresh**: Recommended 5+ minutes to avoid API rate limits
- **Real-time**: Instant UI updates via Supabase subscriptions

---

## 🚀 Next Steps

After change detection is working:

1. **Test Change Detection:**
   - Manually change a price in Treez dashboard
   - Click "Check for Changes"
   - Verify change appears in Monitor page

2. **Setup Auto-refresh:**
   - Enable auto-refresh
   - Set to 5-10 minutes
   - Let it run to catch changes automatically

3. **Future: Sync to Opticon:**
   - Add "Sync to Opticon" button per change
   - Implement API call to Opticon to update product
   - Mark change as `synced_to_opticon = true`

---

## 📚 Related Files

- **Setup Guide**: `SUPABASE-SETUP.md`
- **Product IDs**: `product-ids.json`
- **Supabase Client**: `lib/supabase.ts`
- **Change Detection**: `lib/change-detector.ts`
- **Sync API**: `app/api/products/sync-snapshot/route.ts`
- **Check API**: `app/api/products/check-changes/route.ts`
- **Monitor UI**: `app/admin/treez/monitor/page.tsx`

---

**Questions? Issues?** Check the server console logs - detailed logging is enabled for debugging!
