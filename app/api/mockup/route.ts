import { renderKitMockupPng } from "@/lib/mockup"
import { parseKitMarkdown } from "@/lib/parser"
import { hasBlockingErrors, validateKit } from "@/lib/parser/validation"

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

  if (hasBlockingErrors(issues)) {
    return Response.json({ issues }, { status: 400 })
  }

  const mockup = await renderKitMockupPng(kit)
  const filename = `${kit.slug}-${kit.designPreset || kit.branch || "brand"}-website-mockup.png`

  return new Response(mockup, {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
