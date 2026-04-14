import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const env = import.meta.env;
const url = env.VITE_SUPABASE_URL ?? env.VITE_PUBLIC_SUPABASE_URL;
const anonKey =
  env.VITE_SUPABASE_ANON_KEY ?? env.VITE_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;
