import { parseKitMarkdown } from "@/lib/parser"
import { validateKit } from "@/lib/parser/validation"
import { syncParsedKitToSupabase } from "@/lib/supabase/kitFactoryData"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const body = await request.json()
  const markdown = typeof body.markdown === "string" ? body.markdown : ""
  const kit = parseKitMarkdown(markdown, {
    branch: body.branch,
    designPreset: body.designPreset,
    outputMode: body.outputMode,
  })
  const issues = validateKit(kit)
  const shouldPersist = body.persist !== false
  const syncedKit = shouldPersist
    ? await syncParsedKitToSupabase({
        existingKitId: typeof body.kitId === "string" ? body.kitId : null,
        kit,
        sourceMarkdown: markdown,
      })
    : {
        kitId: typeof body.kitId === "string" ? body.kitId : null,
        documentId: null,
      }

  return Response.json({
    kit,
    issues,
    kitId: syncedKit.kitId,
  })
}
