import { parseKitMarkdown } from "@/lib/parser"
import { hasBlockingErrors, validateKit } from "@/lib/parser/validation"
import { renderKitPdf, type RenderTarget } from "@/lib/renderer"
import {
  failExportJob,
  finishExportJob,
  startExportJob,
} from "@/lib/supabase/kitFactoryData"

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

  const kitId = typeof body.kitId === "string" ? body.kitId : null
  const jobId = await startExportJob({ exportKind: "pdf", kitId, target })

  let pdf: Awaited<ReturnType<typeof renderKitPdf>>

  try {
    pdf = await renderKitPdf(kit, target)
  } catch (error) {
    await failExportJob({
      errorMessage: error instanceof Error ? error.message : "PDF export failed.",
      jobId,
    })
    throw error
  }

  const stem = `${kit.slug}-${kit.designPreset || kit.branch || "brand"}`
  const filename =
    target === "complete"
      ? `${stem}-complete.pdf`
      : target === "workbook"
        ? `${stem}-workbook.pdf`
        : `${stem}-lesson-guide.pdf`

  await finishExportJob({
    byteSize: pdf.byteLength,
    contentType: "application/pdf",
    exportKind: "pdf",
    filename,
    jobId,
    kitId,
    target,
  })

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
