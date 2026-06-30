import { parseKitMarkdown } from "@/lib/parser"
import { validateKit } from "@/lib/parser/validation"

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

  return Response.json({
    kit,
    issues,
  })
}
