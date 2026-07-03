import { parseKitMarkdown } from "@/lib/parser"
import { validateKit } from "@/lib/parser/validation"
import { getSavedKit } from "@/lib/supabase/kitFactoryData"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  context: { params: Promise<{ kitId: string }> }
) {
  const { kitId } = await context.params
  const savedKit = await getSavedKit(kitId)

  if (!savedKit) {
    return Response.json({ error: "Saved kit not found." }, { status: 404 })
  }

  const kit = parseKitMarkdown(savedKit.sourceMarkdown, {
    branch: savedKit.branch || undefined,
    designPreset: savedKit.designPreset || undefined,
    outputMode:
      savedKit.outputMode === "all-in-one"
        ? "all-in-one"
        : savedKit.outputMode === "split"
          ? "split"
          : undefined,
  })
  const issues = validateKit(kit)

  return Response.json({
    branch: kit.branch,
    designPreset: kit.designPreset,
    issues,
    kit,
    kitId: savedKit.id,
    markdown: savedKit.sourceMarkdown,
    outputMode: kit.outputMode || "split",
    status: savedKit.status,
  })
}
