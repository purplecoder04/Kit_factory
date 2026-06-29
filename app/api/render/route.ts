import { parseKitMarkdown } from "@/lib/parser"
import { hasBlockingErrors, validateKit } from "@/lib/parser/validation"
import { renderKitPdf, type RenderTarget } from "@/lib/renderer"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const body = await request.json()
  const markdown = typeof body.markdown === "string" ? body.markdown : ""
  const target = normaliseTarget(body.target)
  const kit = parseKitMarkdown(markdown, {
    branch: body.branch,
    outputMode: body.outputMode,
  })
  const issues = validateKit(kit)

  if (hasBlockingErrors(issues)) {
    return Response.json({ issues }, { status: 400 })
  }

  const pdf = await renderKitPdf(kit, target)
  const filename =
    target === "complete"
      ? `${kit.slug}-complete.pdf`
      : target === "workbook"
        ? `${kit.slug}-workbook.pdf`
        : `${kit.slug}-lesson-guide.pdf`

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}

function normaliseTarget(value: unknown): RenderTarget {
  if (value === "complete" || value === "workbook") {
    return value
  }

  return "guide"
}
