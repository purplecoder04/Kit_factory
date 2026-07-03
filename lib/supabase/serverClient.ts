import { createClient, type SupabaseClient } from "@supabase/supabase-js"

let cachedClient: SupabaseClient | null = null

export function isSupabaseConfigured() {
  return Boolean(process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY)
}

export function getSupabaseServerClient() {
  if (!isSupabaseConfigured()) {
    return null
  }

  if (!cachedClient) {
    cachedClient = createClient(
      process.env.VITE_SUPABASE_URL ?? "",
      process.env.VITE_SUPABASE_ANON_KEY ?? "",
      {
        auth: {
          persistSession: false,
        },
      }
    )
  }

  return cachedClient
}
