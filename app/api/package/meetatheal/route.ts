import {
  exportFailedResponse,
  isHostedExportRuntime,
  localExportUnavailableResponse,
} from "@/lib/exportRuntime"
import { parseKitMarkdown } from "@/lib/parser"
import { hasBlockingErrors, validateKit } from "@/lib/parser/validation"
import { type ValidationIssue } from "@/lib/parser/pageTypes"
import { renderKitPdf } from "@/lib/renderer"
import {
  failExportJob,
  finishExportJob,
  startExportJob,
} from "@/lib/supabase/kitFactoryData"
import { createZip } from "@/lib/zip"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const packageDocuments = [
  {
    bodyKey: "lessonBookMarkdown",
    label: "Lesson Book",
    filename: "meet-at-the-heal-lesson-book.pdf",
    designPreset: "meetatheal",
  },
  {
    bodyKey: "couplesWorkbookMarkdown",
    label: "Couples Workbook",
    filename: "meet-at-the-heal-couples-workbook.pdf",
    designPreset: "meetatheal",
  },
  {
    bodyKey: "riseWorkbookMarkdown",
    label: "Rise Individual Workbook",
    filename: "meet-at-the-heal-rise-individual-workbook.pdf",
    designPreset: "meetatheal-rise",
  },
  {
    bodyKey: "landWorkbookMarkdown",
    label: "Land Individual Workbook",
    filename: "meet-at-the-heal-land-individual-workbook.pdf",
    designPreset: "meetatheal-land",
  },
] as const

export async function POST(request: Request) {
  if (isHostedExportRuntime()) {
    return localExportUnavailableResponse("Meet at the Heal ZIP")
  }

  const body = await request.json()
  const kitId = typeof body.kitId === "string" ? body.kitId : null
  const files: { filename: string; data: Buffer }[] = []
  const allIssues: ValidationIssue[] = []

  for (const document of packageDocuments) {
    const markdown = typeof body[document.bodyKey] === "string" ? body[document.bodyKey] : ""

    if (!markdown.trim()) {
      allIssues.push({
        code: "missing-package-document",
        detail: `${document.label}: Paste or upload the markdown for this required document.`,
        level: "error",
        message: `${document.label} markdown is required.`,
      })
      continue
    }

    const kit = parseKitMarkdown(markdown, {
      branch: "meetatheal",
      designPreset: document.designPreset,
      outputMode: "all-in-one",
    })
    const issues = validateKit(kit)

    if (issues.length > 0) {
      allIssues.push(
        ...issues.map((issue) => ({
          ...issue,
          detail: issue.detail
            ? `${document.filename}: ${issue.detail}`
            : document.filename,
        }))
      )
    }

    if (hasBlockingErrors(issues)) {
      continue
    }

    try {
      files.push({
        filename: document.filename,
        data: await renderKitPdf(kit, "complete"),
      })
    } catch (error) {
      return exportFailedResponse(error, "Meet at the Heal package export failed.")
    }
  }

  if (allIssues.some((issue) => issue.level === "error")) {
    return Response.json({ issues: allIssues }, { status: 400 })
  }

  const jobId = await startExportJob({ exportKind: "zip", kitId, target: "meetatheal-package" })
  let zip: ReturnType<typeof createZip>

  try {
    zip = createZip(files)
  } catch (error) {
    await failExportJob({
      errorMessage:
        error instanceof Error ? error.message : "Meet at the Heal package export failed.",
      jobId,
    })
    return exportFailedResponse(error, "Meet at the Heal package export failed.")
  }

  const filename = "meet-at-the-heal-kit-package.zip"

  await finishExportJob({
    contentType: "application/zip",
    exportKind: "zip",
    fileData: zip,
    filename,
    jobId,
    kitId,
    target: "meetatheal-package",
  })

  return new Response(zip, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
