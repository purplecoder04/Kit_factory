import {
  exportFailedResponse,
  isHostedExportRuntime,
  localExportUnavailableResponse,
} from "@/lib/exportRuntime"
import { renderKitMockupPng } from "@/lib/mockup"
import { parseKitMarkdown } from "@/lib/parser"
import { hasBlockingErrors, validateKit } from "@/lib/parser/validation"
import {
  failExportJob,
  finishExportJob,
  startExportJob,
} from "@/lib/supabase/kitFactoryData"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  if (isHostedExportRuntime()) {
    return localExportUnavailableResponse("Mockup")
  }

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

  const kitId = typeof body.kitId === "string" ? body.kitId : null
  const jobId = await startExportJob({ exportKind: "mockup", kitId })
  let mockup: Awaited<ReturnType<typeof renderKitMockupPng>>

  try {
    mockup = await renderKitMockupPng(kit)
  } catch (error) {
    await failExportJob({
      errorMessage: error instanceof Error ? error.message : "Mockup export failed.",
      jobId,
    })
    return exportFailedResponse(error, "Mockup export failed.")
  }

  const filename = `${kit.slug}-${kit.designPreset || kit.branch || "brand"}-website-mockup.png`

  await finishExportJob({
    byteSize: mockup.byteLength,
    contentType: "image/png",
    exportKind: "mockup",
    filename,
    jobId,
    kitId,
  })

  return new Response(mockup, {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
