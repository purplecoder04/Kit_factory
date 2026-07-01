import { addFillableFields } from "@/lib/fillable"
import { parseKitMarkdown } from "@/lib/parser"
import { hasBlockingErrors, validateKit } from "@/lib/parser/validation"
import { renderKitPdfWithFillableFields, type RenderTarget } from "@/lib/renderer"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const body = await request.json()
  const markdown = typeof body.markdown === "string" ? body.markdown : ""
  const target = normaliseTarget(body.target)
  const kit = parseKitMarkdown(markdown, {
    branch: body.branch,
    designPreset: body.designPreset,
    outputMode: body.outputMode,
  })
  const issues = validateKit(kit)

  if (hasBlockingErrors(issues)) {
    return Response.json({ issues }, { status: 400 })
  }

  const { pdf: basePdf, fields } = await renderKitPdfWithFillableFields(kit, target)
  const fillablePdf = await addFillableFields(basePdf, kit, target, fields)
  const stem = `${kit.slug}-${kit.designPreset || kit.branch || "brand"}`
  const filename =
    target === "complete" ? `${stem}-fillable.pdf` : `${stem}-workbook-fillable.pdf`

  return new Response(fillablePdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}

function normaliseTarget(value: unknown): RenderTarget {
  return value === "complete" ? "complete" : "workbook"
}
