import { listKitExportFiles } from "@/lib/supabase/kitFactoryData"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  context: { params: Promise<{ kitId: string }> }
) {
  const { kitId } = await context.params

  if (!kitId) {
    return Response.json({ exports: [] })
  }

  const exports = await listKitExportFiles(kitId)

  return Response.json({ exports })
}
