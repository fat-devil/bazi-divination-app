import { createClient } from "@supabase/supabase-js";

function normalizeSupabaseUrl(value: string | undefined) {
  if (!value) {
    return "";
  }

  return value.trim().replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
}

const supabaseUrl = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;
