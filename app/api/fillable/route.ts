import {
  exportFailedResponse,
  isHostedExportRuntime,
  localExportUnavailableResponse,
} from "@/lib/exportRuntime"
import { addFillableFields } from "@/lib/fillable"
import { parseKitMarkdown } from "@/lib/parser"
import { hasBlockingErrors, validateKit } from "@/lib/parser/validation"
import { renderKitPdfWithFillableFields, type RenderTarget } from "@/lib/renderer"
import {
  failExportJob,
  finishExportJob,
  startExportJob,
} from "@/lib/supabase/kitFactoryData"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  if (isHostedExportRuntime()) {
    return localExportUnavailableResponse("Fillable PDF")
  }

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
  const jobId = await startExportJob({ exportKind: "fillable", kitId, target })
  let fillablePdf: Awaited<ReturnType<typeof addFillableFields>>

  try {
    const { pdf: basePdf, fields } = await renderKitPdfWithFillableFields(kit, target)
    fillablePdf = await addFillableFields(basePdf, kit, target, fields)
  } catch (error) {
    await failExportJob({
      errorMessage: error instanceof Error ? error.message : "Fillable export failed.",
      jobId,
    })
    return exportFailedResponse(error, "Fillable export failed.")
  }

  const stem = `${kit.slug}-${kit.designPreset || kit.branch || "brand"}`
  const filename =
    target === "complete" ? `${stem}-fillable.pdf` : `${stem}-workbook-fillable.pdf`

  await finishExportJob({
    contentType: "application/pdf",
    exportKind: "fillable",
    fileData: fillablePdf,
    filename,
    jobId,
    kitId,
    target,
  })

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
