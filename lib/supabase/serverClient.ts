import { createClient, type SupabaseClient } from "@supabase/supabase-js"

let cachedClient: SupabaseClient | null = null

function supabaseUrl() {
  return process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ""
}

function supabaseAnonKey() {
  return process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ""
}

function supabaseServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || ""
}

function supabaseServerKey() {
  return supabaseServiceRoleKey() || supabaseAnonKey()
}

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl() && supabaseServerKey())
}

export function isSupabaseServiceRoleConfigured() {
  return Boolean(supabaseUrl() && supabaseServiceRoleKey())
}

export function getSupabaseServerClient() {
  if (!isSupabaseConfigured()) {
    return null
  }

  if (!cachedClient) {
    cachedClient = createClient(
      supabaseUrl(),
      supabaseServerKey(),
      {
        auth: {
          persistSession: false,
        },
      }
    )
  }

  return cachedClient
}
