# Supabase Setup for Product Change Detection

## Step 1: Create Supabase Project

1. Go to https://supabase.com
2. Sign up / Log in
3. Click "New Project"
4. Choose organization and set:
   - **Project Name**: perfect-union-esl
   - **Database Password**: (generate strong password)
   - **Region**: Choose closest to you
5. Wait for project to be created (~2 minutes)

## Step 2: Get API Credentials

1. In Supabase Dashboard, go to **Settings** → **API**
2. Copy these values:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon/public key**: `eyJhbGc...` (long string)

## Step 3: Add to .env.local

Add these lines to your `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## Step 4: Run SQL Schema

1. In Supabase Dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy and paste the SQL below
4. Click **Run** (or press Ctrl+Enter)

```sql
-- Table 1: Product Snapshots (Current State)
CREATE TABLE product_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  treez_product_id TEXT NOT NULL UNIQUE,
  opticon_barcode TEXT NOT NULL,
  product_name TEXT,
  price DECIMAL(10,2),
  barcode TEXT,
  category TEXT,
  size TEXT,
  unit TEXT,
  raw_data JSONB,
  last_checked_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX idx_treez_product_id ON product_snapshots(treez_product_id);
CREATE INDEX idx_last_checked ON product_snapshots(last_checked_at);
CREATE INDEX idx_price ON product_snapshots(price);

-- Table 2: Product Changes (History of Detected Changes)
CREATE TABLE product_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  treez_product_id TEXT NOT NULL,
  change_type TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  synced_to_opticon BOOLEAN DEFAULT FALSE,
  synced_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_treez_changes ON product_changes(treez_product_id);
CREATE INDEX idx_detected_at ON product_changes(detected_at DESC);
CREATE INDEX idx_synced ON product_changes(synced_to_opticon);
CREATE INDEX idx_change_type ON product_changes(change_type);

-- Add foreign key constraint
ALTER TABLE product_changes
  ADD CONSTRAINT fk_treez_product
  FOREIGN KEY (treez_product_id)
  REFERENCES product_snapshots(treez_product_id)
  ON DELETE CASCADE;

-- Enable Row Level Security (RLS) - Optional for now
-- ALTER TABLE product_snapshots ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE product_changes ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (adjust based on your security needs)
-- For now, allow all operations (you can restrict later)
-- CREATE POLICY "Allow all operations" ON product_snapshots FOR ALL USING (true);
-- CREATE POLICY "Allow all operations" ON product_changes FOR ALL USING (true);
```

## Step 5: Verify Tables Created

1. In Supabase Dashboard, go to **Table Editor**
2. You should see two tables:
   - ✅ `product_snapshots`
   - ✅ `product_changes`

## Step 6: Test Connection

After adding credentials to `.env.local`, restart your Next.js dev server:

```bash
npm run dev
```

Navigate to: `http://localhost:3000/admin/treez/monitor`

## Troubleshooting

### Error: "Missing Supabase environment variables"
- Check `.env.local` has both variables
- Restart dev server after adding variables

### Error: "relation does not exist"
- SQL schema not run yet
- Go to SQL Editor and run the schema above

### Error: "Invalid API key"
- Double-check you copied the **anon/public** key, not the service_role key
- Make sure there are no extra spaces in `.env.local`

## Next Steps

Once setup is complete:
1. Visit `/admin/treez/monitor` page
2. Click "Sync Products from Treez" to upload initial snapshot
3. Click "Check for Changes" to detect updates
4. View change history in real-time

---

**Security Note:** The current setup allows public access to tables for development. For production, implement proper Row Level Security (RLS) policies in Supabase.
