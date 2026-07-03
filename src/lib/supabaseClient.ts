import { createClient } from "@supabase/supabase-js"

type ViteEnv = {
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_ANON_KEY?: string
}

const env = ((import.meta as ImportMeta & { env?: ViteEnv }).env ?? process.env) as ViteEnv

const supabaseUrl = env.VITE_SUPABASE_URL ?? ""
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY ?? ""

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default supabase
