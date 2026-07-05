import { checkExportStorageHealth } from "@/lib/supabase/storageHealth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST() {
  const result = await checkExportStorageHealth()

  return Response.json(result, {
    status: result.ok ? 200 : 409,
  })
}
