import { createClient } from '@supabase/supabase-js';
import { mockSupabase } from '@/api/demo/mockClient';

const DEMO = import.meta.env.VITE_DEMO_MODE === 'true';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

function realClient() {
  if (!url || !anonKey) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local');
  }
  return createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
}

// In demo mode, everything (adapter + hooks) runs through the in-memory mock.
export const supabase = DEMO ? mockSupabase : realClient();
export const IS_DEMO = DEMO;
