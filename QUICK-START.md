# 🚀 Quick Start Checklist

Follow these steps in order to get the Change Detection system working:

## ✅ Step 1: Install Dependencies (DONE)

```bash
npm install
```

**Status:** ✓ Complete (Supabase package installed)

---

## ⚠️ Step 2: Setup Supabase (ACTION REQUIRED)

### 2.1 Create Supabase Project

1. Go to https://supabase.com
2. Sign up or log in
3. Click **"New Project"**
4. Fill in:
   - **Name**: `perfect-union-esl`
   - **Database Password**: Generate strong password
   - **Region**: Choose closest to you
5. Click **"Create Project"** (wait ~2 minutes)

### 2.2 Get API Credentials

1. In Supabase dashboard, go to **Settings** → **API**
2. Copy these values:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGc...` (long string)

### 2.3 Update .env.local

Open `.env.local` and replace these lines:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

With your actual values from Step 2.2

### 2.4 Run SQL Schema

1. In Supabase dashboard, go to **SQL Editor**
2. Click **"New Query"**
3. Open `SUPABASE-SETUP.md` file
4. Copy the entire SQL schema (starts with `CREATE TABLE product_snapshots`)
5. Paste in SQL Editor
6. Click **"Run"** or press Ctrl+Enter

### 2.5 Verify Tables

1. Go to **Table Editor** in Supabase
2. Confirm you see:
   - ✅ `product_snapshots`
   - ✅ `product_changes`

---

## 🔄 Step 3: Restart Dev Server

After adding Supabase credentials to `.env.local`:

```bash
# Stop current server (Ctrl+C)
npm run dev
```

---

## 🎯 Step 4: Test the System

### 4.1 Navigate to Monitor Page

Open: http://localhost:3000/admin/treez/monitor

### 4.2 Initial Sync

1. Click **"Sync Products from Treez"** button
2. Wait for completion (~10-15 seconds)
3. Alert should show: "✓ Synced 11 products"
4. Page refreshes showing all products

### 4.3 Check for Changes

1. Click **"Check for Changes"** button
2. Wait for completion (~10 seconds)
3. Alert shows: "✓ No changes detected" (or number of changes if any)

### 4.4 Enable Auto-refresh (Optional)

1. Toggle **"Auto-refresh"** checkbox
2. Select interval: **5 min** (recommended)
3. System will check automatically every 5 minutes

---

## 🧪 Step 5: Test Change Detection

### Manual Test:

1. Go to Treez dashboard
2. Change a product price (e.g., increase by $1)
3. Return to Monitor page
4. Click **"Check for Changes"**
5. You should see:
   - Alert: "🔔 Found 1 change(s) in 1 product(s)!"
   - Change appears in "Recent Changes" section
   - Old price → New price displayed

---

## 📊 What You Should See

### Monitor Page Sections:

1. **Header**
   - "Sync Products from Treez" button
   - "Check for Changes" button
   - Last checked timestamp

2. **Auto-refresh Controls**
   - Checkbox to enable/disable
   - Dropdown for interval (1/5/10/30 min)

3. **Stats Cards**
   - Total Products: 11
   - Recent Changes: (number)
   - Unsynced Changes: (number)
   - Synced to Opticon: 0 (for now)

4. **Recent Changes List**
   - Change type icons (💰 price, 📝 name, etc.)
   - Product name
   - Old value → New value
   - Timestamp
   - "Not Synced" badge

5. **Monitored Products Table**
   - Product Name
   - Price
   - Category
   - Size
   - Opticon Barcode (= Treez ProductId)
   - Last Checked timestamp

---

## 🐛 Troubleshooting

### Error: "Missing Supabase environment variables"

❌ **Problem:** `.env.local` not updated or dev server not restarted

✅ **Solution:**
1. Check `.env.local` has both Supabase variables
2. Restart: `npm run dev`

### Error: "No products in database"

❌ **Problem:** Haven't run initial sync yet

✅ **Solution:**
1. Click "Sync Products from Treez" button
2. Wait for sync to complete

### Error: "relation does not exist"

❌ **Problem:** SQL schema not run in Supabase

✅ **Solution:**
1. Go to Supabase SQL Editor
2. Run the schema from `SUPABASE-SETUP.md`

### Changes not appearing

❌ **Problem:** Real-time subscription not working

✅ **Solution:**
1. Check browser console for errors
2. Verify Supabase project is active (not paused)
3. Refresh the page

---

## 📝 Current Status

### ✅ Implemented (Ready to Use)

- ✅ Supabase integration
- ✅ Product sync from Treez
- ✅ Change detection logic
- ✅ Real-time UI updates
- ✅ Change history tracking
- ✅ Auto-refresh with intervals
- ✅ Monitor page UI
- ✅ Navigation link in sidebar

### ❌ Not Implemented Yet (Future)

- ❌ Sync changes to Opticon ESL
- ❌ Webhook from Treez (if supported)
- ❌ Email/SMS notifications
- ❌ Change approval workflow

---

## 🎉 Success Criteria

You'll know it's working when:

1. ✅ Monitor page loads without errors
2. ✅ "Sync Products" successfully adds 11 products
3. ✅ Products table shows all 11 products with correct data
4. ✅ "Check for Changes" completes without errors
5. ✅ Manually changing a price in Treez shows up in "Recent Changes"
6. ✅ Real-time updates work (changes appear without refresh)

---

## 📖 Next Steps After Setup

1. **Leave auto-refresh running** (5-10 min interval)
2. **Monitor for a few hours** to see if changes are detected
3. **Review change history** to verify accuracy
4. **Plan Opticon sync feature** (next phase)

---

## 📚 Documentation

- **Full Guide**: `CHANGE-DETECTION-README.md`
- **Supabase Setup**: `SUPABASE-SETUP.md`
- **Product IDs**: `product-ids.json`

---

**Need help?** Check the browser console and server terminal for detailed logs!
