import { listSavedKits } from "@/lib/supabase/kitFactoryData"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const kits = await listSavedKits()

  return Response.json({ kits })
}
