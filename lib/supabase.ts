import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables. Some features may not work.');
}

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false, // Disable session persistence for server-side
      },
    })
  : null as any;

// Types for our tables
export interface ProductSnapshot {
  id?: string;
  treez_product_id: string;
  opticon_barcode: string;
  product_name: string | null;
  price: number | null;
  barcode: string | null;
  category: string | null;
  size: string | null;
  unit: string | null;
  raw_data: any;
  last_checked_at?: string;
  last_updated_at?: string;
  created_at?: string;
}

export interface ProductChange {
  id?: string;
  treez_product_id: string;
  change_type: 'price' | 'name' | 'barcode' | 'category' | 'size' | 'other';
  old_value: string | null;
  new_value: string | null;
  detected_at?: string;
  synced_to_opticon?: boolean;
  synced_at?: string | null;
}
