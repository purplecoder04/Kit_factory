import { createClient, type SupabaseClient } from "@supabase/supabase-js"

let cachedClient: SupabaseClient | null = null

function supabaseUrl() {
  return process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ""
}

function supabaseAnonKey() {
  return process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ""
}

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl() && supabaseAnonKey())
}

export function getSupabaseServerClient() {
  if (!isSupabaseConfigured()) {
    return null
  }

  if (!cachedClient) {
    cachedClient = createClient(
      supabaseUrl(),
      supabaseAnonKey(),
      {
        auth: {
          persistSession: false,
        },
      }
    )
  }

  return cachedClient
}
